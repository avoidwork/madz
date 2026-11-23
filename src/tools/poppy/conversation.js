import { z } from "zod";
import { fetchJson, FETCH_TIMEOUT } from "./common.js";
import { validateUrl } from "./discovery.js";

/** Poppy protocol version sent as the `Poppy-Version` header. */
const POPPY_VERSION = "1.0";

/** Conversation error codes mapped to HTTP status per Poppy spec section 8.13. */
const CONVERSATION_ERROR_STATUS = Object.freeze({
	conversation_not_found: 404,
	conversation_closed: 409,
	direct_conversation_open: 409,
	request_id_conflict: 409,
	invalid_cursor: 400,
	cursor_expired: 410,
	version_mismatch: 409,
});

/**
 * Zod schema for a Poppy conversation message per spec 8.3/8.4. The message
 * carries an `author` object with a `type` of `agent` or `human`, plus
 * optional `text`, `data`, `context`, and `extensions` fields. Additional
 * fields are permitted.
 */
const MessageSchema = z
	.object({
		author: z.object({
			type: z.enum(["agent", "human"]),
		}),
		text: z.string().optional(),
		data: z.unknown().optional(),
		context: z.unknown().optional(),
		extensions: z.unknown().optional(),
	})
	.passthrough();

/**
 * Zod schema for the `conversation` action input. Required field: `op`.
 * Optional fields: `endpoint`, `id`, `message`, `requestId`, `wait`,
 * `cursor`, `parentConversationId`, `userRequestedEventId`, `session`,
 * `accessToken`, `version`.
 */
export const ConversationInputSchema = z.object({
	op: z.string().min(1),
	endpoint: z.string().optional(),
	id: z.string().optional(),
	message: z.unknown().optional(),
	requestId: z.string().optional(),
	wait: z.number().optional(),
	cursor: z.string().optional(),
	parentConversationId: z.string().optional(),
	userRequestedEventId: z.string().optional(),
	session: z.string().optional(),
	accessToken: z.string().optional(),
	version: z.string().optional(),
});

/**
 * Build the request headers for a conversation call, including the
 * Poppy-Session, Poppy-Version, access token, and idempotency key headers as
 * needed.
 * @param {object} input - Tool input
 * @param {string} [input.session] - The Poppy-Session JWT
 * @param {string} [input.accessToken] - The access token
 * @param {string} [input.version] - The Poppy protocol version
 * @param {string} [input.requestId] - The request ID for safe retries
 * @returns {object} The request headers
 */
export function buildConversationHeaders(input) {
	const headers = {};
	if (input.session) {
		headers["Poppy-Session"] = input.session;
	}
	if (input.accessToken) {
		headers.authorization = `Bearer ${input.accessToken}`;
	}
	headers["Poppy-Version"] = input.version ?? POPPY_VERSION;
	return headers;
}

/**
 * Map a conversation error code to its HTTP status per Poppy spec section
 * 8.13.
 * @param {string} code - The Poppy error code
 * @returns {number} The HTTP status
 */
export function conversationErrorStatus(code) {
	return CONVERSATION_ERROR_STATUS[code] ?? 500;
}

/**
 * Extract the conversation state fields `working`, `handoff`, `responder`,
 * and `closed` from a conversation object.
 * @param {object} conversation - The conversation object
 * @returns {{working: boolean, handoff: boolean, responder?: string, closed: boolean}} State
 */
export function getConversationState(conversation) {
	return {
		working: conversation?.working ?? false,
		handoff: conversation?.handoff ?? false,
		responder: conversation?.responder,
		closed: conversation?.closed ?? false,
	};
}

/**
 * Validate that an endpoint is present and HTTPS/non-private.
 * @param {string} endpoint - The endpoint URL
 * @returns {{ok: boolean, error?: string}} Validation result
 */
async function validateEndpoint(endpoint) {
	if (!endpoint) {
		return { ok: false, error: "endpoint is required" };
	}
	return validateUrl(endpoint);
}

/**
 * Zod schema for a successful events read response per spec 8.5. Requires
 * `conversation_id`, `events`, `cursor`, `has_more`, and the state fields
 * `working`, `handoff`, `responder`, and `closed`.
 */
const ReadResponseSchema = z.object({
	conversation_id: z.string().min(1),
	events: z.array(z.unknown()),
	cursor: z.string().min(1),
	has_more: z.boolean(),
	working: z.boolean(),
	handoff: z.boolean(),
	responder: z.string().optional(),
	closed: z.boolean(),
});

/**
 * Map a `fetchJson` result into a normalized conversation result, attaching
 * the Poppy error code and mapped HTTP status when present.
 * @param {{ok: boolean, data?: object, error?: string}} result - The fetch result
 * @returns {{ok: boolean, data?: object, error?: string, code?: string, status?: number}} Result
 */
