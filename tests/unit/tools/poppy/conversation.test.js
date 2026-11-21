import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import {
	ConversationInputSchema,
	buildConversationHeaders,
	conversationErrorStatus,
	getConversationState,
	parseSseFrame,
	parseSse,
	startConversation,
	sendMessage,
	readEvents,
	streamEvents,
	handoff,
	handoffCancel,
	execute,
} from "../../../../src/tools/poppy/conversation.js";

describe("poppy conversation - schema validation", () => {
	it("accepts valid conversation input", () => {
		const result = ConversationInputSchema.safeParse({
			op: "start",
			endpoint: "https://example.com/conv",
		});
		assert.strictEqual(result.success, true);
	});

	it("rejects conversation input missing op", () => {
		const result = ConversationInputSchema.safeParse({ endpoint: "https://example.com/conv" });
		assert.strictEqual(result.success, false);
	});
});

describe("poppy conversation - buildConversationHeaders", () => {
	it("includes Poppy-Session and Poppy-Version headers", () => {
		const headers = buildConversationHeaders({ session: "jwt", version: "1.0" });
		assert.strictEqual(headers["Poppy-Session"], "jwt");
		assert.strictEqual(headers["Poppy-Version"], "1.0");
	});

	it("includes access token as bearer", () => {
		const headers = buildConversationHeaders({ accessToken: "token" });
		assert.strictEqual(headers.authorization, "Bearer token");
	});

	it("includes Idempotency-Key header when requestId provided", () => {
		const headers = buildConversationHeaders({ requestId: "req-123" });
		assert.strictEqual(headers["Idempotency-Key"], "req-123");
	});

	it("defaults Poppy-Version when not provided", () => {
		const headers = buildConversationHeaders({});
		assert.strictEqual(headers["Poppy-Version"], "1.0");
	});

	it("omits Idempotency-Key when absent", () => {
		const headers = buildConversationHeaders({});
		assert.strictEqual(headers["Idempotency-Key"], undefined);
	});
});

describe("poppy conversation - conversationErrorStatus", () => {
	it("maps conversation_not_found to 404", () => {
		assert.strictEqual(conversationErrorStatus("conversation_not_found"), 404);
	});

	it("maps conversation_closed to 400", () => {
		assert.strictEqual(conversationErrorStatus("conversation_closed"), 400);
	});

	it("maps direct_conversation_open to 400", () => {
		assert.strictEqual(conversationErrorStatus("direct_conversation_open"), 400);
	});

	it("maps request_id_conflict to 409", () => {
		assert.strictEqual(conversationErrorStatus("request_id_conflict"), 409);
	});

	it("maps invalid_cursor to 400", () => {
		assert.strictEqual(conversationErrorStatus("invalid_cursor"), 400);
	});

	it("maps cursor_expired to 400", () => {
		assert.strictEqual(conversationErrorStatus("cursor_expired"), 400);
	});

	it("maps version_mismatch to 400", () => {
		assert.strictEqual(conversationErrorStatus("version_mismatch"), 400);
	});

	it("defaults unknown codes to 500", () => {
		assert.strictEqual(conversationErrorStatus("unknown"), 500);
	});
});

describe("poppy conversation - getConversationState", () => {
	it("extracts working, handoff, responder, and closed fields", () => {
		const state = getConversationState({
			working: true,
			handoff: true,
			responder: "person",
			closed: false,
		});
		assert.strictEqual(state.working, true);
		assert.strictEqual(state.handoff, true);
		assert.strictEqual(state.responder, "person");
		assert.strictEqual(state.closed, false);
	});

	it("defaults missing state fields", () => {
		const state = getConversationState({});
		assert.strictEqual(state.working, false);
		assert.strictEqual(state.handoff, false);
		assert.strictEqual(state.responder, undefined);
		assert.strictEqual(state.closed, false);
	});
});

describe("poppy conversation - startConversation", () => {
	it("starts a conversation with POST to the endpoint", async () => {
		mock.method(global, "fetch", async (url, init) => {
			assert.strictEqual(String(url), "https://example.com/conv");
			assert.strictEqual(init.method, "POST");
			assert.strictEqual(init.headers["Poppy-Session"], "jwt");
			return {
				ok: true,
				status: 200,
				json: async () => ({ id: "conv-1", state: { working: false } }),
			};
		});
		const result = await startConversation({
			endpoint: "https://example.com/conv",
			session: "jwt",
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.id, "conv-1");
	});

	it("includes parent_conversation_id and user_requested_event_id for direct conversations", async () => {
		mock.method(global, "fetch", async (url, init) => {
			const body = JSON.parse(init.body);
			assert.strictEqual(body.parent_conversation_id, "parent-1");
			assert.strictEqual(body.user_requested_event_id, "event-1");
			return { ok: true, status: 200, json: async () => ({ id: "conv-2" }) };
		});
		const result = await startConversation({
			endpoint: "https://example.com/conv",
			parentConversationId: "parent-1",
			userRequestedEventId: "event-1",
		});
		assert.strictEqual(result.ok, true);
	});

	it("reports a missing endpoint", async () => {
		const result = await startConversation({});
		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.error, "endpoint is required");
	});

	it("rejects a non-HTTPS endpoint", async () => {
		const result = await startConversation({ endpoint: "http://example.com/conv" });
		assert.strictEqual(result.ok, false);
	});
});

