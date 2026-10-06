import { createMiddleware } from "langchain";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { sendImageImpl } from "../tools/image/sendImage.js";
import { logger } from "../shared/logger.js";

/**
 * Create the `ImageDispatch` middleware that dispatches `readImage` results to
 * the LLM as multimodal vision input.
 *
 * When a `readImage` ToolMessage is present in `request.messages`, the
 * middleware parses the tool result JSON (`{ ok, mimeType, data }`), builds a
 * multimodal content array via `sendImage`'s content-building logic, and
 * injects a HumanMessage with that content into `request.messages` before
 * invoking the handler. This pairs the user's prompt (the message that
 * triggered the `readImage` call) with the image as vision input.
 *
 * The image is injected only on the turn immediately following the `readImage`
 * call — a closure-level Set of dispatched `tool_call_id`s prevents the image
 * from being re-attached to unrelated subsequent prompts. The base64 payload is
 * stripped from the ToolMessage content (replaced with a short stub) so the
 * model never receives it as plain text tokens.
 *
 * Register it AFTER the summarization middleware and BEFORE the token-budget
 * middleware in `createDeepAgent({ middleware: [...] })`. `AgentNode` composes
 * the chain backwards, so the last entry is innermost: registering after
 * summarization means this middleware observes the final post-summarization
 * message set, and registering before token-budget means the budget sees the
 * injected image when estimating context cost.
 *
 * @returns {Object} The middleware
 */
export function createImageDispatchMiddleware() {
	// Track which `readImage` tool_call_ids have already been dispatched so the
	// image is injected only on the turn immediately following the `readImage`
	// call, not re-attached to unrelated subsequent prompts.
	const dispatchedToolCallIds = new Set();

	return createMiddleware({
		name: "ImageDispatch",
		async wrapModelCall(request, handler) {
			const messages = Array.isArray(request.messages) ? request.messages : [];
			const imageBlocks = [];
			const toolCallPrompts = new Map();
			let userPrompt = null;

			// First pass: record the triggering prompt for each `readImage`
			// tool_call_id (the HumanMessage that preceded the AIMessage that
			// made the call), and collect image blocks for undispatched results.
			// Build a replacement message list so the base64 payload is stripped
			// from the ToolMessage content without mutating the persisted state
			// objects (which `request.messages` shares with the checkpointer).
			const strippedMessages = [];
			for (const message of messages) {
				const type = message._getType?.() ?? message.type ?? message.role;
				if (type === "human") {
					userPrompt = extractText(message.content);
					strippedMessages.push(message);
					continue;
				}
				if (type === "ai") {
					const toolCalls = message.tool_calls || [];
					for (const tc of toolCalls) {
						if (tc.name === "readImage") {
							toolCallPrompts.set(tc.id, userPrompt);
						}
					}
					strippedMessages.push(message);
					continue;
				}
				if (type !== "tool") {
					strippedMessages.push(message);
					continue;
				}
				if (message.name !== "readImage") {
					strippedMessages.push(message);
					continue;
				}

				const toolCallId = message.tool_call_id;
				if (dispatchedToolCallIds.has(toolCallId)) {
					// Already dispatched on a prior turn; keep the stub content so
					// the model never sees the base64 as text.
					strippedMessages.push(
						new ToolMessage({
							content: "Image read successfully.",
							name: message.name,
							tool_call_id: toolCallId,
						}),
					);
					continue;
				}

				const block = buildImageBlock(message.content);
				if (block) {
					imageBlocks.push({ toolCallId, block });
					dispatchedToolCallIds.add(toolCallId);
					// Replace the ToolMessage with a stub so the base64 payload is
					// not sent to the model as plain text tokens.
					strippedMessages.push(
						new ToolMessage({
							content: "Image read successfully.",
							name: message.name,
							tool_call_id: toolCallId,
						}),
					);
				} else {
					strippedMessages.push(message);
				}
			}

			if (imageBlocks.length > 0) {
				// Pair the image with the prompt that triggered the `readImage`
				// call, not the most recent user prompt.
				const triggerPrompt =
					toolCallPrompts.get(imageBlocks[0].toolCallId) ?? "Analyze the provided image.";
				const content = [
					{ type: "text", text: triggerPrompt },
					...imageBlocks.map(({ block }) => block),
				];
				request.messages = [...strippedMessages, new HumanMessage({ content })];
				logger.debug(
					{ imageBlocks: imageBlocks.length },
					"[imageDispatch] injected multimodal HumanMessage",
				);
			} else {
				request.messages = strippedMessages;
			}

			return handler(request);
		},
	});
}

/**
 * Build a single `image_url` content block from a `readImage` ToolMessage
 * content string. Returns `null` when the result should be skipped.
 * @param {string} content - The ToolMessage content (JSON string)
 * @returns {Object|null} An `image_url` content block, or `null` to skip
 */
function buildImageBlock(content) {
	let parsed;
	try {
		parsed = JSON.parse(content);
	} catch {
		logger.warn("[imageDispatch] failed to parse readImage tool result; skipping");
		return null;
	}

	if (parsed?.ok !== true) return null;
	if (!parsed.data || typeof parsed.data !== "string" || parsed.data.length === 0) return null;

	// `sendImageImpl` returns `[{ type: "text", text }, { type: "image_url", image_url }]`.
	// The middleware reuses its content-building logic but only needs the `image_url`
	// block; the text block is assembled once from the user's prompt.
	const contentArray = sendImageImpl({
		data: parsed.data,
		mimeType: parsed.mimeType,
		text: "",
	});
	return contentArray[1];
}

/**
 * Extract plain text from a message content value, which may be a string or an
 * array of content blocks.
 * @param {string|Array} content - Message content
 * @returns {string} The extracted text
 */
function extractText(content) {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content.map((block) => block?.text ?? "").join("");
	}
	return "";
}
