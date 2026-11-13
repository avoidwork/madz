import { HumanMessage } from "@langchain/core/messages";
import { logger } from "../shared/logger.js";

/** Default number of recent messages kept verbatim after compaction. */
export const DEFAULT_KEEP_MESSAGES = 5;

/** Marker prefix of the synthetic summary message. */
export const SUMMARY_PREFIX = "Here is a summary of the conversation to date:";

/** Per-message and total character caps for the text sent to the summarizer. */
const MAX_MESSAGE_CHARS = 4000;
const MAX_TRANSCRIPT_CHARS = 120000;

const SUMMARY_INSTRUCTIONS = `You are compressing a conversation between a user and an AI assistant so it can continue in a much smaller context window.
Write a dense, factual summary that preserves: the user's goals and requests, decisions made, current task state and next steps, file paths, commands, identifiers, errors and their resolutions, and any constraints or preferences the user stated.
Drop pleasantries and redundant detail. Do not invent information. Output only the summary.`;

/**
 * Resolve a message's type regardless of whether it is a LangChain instance or
 * a plain `{ role }` / `{ type }` object.
 * @param {Object} message - A message
 * @returns {string} The message type ("human", "ai", "tool", "system", ...)
 */
function typeOf(message) {
	const t = message?._getType?.() ?? message?.type ?? message?.role;
	if (t === "user") return "human";
	if (t === "assistant") return "ai";
	return t;
}

/**
 * Flatten message content (string or content blocks) to plain text. Image and
 * other non-text blocks are replaced with a short placeholder.
 * @param {*} content - Message content
 * @returns {string} Plain text
 */
function contentToText(content) {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return content == null ? "" : String(content);
	return content
		.map((block) => {
			if (typeof block === "string") return block;
			if (block?.type === "text") return block.text ?? "";
			if (block?.type === "image_url") return "[image]";
			return `[${block?.type ?? "block"}]`;
		})
		.join("\n");
}

/**
 * Choose the index where the preserved tail starts. The tail is at most `keep`
 * messages and never begins with a ToolMessage (a tool result without the
 * AIMessage that requested it is rejected by providers). When the boundary
 * lands on tool results, it moves forward past them — the whole call/result
 * group is summarized — so the tail stays within `keep` and may shrink to 0.
 * @param {Array} messages - Full message list
 * @param {number} keep - Maximum tail size
 * @returns {number} Index of the first preserved message (messages.length = none)
 */
export function findTailStart(messages, keep) {
	let start = Math.max(0, messages.length - Math.max(0, keep));
	while (start < messages.length && typeOf(messages[start]) === "tool") start++;
	return start;
}

/**
 * Render messages to a plain-text transcript for the summarizer. Each message
 * is truncated, and when the transcript is too long the oldest part is dropped
 * (older material is already represented by any earlier summary).
 * @param {Array} messages - Messages to render
 * @returns {string} Transcript text
 */
export function buildTranscript(messages) {
	const lines = messages.map((m) => {
		const type = typeOf(m);
		let text = contentToText(m?.content);
		if (text.length > MAX_MESSAGE_CHARS) {
			text = `${text.slice(0, MAX_MESSAGE_CHARS)}… [truncated ${text.length - MAX_MESSAGE_CHARS} chars]`;
		}
		const calls =
			Array.isArray(m?.tool_calls) && m.tool_calls.length > 0
				? ` [tool calls: ${m.tool_calls.map((c) => c.name).join(", ")}]`
				: "";
		const label = type === "tool" ? `tool${m?.name ? `:${m.name}` : ""}` : type;
		return `${label}${calls}: ${text}`;
	});
	let transcript = lines.join("\n\n");
	if (transcript.length > MAX_TRANSCRIPT_CHARS) {
		transcript = `[earlier messages omitted]\n${transcript.slice(-MAX_TRANSCRIPT_CHARS)}`;
	}
	return transcript;
}

/**
 * Best-effort offload of the pre-compaction history to the backend so nothing
 * is lost. Failures are logged and ignored.
 * @param {Object} backend - deepagents backend
 * @param {Array} messages - Messages being summarized away
 * @param {string} [threadId] - Thread id used in the file name
 * @returns {Promise<string|null>} The file path, or null when not written
 */
async function offloadHistory(backend, messages, threadId) {
	if (!backend || typeof backend.write !== "function") return null;
	const name = (threadId || `compact-${Date.now()}`).replace(/[^\w.-]/g, "_");
	const path = `/conversation_history/${name}-${Date.now()}.md`;
	try {
		await backend.write(path, buildTranscript(messages));
		return path;
	} catch (err) {
		logger.warn({ error: err?.message }, "[compact] history offload failed; continuing");
		return null;
	}
}

/**
 * Compress a message history to `[summary, ...tail]`.
 *
 * Everything before the tail is summarized by `model` into one HumanMessage.
 * The tail is the last `keep` messages (or fewer, see {@link findTailStart}).
 * The system prompt is not part of message state and is therefore untouched.
 * Throws when the summarizer fails so callers can leave state unchanged.
 *
 * @param {Object} options - Options
 * @param {Array} options.messages - Full message history
 * @param {Object} options.model - Chat model with `invoke`
 * @param {Object} [options.backend] - Backend for best-effort history offload
 * @param {number} [options.keep=5] - Maximum number of recent messages to keep
 * @param {string} [options.threadId] - Thread id for the offload file name
 * @returns {Promise<{messages: Array, summarized: number, kept: number, offloadPath: (string|null)}|null>}
 *   The compacted history, or null when there is nothing worth summarizing
 */
export async function compactMessages(options = {}) {
	const { messages = [], model, backend, keep = DEFAULT_KEEP_MESSAGES, threadId } = options;
	const start = findTailStart(messages, keep);
	const toSummarize = messages.slice(0, start);
	const tail = messages.slice(start);

	// Nothing before the tail, or only a prior summary: summarizing again would
	// just loop on the same content.
	if (toSummarize.length === 0) return null;
	if (
		toSummarize.length === 1 &&
		contentToText(toSummarize[0]?.content).startsWith(SUMMARY_PREFIX)
	) {
		return null;
	}

	const offloadPath = await offloadHistory(backend, toSummarize, threadId);

	const res = await model.invoke([
		new HumanMessage(
			`${SUMMARY_INSTRUCTIONS}\n\n<conversation>\n${buildTranscript(toSummarize)}\n</conversation>`,
		),
	]);
	const summaryText = (
		typeof res?.text === "string" ? res.text : contentToText(res?.content)
	).trim();
	if (!summaryText) throw new Error("summarizer returned empty output");

	const pointer = offloadPath ? `\n\n(Full earlier history saved to ${offloadPath})` : "";
	const summary = new HumanMessage({
		content: `${SUMMARY_PREFIX}\n\n${summaryText}${pointer}`,
		additional_kwargs: { madz_summary: true },
	});

	return {
		messages: [summary, ...tail],
		summarized: toSummarize.length,
		kept: tail.length,
		offloadPath,
	};
}