describe("poppy conversation - sendMessage", () => {
	it("sends a message with POST to {endpoint}/{id}/messages", async () => {
		mock.method(global, "fetch", async (url, init) => {
			assert.strictEqual(String(url), "https://example.com/conv/conv-1/messages");
			assert.strictEqual(init.method, "POST");
			const body = JSON.parse(init.body);
			assert.strictEqual(body.role, "user");
			assert.strictEqual(body.content, "hello");
			return { ok: true, status: 200, json: async () => ({ ok: true }) };
		});
		const result = await sendMessage({
			endpoint: "https://example.com/conv",
			id: "conv-1",
			message: { role: "user", content: "hello" },
		});
		assert.strictEqual(result.ok, true);
	});

	it("includes the request ID for safe retries", async () => {
		mock.method(global, "fetch", async (url, init) => {
			assert.strictEqual(init.headers["Idempotency-Key"], "req-123");
			return { ok: true, status: 200, json: async () => ({ ok: true }) };
		});
		const result = await sendMessage({
			endpoint: "https://example.com/conv",
			id: "conv-1",
			message: { role: "user", content: "hello" },
			requestId: "req-123",
		});
		assert.strictEqual(result.ok, true);
	});

	it("reports a missing id", async () => {
		const result = await sendMessage({
			endpoint: "https://example.com/conv",
			message: { role: "user", content: "hi" },
		});
		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.error, "id is required");
	});

	it("rejects an invalid message", async () => {
		const result = await sendMessage({
			endpoint: "https://example.com/conv",
			id: "conv-1",
			message: { role: "user" },
		});
		assert.strictEqual(result.ok, false);
	});
});

describe("poppy conversation - readEvents", () => {
	it("reads events with GET to {endpoint}/{id}/events", async () => {
		mock.method(global, "fetch", async (url, init) => {
			assert.strictEqual(String(url), "https://example.com/conv/conv-1/events");
			assert.strictEqual(init.method, "GET");
			return { ok: true, status: 200, json: async () => ({ events: [] }) };
		});
		const result = await readEvents({ endpoint: "https://example.com/conv", id: "conv-1" });
		assert.strictEqual(result.ok, true);
	});

	it("includes wait and cursor query parameters", async () => {
		mock.method(global, "fetch", async (url) => {
			const href = String(url);
			assert.ok(href.includes("wait=5"));
			assert.ok(href.includes("cursor=abc"));
			return { ok: true, status: 200, json: async () => ({ events: [] }) };
		});
		const result = await readEvents({
			endpoint: "https://example.com/conv",
			id: "conv-1",
			wait: 5,
			cursor: "abc",
		});
		assert.strictEqual(result.ok, true);
	});

	it("maps an invalid_cursor error", async () => {
		mock.method(global, "fetch", async () => ({
			ok: false,
			status: 400,
			json: async () => ({ error: "invalid_cursor" }),
		}));
		const result = await readEvents({ endpoint: "https://example.com/conv", id: "conv-1" });
		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.code, "invalid_cursor");
		assert.strictEqual(result.status, 400);
	});
});

describe("poppy conversation - parseSseFrame", () => {
	it("parses an event frame with event type and JSON data", () => {
		const frame = 'event: message\ndata: {"id":"1"}';
		const event = parseSseFrame(frame);
		assert.strictEqual(event.event, "message");
		assert.strictEqual(event.data.id, "1");
	});

	it("defaults event type to message", () => {
		const event = parseSseFrame('data: {"id":"1"}');
		assert.strictEqual(event.event, "message");
	});

	it("returns null for a frame with no data", () => {
		const event = parseSseFrame("event: message");
		assert.strictEqual(event, null);
	});
});

describe("poppy conversation - parseSse", () => {
	it("parses multiple SSE frames from a stream", async () => {
		const encoder = new TextEncoder();
		const stream = new ReadableStream({
			start(controller) {
				controller.enqueue(encoder.encode('event: message\ndata: {"id":"1"}\n\n'));
				controller.enqueue(encoder.encode('event: state\ndata: {"working":true}\n\n'));
				controller.close();
			},
		});
		const events = await parseSse(stream);
		assert.strictEqual(events.length, 2);
		assert.strictEqual(events[0].event, "message");
		assert.strictEqual(events[1].event, "state");
	});
});

