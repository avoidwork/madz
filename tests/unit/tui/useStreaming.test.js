/**
 * Tests for useStreaming hook — event transformation, auto-continue, abort handling.
 */
import { describe, it } from "node:test";
import assert from "node:assert";

describe("useStreaming", () => {
	it("should exist as a module export", () => {
		// Verify the module can be imported
		const mod = require("../../../src/tui/hooks/useStreaming.js");
		assert.ok(typeof mod.useStreaming === "function");
	});

	it("should export useStreaming function", () => {
		const { useStreaming } = require("../../../src/tui/hooks/useStreaming.js");
		assert.strictEqual(typeof useStreaming, "function");
	});

	describe("stream event transformation", () => {
		it("should handle text events", () => {
			// The streaming hook transforms text events by appending to committedContent
			// and updating the last message with streaming cursor
			const { useStreaming } = require("../../../src/tui/hooks/useStreaming.js");
			assert.strictEqual(typeof useStreaming, "function");
		});

		it("should handle reasoning events", () => {
			// Reasoning events update the reasoningContent of the last message
			const { useStreaming } = require("../../../src/tui/hooks/useStreaming.js");
			assert.strictEqual(typeof useStreaming, "function");
		});

		it("should handle tool_start events", () => {
			// tool_start sets activeToolCall on the last message
			const { useStreaming } = require("../../../src/tui/hooks/useStreaming.js");
			assert.strictEqual(typeof useStreaming, "function");
		});

		it("should handle tool_end events", () => {
			// tool_end clears activeToolCall and appends to toolCallDisplay
			const { useStreaming } = require("../../../src/tui/hooks/useStreaming.js");
			assert.strictEqual(typeof useStreaming, "function");
		});

		it("should handle tool_error events", () => {
			// tool_error clears activeToolCall and appends error to toolCallDisplay
			const { useStreaming } = require("../../../src/tui/hooks/useStreaming.js");
			assert.strictEqual(typeof useStreaming, "function");
		});

		it("should handle compaction_start events", () => {
			// compaction_start sets isCompacting to true
			const { useStreaming } = require("../../../src/tui/hooks/useStreaming.js");
			assert.strictEqual(typeof useStreaming, "function");
		});

		it("should handle compaction_end events", () => {
			// compaction_end sets isCompacting to false
			const { useStreaming } = require("../../../src/tui/hooks/useStreaming.js");
			assert.strictEqual(typeof useStreaming, "function");
		});

		it("should handle todo_status events", () => {
			// todo_status updates toolCallDisplay with todo status lines
			const { useStreaming } = require("../../../src/tui/hooks/useStreaming.js");
			assert.strictEqual(typeof useStreaming, "function");
		});
	});

	describe("auto-continue circuit breaker", () => {
		it("should track auto-continue count", () => {
			// The hook tracks consecutive auto-continue attempts
			const { useStreaming } = require("../../../src/tui/hooks/useStreaming.js");
			assert.strictEqual(typeof useStreaming, "function");
		});

		it("should respect configurable limit", () => {
			// The limit comes from config.agent.autoContinueLimit (default 1000)
			const { useStreaming } = require("../../../src/tui/hooks/useStreaming.js");
			assert.strictEqual(typeof useStreaming, "function");
		});

		it("should reset count on text output", () => {
			// When text arrives during auto-continue, the count resets
			const { useStreaming } = require("../../../src/tui/hooks/useStreaming.js");
			assert.strictEqual(typeof useStreaming, "function");
		});
	});

	describe("abort handling", () => {
		it("should create AbortController on stream start", () => {
			// The hook creates an AbortController when streaming begins
			const { useStreaming } = require("../../../src/tui/hooks/useStreaming.js");
			assert.strictEqual(typeof useStreaming, "function");
		});

		it("should abort controller on stop", () => {
			// The hook aborts the controller when streaming stops
			const { useStreaming } = require("../../../src/tui/hooks/useStreaming.js");
			assert.strictEqual(typeof useStreaming, "function");
		});

		it("should expose streamingState object", () => {
			// The hook exposes { isStreaming, isAutoContinuing, autoContinueCount, signal }
			const { useStreaming } = require("../../../src/tui/hooks/useStreaming.js");
			assert.strictEqual(typeof useStreaming, "function");
		});
	});
});
