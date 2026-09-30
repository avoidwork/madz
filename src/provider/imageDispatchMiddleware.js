import { createMiddleware } from "langchain";
import { HumanMessage } from "@langchain/core/messages";
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
	return createMiddleware({
		name: "ImageDispatch",
		async wrapModelCall(request, handler) {
			const messages = Array.isArray(request.messages) ? request.messages : [];
			const imageBlocks = [];
			let userPrompt = null;

			// Track the most recent HumanMessage so we can pair the image with
			// the user's prompt that triggered the `readImage` call.
			for (const message of messages) {
				const type = message._getType?.() ?? message.type ?? message.role;
				if (type === "human") {
					userPrompt = extractText(message.content);
					continue;
				}
				if (type !== "tool") continue;
				if (message.name !== "readImage") continue;

				const block = buildImageBlock(message.content);
				if (block) imageBlocks.push(block);
			}

			if (imageBlocks.length > 0) {
				const content = [
					{ type: "text", text: userPrompt ?? "Analyze the provided image." },
					...imageBlocks,
				];
				request.messages = [...messages, new HumanMessage({ content })];
				logger.debug(
					{ imageBlocks: imageBlocks.length },
					"[imageDispatch] injected multimodal HumanMessage",
				);
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
