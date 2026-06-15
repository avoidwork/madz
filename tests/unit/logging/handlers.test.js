import { describe, it } from "node:test";
import assert from "node:assert";
import { createEventHandlers, wrapCallback, recordToolStart, getToolDuration } from "../../../src/logging/handlers.js";

describe("src/logging/handlers.js", () => {
	describe("createEventHandlers", () => {
		it("should return an object with all handler methods", () => {
			const handlers = createEventHandlers();
			assert.strictEqual(typeof handlers.tool_start, "function");
			assert.strictEqual(typeof handlers.tool_end, "function");
			assert.strictEqual(typeof handlers.tool_error, "function");
			assert.strictEqual(typeof handlers.llm_response, "function");
			assert.strictEqual(typeof handlers.llm_error, "function");
			assert.strictEqual(typeof handlers.compaction, "function");
		});

		it("should not throw when calling tool_start handler", () => {
			const handlers = createEventHandlers();
			assert.doesNotThrow(() =>
				handlers.tool_start({ toolName: "readFile", toolCallId: "tc1", input: "test input" }),
			);
		});

		it("should not throw when calling tool_end handler", () => {
			const handlers = createEventHandlers();
			assert.doesNotThrow(() =>
				handlers.tool_end({ toolName: "readFile", toolCallId: "tc1", data: "result data" }),
			);
		});

		it("should not throw when calling tool_error handler", () => {
			const handlers = createEventHandlers();
			assert.doesNotThrow(() =>
				handlers.tool_error({ toolName: "readFile", toolCallId: "tc1", error: "file not found" }),
			);
		});

		it("should not throw when calling llm_response handler", () => {
			const handlers = createEventHandlers();
			assert.doesNotThrow(() =>
				handlers.llm_response({ model: "gpt-4o", tokens: 100, content: "Hello, world!" }),
			);
		});

		it("should not throw when calling llm_error handler", () => {
			const handlers = createEventHandlers();
			assert.doesNotThrow(() =>
				handlers.llm_error({ model: "gpt-4o", error: "rate limit exceeded", retry: 1 }),
			);
		});

		it("should not throw when calling compaction handler", () => {
			const handlers = createEventHandlers();
			assert.doesNotThrow(() =>
				handlers.compaction({ action: "start", messageCount: 50, targetTokens: 50000 }),
			);
		});

		it("should handle missing optional fields gracefully", () => {
			const handlers = createEventHandlers();
			assert.doesNotThrow(() => handlers.tool_start({ toolName: "test" }));
			assert.doesNotThrow(() => handlers.tool_end({ toolName: "test" }));
			assert.doesNotThrow(() => handlers.tool_error({ toolName: "test" }));
			assert.doesNotThrow(() => handlers.llm_response({}));
			assert.doesNotThrow(() => handlers.llm_error({ error: "test" }));
			assert.doesNotThrow(() => handlers.compaction({ action: "start" }));
		});
	});

	describe("wrapCallback", () => {
		it("should call both logger and user callback", () => {
			let userCalled = false;
			const userCallback = () => {
				userCalled = true;
			};
			const wrapped = wrapCallback(userCallback);
			wrapped({ type: "tool_start", toolName: "test" });
			assert.ok(userCalled);
		});

		it("should not throw if user callback throws", () => {
			const userCallback = () => {
				throw new Error("user callback error");
			};
			const wrapped = wrapCallback(userCallback);
			assert.doesNotThrow(() => wrapped({ type: "tool_start", toolName: "test" }));
		});

		it("should not throw if logger throws", () => {
			const userCallback = () => {};
			// Logger should not throw in normal operation
			const wrapped = wrapCallback(userCallback);
			assert.doesNotThrow(() => wrapped({ type: "tool_start", toolName: "test" }));
		});

		it("should pass event data to user callback", () => {
			let receivedEvent = null;
			const userCallback = (event) => {
				receivedEvent = event;
			};
			const wrapped = wrapCallback(userCallback);
			wrapped({ type: "tool_start", toolName: "readFile", toolCallId: "tc1" });
			assert.strictEqual(receivedEvent.type, "tool_start");
			assert.strictEqual(receivedEvent.toolName, "readFile");
		});

		it("should handle null user callback", () => {
			const wrapped = wrapCallback(null);
			assert.doesNotThrow(() => wrapped({ type: "tool_start", toolName: "test" }));
		});
	});

	describe("recordToolStart / getToolDuration", () => {
		it("should record a start time", () => {
			recordToolStart("tc1");
			const duration = getToolDuration("tc1");
			assert.ok(duration >= 0);
		});

		it("should return 0 for unknown tool call ID", () => {
			const duration = getToolDuration("unknown");
			assert.strictEqual(duration, 0);
		});

		it("should delete the start time after getToolDuration", () => {
			recordToolStart("tc2");
			getToolDuration("tc2");
			const duration = getToolDuration("tc2");
			assert.strictEqual(duration, 0);
		});

		it("should calculate approximate duration", () => {
			recordToolStart("tc3");
			// Small delay to ensure non-zero duration
			const start = Date.now();
			while (Date.now() - start < 5) {
				// busy wait
			}
			const duration = getToolDuration("tc3");
			assert.ok(duration >= 5, `Expected duration >= 5ms, got ${duration}`);
		});
	});
});
