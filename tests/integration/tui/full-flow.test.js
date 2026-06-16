/**
 * Integration test for TUI full flow.
 * Tests user input → streaming → message display → command execution.
 */
import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { tuiReducer, initialState } from "../../../src/tui/state/reducer.js";
import { getStatusMessage, getToggleIndicators, hasStreamingMessage } from "../../../src/tui/state/selectors.js";
import { CommandRegistry } from "../../../src/tui/utils/commandParser.js";

describe("TUI Full Flow Integration", () => {
	it("should handle user message flow", () => {
		let state = initialState;

		// User sends message
		state = tuiReducer(state, {
			type: "ADD_MESSAGE",
			message: { role: "user", content: "Hello" },
		});
		assert.strictEqual(state.messages.length, 1);
		assert.strictEqual(state.messages[0].role, "user");

		// Assistant starts streaming
		state = tuiReducer(state, { type: "SET_STREAMING", streaming: true });
		assert.strictEqual(state.isStreaming, true);

		// Text arrives
		state = tuiReducer(state, {
			type: "UPDATE_MESSAGE",
			id: "0",
			updates: { content: "Hello! How can I help?" },
		});

		// Streaming ends
		state = tuiReducer(state, { type: "SET_STREAMING", streaming: false });
		assert.strictEqual(state.isStreaming, false);
	});

	it("should handle command execution flow", () => {
		const registry = new CommandRegistry();

		// Parse /clear command
		const result = registry.parse("/clear", {});
		assert.strictEqual(result.action, "clear");
		assert.strictEqual(result.message, "Conversation cleared.");
	});

	it("should handle toggle flow", () => {
		let state = initialState;

		// Toggle timestamps off
		state = tuiReducer(state, { type: "TOGGLE_CONFIG", key: "timestamps" });
		assert.strictEqual(state.toggles.timestamps, false);

		// Toggle back on
		state = tuiReducer(state, { type: "TOGGLE_CONFIG", key: "timestamps" });
		assert.strictEqual(state.toggles.timestamps, true);
	});

	it("should compute derived status message correctly", () => {
		const compactingState = { ...initialState, isCompacting: true };
		assert.strictEqual(getStatusMessage(compactingState), "Compacting context...");

		const streamingState = { ...initialState, isStreaming: true };
		assert.strictEqual(getStatusMessage(streamingState), "Streaming...");

		const readyState = { ...initialState, statusMessage: "Done" };
		assert.strictEqual(getStatusMessage(readyState), "Done");
	});

	it("should compute toggle indicators", () => {
		const toggles = { autoScroll: true, timestamps: false };
		const indicators = getToggleIndicators(toggles);
		assert.ok(indicators.includes("ts:0"));
		assert.ok(indicators.includes("scroll:1"));
	});

	it("should detect streaming messages", () => {
		const messages = [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi", streaming: true },
		];
		assert.strictEqual(hasStreamingMessage(messages), true);

		const finishedMessages = [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi", streaming: false },
		];
		assert.strictEqual(hasStreamingMessage(finishedMessages), false);
	});

	it("should handle history navigation", () => {
		let state = initialState;

		// Add commands to history
		state = tuiReducer(state, { type: "ADD_HISTORY", text: "command1" });
		state = tuiReducer(state, { type: "ADD_HISTORY", text: "command2" });
		state = tuiReducer(state, { type: "ADD_HISTORY", text: "command3" });

		assert.strictEqual(state.chatHistory.length, 3);
		assert.strictEqual(state.historyIndex, -1);

		// Navigate up
		state = tuiReducer(state, { type: "SET_HISTORY_INDEX", index: 2 });
		assert.strictEqual(state.historyIndex, 2);

		// Navigate down
		state = tuiReducer(state, { type: "SET_HISTORY_INDEX", index: 1 });
		assert.strictEqual(state.historyIndex, 1);
	});

	it("should handle context size updates", () => {
		let state = initialState;
		assert.strictEqual(state.contextSize, 0);

		state = tuiReducer(state, { type: "SET_CONTEXT_SIZE", size: 1234 });
		assert.strictEqual(state.contextSize, 1234);

		state = tuiReducer(state, { type: "SET_CONTEXT_SIZE", size: 5678 });
		assert.strictEqual(state.contextSize, 5678);
	});

	it("should handle auto-continue counting", () => {
		let state = initialState;

		state = tuiReducer(state, { type: "INCREMENT_AUTO_CONTINUE" });
		assert.strictEqual(state.autoContinueCount, 1);

		state = tuiReducer(state, { type: "INCREMENT_AUTO_CONTINUE" });
		assert.strictEqual(state.autoContinueCount, 2);

		state = tuiReducer(state, { type: "RESET_AUTO_CONTINUE" });
		assert.strictEqual(state.autoContinueCount, 0);
	});

	it("should handle complete chat session lifecycle", () => {
		let state = initialState;

		// Initial state
		assert.strictEqual(state.messages.length, 0);
		assert.strictEqual(state.isStreaming, false);
		assert.strictEqual(state.statusMessage, "Ready");

		// User sends message
		state = tuiReducer(state, {
			type: "ADD_MESSAGE",
			message: { role: "user", content: "What's the weather?" },
		});

		// Set streaming
		state = tuiReducer(state, { type: "SET_STREAMING", streaming: true });
		state = tuiReducer(state, { type: "SET_STATUS", message: "Streaming..." });

		// Update message with content
		state = tuiReducer(state, {
			type: "UPDATE_MESSAGE",
			id: "0",
			updates: { content: "It's sunny today." },
		});

		// End streaming
		state = tuiReducer(state, { type: "SET_STREAMING", streaming: false });
		state = tuiReducer(state, { type: "SET_STATUS", message: "Received response" });

		// Verify final state
		assert.strictEqual(state.messages.length, 1);
		assert.strictEqual(state.isStreaming, false);
		assert.strictEqual(state.statusMessage, "Received response");
	});
});
