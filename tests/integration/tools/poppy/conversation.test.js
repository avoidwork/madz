import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { execute } from "../../../../src/tools/poppy/conversation.js";

describe("poppy - integration conversation", () => {
	it("starts a conversation and sends a message", async () => {
		mock.method(global, "fetch", async (url, init) => {
			const href = String(url);
			if (href.endsWith("/conv")) {
				assert.strictEqual(init.method, "POST");
				assert.strictEqual(init.headers["Poppy-Session"], "session-jwt");
				return {
					ok: true,
					status: 200,
					json: async () => ({ id: "conv-1", state: { working: false } }),
				};
			}
			if (href.endsWith("/conv-1/messages")) {
				assert.strictEqual(init.method, "POST");
				const body = JSON.parse(init.body);
				assert.strictEqual(body.role, "user");
				assert.strictEqual(body.content, "hello");
				return { ok: true, status: 200, json: async () => ({ ok: true }) };
			}
			return { ok: false, status: 404, json: async () => ({}) };
		});

		const started = await execute({
			op: "start",
			endpoint: "https://example.com/conv",
			session: "session-jwt",
		});
		assert.strictEqual(started.ok, true);
		assert.strictEqual(started.data.id, "conv-1");

		const sent = await execute({
			op: "send",
			endpoint: "https://example.com/conv",
			id: "conv-1",
			message: { role: "user", content: "hello" },
			session: "session-jwt",
		});
		assert.strictEqual(sent.ok, true);
	});

	it("streams events via SSE and dispatches event types", async () => {
		const encoder = new TextEncoder();
		const stream = new ReadableStream({
			start(controller) {
				controller.enqueue(encoder.encode('event: message\ndata: {"id":"1"}\n\n'));
				controller.enqueue(encoder.encode('event: state\ndata: {"working":true}\n\n'));
				controller.close();
			},
		});
		mock.method(global, "fetch", async (url, init) => {
			assert.strictEqual(String(url), "https://example.com/conv/conv-1/events");
			assert.strictEqual(init.headers.Accept, "text/event-stream");
			return { ok: true, status: 200, body: stream };
		});

		const result = await execute({
			op: "stream",
			endpoint: "https://example.com/conv",
			id: "conv-1",
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.events.length, 2);
		assert.strictEqual(result.data.events[0].event, "message");
		assert.strictEqual(result.data.events[1].event, "state");
	});

	it("maps a conversation_not_found error", async () => {
		mock.method(global, "fetch", async () => ({
			ok: false,
			status: 404,
			json: async () => ({ error: "conversation_not_found" }),
		}));
		const result = await execute({
			op: "read",
			endpoint: "https://example.com/conv",
			id: "missing",
		});
		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.code, "conversation_not_found");
		assert.strictEqual(result.status, 404);
	});
});