function mapConversationResult(result) {
	if (result.ok) {
		return { ok: true, data: result.data };
	}
	const code = result.data?.error ?? result.data?.code;
	if (code && CONVERSATION_ERROR_STATUS[code]) {
		return { ok: false, error: result.error, code, status: CONVERSATION_ERROR_STATUS[code] };
	}
	return { ok: false, error: result.error };
}

/**
 * Start a conversation with a company's agent via `POST {endpoint}`.
 * @param {object} input - Tool input
 * @param {string} input.endpoint - The conversation endpoint URL
 * @param {string} [input.parentConversationId] - Parent conversation ID for a direct conversation
 * @param {string} [input.userRequestedEventId] - User-requested event ID for a direct conversation
 * @param {object} [options] - Runtime options
 * @returns {Promise<{ok: boolean, data?: object, error?: string, code?: string, status?: number}>} Result
 */
export async function startConversation(input, options = {}) {
	const validation = await validateEndpoint(input.endpoint);
	if (!validation.ok) {
		return validation;
	}
	const body = {};
	if (input.requestId) {
		body.request_id = input.requestId;
	}
	if (input.parentConversationId) {
		body.parent_conversation_id = input.parentConversationId;
	}
	if (input.userRequestedEventId) {
		body.user_requested_event_id = input.userRequestedEventId;
	}
	if (input.message !== undefined) {
		body.message = input.message;
	}
	const result = await fetchJson(input.endpoint, {
		method: "POST",
		headers: buildConversationHeaders(input),
		body: JSON.stringify(body),
		...options,
	});
	return mapConversationResult(result);
}

/**
 * Send a message to a conversation via `POST {endpoint}/{id}/messages`.
 * @param {object} input - Tool input
 * @param {string} input.endpoint - The conversation endpoint URL
 * @param {string} input.id - The conversation ID
 * @param {unknown} [input.message] - The message body
 * @param {object} [options] - Runtime options
 * @returns {Promise<{ok: boolean, data?: object, error?: string, code?: string, status?: number}>} Result
 */
export async function sendMessage(input, options = {}) {
	const validation = await validateEndpoint(input.endpoint);
	if (!validation.ok) {
		return validation;
	}
	if (!input.id) {
		return { ok: false, error: "id is required" };
	}
	const message = MessageSchema.safeParse(input.message);
	if (!message.success) {
		return {
			ok: false,
			error: `Invalid message: ${message.error.issues.map((i) => i.message).join("; ")}`,
		};
	}
	const url = `${input.endpoint}/${input.id}/messages`;
	const body = { ...message.data };
	if (input.requestId) {
		body.request_id = input.requestId;
	}
	const result = await fetchJson(url, {
		method: "POST",
		headers: buildConversationHeaders(input),
		body: JSON.stringify(body),
		...options,
	});
	return mapConversationResult(result);
}

/**
 * Read events from a conversation via `GET {endpoint}/{id}/events`.
 * @param {object} input - Tool input
 * @param {string} input.endpoint - The conversation endpoint URL
 * @param {string} input.id - The conversation ID
 * @param {number} [input.wait] - The wait query parameter
 * @param {string} [input.cursor] - The cursor query parameter
 * @param {object} [options] - Runtime options
 * @returns {Promise<{ok: boolean, data?: object, error?: string, code?: string, status?: number}>} Result
 */
