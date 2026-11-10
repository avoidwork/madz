/**
 * Detection of synthetic "cancelled" ToolMessages injected by deepagents'
 * patch-dangling-tool-calls when a new user message arrives before a tool call
 * completes. These stay in provider history but must not render as tool calls.
 */

/** Single source of truth for the cancelled-tool-call text. */
export const CANCELLED_TOOL_REGEX =
	/was cancelled - another message came in before it could be completed\./;

/**
 * Flatten message content (string or content blocks) to text.
 * @param {*} content - Message content
 * @returns {string} Text
 */
function contentToText(content) {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content.map((b) => (typeof b === "string" ? b : (b?.text ?? ""))).join("");
	}
	return "";
}

/**
 * Whether a tool message is the synthetic "cancelled" message.
 * @param {{ status?: string, content?: * }} msg - Tool message (or event-like object)
 * @returns {boolean} True when status is "error" and content matches
 */
export function isCancelledToolMessage(msg) {
	if (!msg || msg.status !== "error") return false;
	return CANCELLED_TOOL_REGEX.test(contentToText(msg.content));
}

/**
 * Whether a streamed tool event is a cancelled tool message. Stream events
 * carry only text; when a status is present it must be "error".
 * @param {{ status?: string, text?: string, data?: Object }} event - Stream event
 * @returns {boolean} True when the event represents a cancelled tool call
 */
export function isCancelledToolEvent(event) {
	const status = event?.data?.status ?? event?.status;
	if (status !== undefined && status !== "error") return false;
	return CANCELLED_TOOL_REGEX.test(contentToText(event?.data?.text ?? event?.text));
}
