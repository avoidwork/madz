import { surfaceInterrupt } from "./interrupt.js";
import { isSubagentNamespace } from "./namespace.js";

/**
 * Consume an agent stream, forwarding events to `streamingCallback` and
 * collecting the orchestrator's own text and reasoning.
 *
 * Tracks the last non-subagent event type forwarded to the callback so the
 * TUI can detect a turn that ended on reasoning (the model produced no
 * message content) and nudge it with a silent "Continue".
 *
 * @param {AsyncIterable} stream - The agent stream (subgraphs mode)
 * @param {Function} [streamingCallback] - Callback for streamed chunks
 * @param {Object} [options] - Options
 * @param {boolean} [options.showToolResults=true] - Whether to emit `tool` events
 * @param {{push: Function, settle?: Function, reset: Function}} [options.loopDetector] - Loop
 *   detector. Each non-subagent message/reasoning delta is pushed to it together with
 *   the stream block's id (the content-block index for messages, `block.id` for
 *   Responses API reasoning), so detection is restricted to one block and concurrent
 *   blocks never mix. Chat Completions `reasoning_content` carries no id. When it
 *   flags a loop the stream is abandoned (closing the underlying iterator) and
 *   `loopDetected` is returned true. Checks run in a worker, so a loop can be
 *   flagged after the stream ends; `settle()` is awaited to collect it. When the
 *   turn ends, however it ends, the detector is reset so its word and sentence
 *   lists are cleared and released.
 * @returns {Promise<{content: string, reasoning: string, interrupted: boolean, lastEventType: string | null, loopDetected: boolean}>}
 */
export async function consumeStream(stream, streamingCallback, options = {}) {
	try {
		return await drainStream(stream, streamingCallback, options);
	} finally {
		// The turn is over (finished, interrupted, abandoned on a loop, or thrown):
		// release the detector's lists so nothing from this turn is retained.
		options.loopDetector?.reset();
	}
}

/**
 * Drain the agent stream. See `consumeStream`.
 * @param {AsyncIterable} stream - The agent stream (subgraphs mode)
 * @param {Function} [streamingCallback] - Callback for streamed chunks
 * @param {Object} options - Options
 * @returns {Promise<{content: string, reasoning: string, interrupted: boolean, lastEventType: string | null, loopDetected: boolean}>}
 */
async function drainStream(stream, streamingCallback, options) {
	const showToolResults = options.showToolResults;
	let content = "";
	let reasoning = "";
	let interrupted = false;
	let lastEventType = null;
	let loopDetected = false;
	const loopDetector = options.loopDetector;

	for await (const [namespace, mode, payload] of stream) {
		// Subagent runs are nested under a `tools:<id>` namespace segment. Their
		// events get a `subagent_` prefix so the TUI routes them separately.
		const isSubagent = isSubagentNamespace(namespace);

		// A human-in-the-loop interrupt (e.g. `clarify`) pauses the agent; stop
		// consuming so the caller can ask the question and resume.
		if (surfaceInterrupt(mode, payload, streamingCallback)) {
			interrupted = true;
			break;
		}

		if (mode === "messages") {
			const [msg] = payload;
			const msgType = msg?._getType ? msg._getType() : msg?.type;
			const text = msg?.text ?? "";

			// Human messages are inputs or injected nudges (e.g. the loop-detection
			// "You're looping" nudge), not assistant output. Skip them so they are
			// never rendered into the assistant's streaming bubble.
			if (msgType === "human") continue;

			if (text) {
				// ToolMessage text is emitted as a distinct `tool` event, never
				// folded into the message segment.
				if (msgType === "tool") {
					if (showToolResults !== false && streamingCallback) {
						streamingCallback({
							type: isSubagent ? "subagent_tool" : "tool",
							text,
							name: msg?.name,
							namespace,
						});
					}
					if (!isSubagent) lastEventType = "tool";
					continue;
				}

				if (!isSubagent) {
					content += text;
					const blockIndex = msg?.content?.[0]?.index;
					if (loopDetector?.push("message", text, blockIndex)) loopDetected = true;
				}

				if (streamingCallback) {
					streamingCallback({
						type: isSubagent ? "subagent_message" : "message",
						text,
						namespace,
						// The content-block index is the stable identifier for a streamed
						// text block; it is normalized to `id` downstream.
						...(msg?.content?.[0]?.index != null ? { index: msg.content[0].index } : {}),
					});
				}
				if (!isSubagent) lastEventType = "message";
			}

			// Reasoning from additional_kwargs (Chat Completions API)
			const reasoningContent =
				msg?.additional_kwargs?.reasoning_content ?? msg?.additional_kwargs?.reasoning;
			if (reasoningContent) {
				if (!isSubagent) {
					reasoning += reasoningContent;
					if (loopDetector?.push("reasoning", reasoningContent)) loopDetected = true;
				}
				if (streamingCallback) {
					streamingCallback({
						type: isSubagent ? "subagent_reasoning" : "reasoning",
						text: reasoningContent,
						namespace,
					});
				}
				if (!isSubagent) lastEventType = "reasoning";
			} else if (Array.isArray(msg?.content)) {
				// Reasoning from content blocks (Responses API). Skipped when
				// additional_kwargs already supplied it, to avoid double-counting.
				for (const block of msg.content) {
					if (block?.type === "reasoning" && block.reasoning) {
						if (!isSubagent) {
							reasoning += block.reasoning;
							if (loopDetector?.push("reasoning", block.reasoning, block.id)) loopDetected = true;
						}
						if (streamingCallback) {
							streamingCallback({
								type: isSubagent ? "subagent_reasoning" : "reasoning",
								text: block.reasoning,
								id: block.id,
								namespace,
							});
						}
						if (!isSubagent) lastEventType = "reasoning";
					}
				}
			}
		} else if (mode === "tools" && streamingCallback) {
			if (payload?.event === "on_tool_start") {
				streamingCallback({
					type: isSubagent ? "subagent_tool_start" : "on_tool_start",
					name: payload.name,
					data: { input: payload.input },
					namespace,
				});
				if (!isSubagent) lastEventType = "on_tool_start";
			}
			if (payload?.event === "on_tool_end") {
				streamingCallback({
					type: isSubagent ? "subagent_tool_end" : "on_tool_end",
					name: payload.name,
					data: { output: payload.output },
					namespace,
				});
				if (!isSubagent) lastEventType = "on_tool_end";
			}
		}

		// Abandon the stream; leaving the for-await closes the iterator.
		if (loopDetected) break;
	}

	// Worker checks may still be in flight when the stream ends; collect them so
	// a loop in the final deltas is not missed.
	if (!loopDetected && loopDetector?.settle) loopDetected = await loopDetector.settle();

	return { content, reasoning, interrupted, lastEventType, loopDetected };
}