export async function readEvents(input, options = {}) {
	const validation = await validateEndpoint(input.endpoint);
	if (!validation.ok) {
		return validation;
	}
	if (!input.id) {
		return { ok: false, error: "id is required" };
	}
	const url = new URL(`${input.endpoint}/${input.id}/events`);
	if (input.wait !== undefined) {
		url.searchParams.set("wait", String(input.wait));
	}
	if (input.cursor) {
		url.searchParams.set("cursor", input.cursor);
	}
	const result = await fetchJson(url, {
		method: "GET",
		headers: buildConversationHeaders(input),
		...options,
	});
	if (result.ok) {
		const parsed = ReadResponseSchema.safeParse(result.data);
		if (!parsed.success) {
			return {
				ok: false,
				error: `Invalid events response: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
			};
		}
		return { ok: true, data: parsed.data };
	}
	return mapConversationResult(result);
}

/**
 * Parse a single SSE frame into an event object. Returns null when the frame
 * carries no data.
 * @param {string} frame - The raw SSE frame text
 * @returns {{event: string, data: unknown} | null} The parsed event
 */
export function parseSseFrame(frame) {
	let eventType = "message";
	let data = "";
	for (const line of frame.split("\n")) {
		if (line.startsWith("event:")) {
			eventType = line.slice(6).trim();
		} else if (line.startsWith("data:")) {
			data += line.slice(5).trim();
		}
	}
	if (!data) {
		return null;
	}
	let parsed;
	try {
		parsed = JSON.parse(data);
	} catch {
		parsed = data;
	}
	return { event: eventType, data: parsed };
}

/**
 * Parse an SSE response body into an array of events, dispatching each event
 * type.
 * @param {ReadableStream} body - The SSE response body
 * @returns {Promise<Array<{event: string, data: unknown}>>} The parsed events
 */
export async function parseSse(body) {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	const events = [];
	for (;;) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		buffer += decoder.decode(value, { stream: true });
		const frames = buffer.split("\n\n");
		buffer = frames.pop();
		for (const frame of frames) {
			const event = parseSseFrame(frame);
			if (event) {
				events.push(event);
			}
		}
	}
	if (buffer.trim()) {
		const event = parseSseFrame(buffer);
		if (event) {
			events.push(event);
		}
	}
	return events;
}

/**
 * Stream events from a conversation via SSE (`Accept: text/event-stream`).
 * @param {object} input - Tool input
 * @param {string} input.endpoint - The conversation endpoint URL
 * @param {string} input.id - The conversation ID
 * @param {number} [input.wait] - The wait query parameter
 * @param {string} [input.cursor] - The cursor query parameter
 * @param {object} [options] - Runtime options
 * @param {number} [options.timeout] - Stream timeout in ms
 * @returns {Promise<{ok: boolean, data?: object, error?: string, code?: string, status?: number}>} Result
 */
export async function streamEvents(input, options = {}) {
	const validation = await validateEndpoint(input.endpoint);
	if (!validation.ok) {
		return validation;
	}
	if (!input.id) {
		return { ok: false, error: "id is required" };
	}
	const url = new URL(`${input.endpoint}/${input.id}/events`);
	if (input.wait !== undefined) {
		url.searchParams.set("wait", String(input.wait));
	}
	if (input.cursor) {
		url.searchParams.set("cursor", input.cursor);
	}
	const headers = { ...buildConversationHeaders(input), Accept: "text/event-stream" };
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), options.timeout ?? FETCH_TIMEOUT);
	try {
		const resp = await fetch(url, {
			method: "GET",
			headers,
			signal: controller.signal,
		});
		if (!resp.ok) {
			let data = null;
			try {
				data = await resp.json();
			} catch {
				// Non-JSON error body; ignore.
			}
			return mapConversationResult({ ok: false, error: `HTTP error ${resp.status}`, data });
		}
		const events = await parseSse(resp.body);
		return { ok: true, data: { events } };
	} catch (err) {
		if (err.name === "AbortError") {
			return { ok: false, error: "Timed out streaming events" };
		}
		return { ok: false, error: err.message };
	} finally {
		clearTimeout(timeoutId);
	}
}

/**
 * Request a handoff to a person via `POST {endpoint}/{id}/handoff`.
 * @param {object} input - Tool input
 * @param {string} input.endpoint - The conversation endpoint URL
 * @param {string} input.id - The conversation ID
 * @param {object} [options] - Runtime options
 * @returns {Promise<{ok: boolean, data?: object, error?: string, code?: string, status?: number}>} Result
 */
export async function handoff(input, options = {}) {
	const validation = await validateEndpoint(input.endpoint);
	if (!validation.ok) {
		return validation;
	}
	if (!input.id) {
		return { ok: false, error: "id is required" };
	}
	const url = `${input.endpoint}/${input.id}/handoff`;
	const result = await fetchJson(url, {
		method: "POST",
		headers: buildConversationHeaders(input),
		...options,
	});
	return mapConversationResult(result);
}

/**
 * Cancel a handoff to a person via `POST {endpoint}/{id}/handoff/cancel`.
 * @param {object} input - Tool input
 * @param {string} input.endpoint - The conversation endpoint URL
 * @param {string} input.id - The conversation ID
 * @param {object} [options] - Runtime options
 * @returns {Promise<{ok: boolean, data?: object, error?: string, code?: string, status?: number}>} Result
 */
export async function handoffCancel(input, options = {}) {
	const validation = await validateEndpoint(input.endpoint);
	if (!validation.ok) {
		return validation;
	}
	if (!input.id) {
		return { ok: false, error: "id is required" };
	}
	const url = `${input.endpoint}/${input.id}/handoff/cancel`;
	const result = await fetchJson(url, {
		method: "POST",
		headers: buildConversationHeaders(input),
		...options,
	});
	return mapConversationResult(result);
}

/**
 * Dispatch the `conversation` action on its `op` field.
 * @param {object} input - Tool input
 * @param {object} [options] - Runtime options
 * @returns {Promise<{ok: boolean, data?: object, error?: string, code?: string, status?: number}>} Result
 */
export async function execute(input, options = {}) {
	const parsed = ConversationInputSchema.safeParse(input);
	if (!parsed.success) {
		return {
			ok: false,
			error: `Invalid conversation input: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
		};
	}
	const data = parsed.data;
	switch (data.op) {
		case "start":
			return startConversation(data, options);
		case "send":
			return sendMessage(data, options);
		case "read":
			return readEvents(data, options);
		case "stream":
			return streamEvents(data, options);
		case "handoff":
			return handoff(data, options);
		case "handoff_cancel":
			return handoffCancel(data, options);
		default:
			return { ok: false, error: `Unknown conversation operation: ${data.op}` };
	}
}