describe("poppy conversation - streamEvents", () => {
	it("streams events via SSE with Accept header", async () => {
		const encoder = new TextEncoder();
		const stream = new ReadableStream({
			start(controller) {
				controller.enqueue(encoder.encode('event: message\ndata: {"id":"1"}\n\n'));
				controller.close();
			},
		});
		mock.method(global, "fetch", async (url, init) => {
			assert.strictEqual(String(url), "https://example.com/conv/conv-1/events");
			assert.strictEqual(init.headers.Accept, "text/event-stream");
			return { ok: true, status: 200, body: stream };
		});
		const result = await streamEvents({ endpoint: "https://example.com/conv", id: "conv-1" });
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.events.length, 1);
		assert.strictEqual(result.data.events[0].event, "message");
	});

	it("dispatches each SSE event type", async () => {
		const encoder = new TextEncoder();
		const stream = new ReadableStream({
			start(controller) {
				for (const type of [
					"message",
					"state",
					"authorization",
					"user_requested",
					"direct_opened",
					"direct_closed",
					"working",
					"text-delta",
				]) {
					controller.enqueue(encoder.encode(`event: ${type}\ndata: {"type":"${type}"}\n\n`));
				}
				controller.close();
			},
		});
		mock.method(global, "fetch", async () => ({ ok: true, status: 200, body: stream }));
		const result = await streamEvents({ endpoint: "https://example.com/conv", id: "conv-1" });
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.events.length, 8);
		assert.deepStrictEqual(
			result.data.events.map((e) => e.event),
			[
				"message",
				"state",
				"authorization",
				"user_requested",
				"direct_opened",
				"direct_closed",
				"working",
				"text-delta",
			],
		);
	});
});

describe("poppy conversation - handoff", () => {
	it("requests a handoff with POST to {endpoint}/{id}/handoff", async () => {
		mock.method(global, "fetch", async (url, init) => {
			assert.strictEqual(String(url), "https://example.com/conv/conv-1/handoff");
			assert.strictEqual(init.method, "POST");
			return { ok: true, status: 200, json: async () => ({ ok: true }) };
		});
		const result = await handoff({ endpoint: "https://example.com/conv", id: "conv-1" });
		assert.strictEqual(result.ok, true);
	});

	it("maps a conversation_closed error", async () => {
		mock.method(global, "fetch", async () => ({
			ok: false,
			status: 400,
			json: async () => ({ error: "conversation_closed" }),
		}));
		const result = await handoff({ endpoint: "https://example.com/conv", id: "conv-1" });
		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.code, "conversation_closed");
		assert.strictEqual(result.status, 400);
	});
});

describe("poppy conversation - handoffCancel", () => {
	it("cancels a handoff with POST to {endpoint}/{id}/handoff/cancel", async () => {
		mock.method(global, "fetch", async (url, init) => {
			assert.strictEqual(String(url), "https://example.com/conv/conv-1/handoff/cancel");
			assert.strictEqual(init.method, "POST");
			return { ok: true, status: 200, json: async () => ({ ok: true }) };
		});
		const result = await handoffCancel({ endpoint: "https://example.com/conv", id: "conv-1" });
		assert.strictEqual(result.ok, true);
	});
});

describe("poppy conversation - execute", () => {
	it("dispatches the start op", async () => {
		mock.method(global, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => ({ id: "conv-1" }),
		}));
		const result = await execute({ op: "start", endpoint: "https://example.com/conv" });
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.id, "conv-1");
	});

	it("dispatches the send op", async () => {
		mock.method(global, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => ({ ok: true }),
		}));
		const result = await execute({
			op: "send",
			endpoint: "https://example.com/conv",
			id: "conv-1",
			message: { role: "user", content: "hi" },
		});
		assert.strictEqual(result.ok, true);
	});

	it("dispatches the read op", async () => {
		mock.method(global, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => ({ events: [] }),
		}));
		const result = await execute({
			op: "read",
			endpoint: "https://example.com/conv",
			id: "conv-1",
		});
		assert.strictEqual(result.ok, true);
	});

	it("dispatches the handoff op", async () => {
		mock.method(global, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => ({ ok: true }),
		}));
		const result = await execute({
			op: "handoff",
			endpoint: "https://example.com/conv",
			id: "conv-1",
		});
		assert.strictEqual(result.ok, true);
	});

	it("dispatches the handoff_cancel op", async () => {
		mock.method(global, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => ({ ok: true }),
		}));
		const result = await execute({
			op: "handoff_cancel",
			endpoint: "https://example.com/conv",
			id: "conv-1",
		});
		assert.strictEqual(result.ok, true);
	});

	it("returns an error for an unknown op", async () => {
		const result = await execute({ op: "unknown" });
		assert.strictEqual(result.ok, false);
	});
});
