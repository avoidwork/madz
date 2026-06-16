/**
 * Tests for TUI reducer — all action types and edge cases.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { tuiReducer, initialState } from "../../../src/tui/state/reducer.js";

describe("tuiReducer", () => {
	it("should return initial state for unknown action", () => {
		const state = tuiReducer(initialState, { type: "UNKNOWN_ACTION" });
		assert.deepStrictEqual(state, initialState);
	});

	it("should ADD_MESSAGE", () => {
		const msg = { role: "user", content: "Hello" };
		const state = tuiReducer(initialState, { type: "ADD_MESSAGE", message: msg });
		assert.strictEqual(state.messages.length, 1);
		assert.deepStrictEqual(state.messages[0], msg);
	});

	it("should UPDATE_MESSAGE by id", () => {
		const state1 = tuiReducer(initialState, {
			type: "ADD_MESSAGE",
			message: { id: "1", role: "assistant", content: "Hello" },
		});
		const state2 = tuiReducer(state1, {
			type: "UPDATE_MESSAGE",
			id: "1",
			updates: { content: "Hello World" },
		});
		assert.strictEqual(state2.messages[0].content, "Hello World");
	});

	it("should not UPDATE_MESSAGE for non-existent id", () => {
		const state1 = tuiReducer(initialState, {
			type: "ADD_MESSAGE",
			message: { id: "1", role: "assistant", content: "Hello" },
		});
		const state2 = tuiReducer(state1, {
			type: "UPDATE_MESSAGE",
			id: "999",
			updates: { content: "Nope" },
		});
		assert.strictEqual(state2.messages[0].content, "Hello");
	});

	it("should CLEAR_MESSAGES", () => {
		const state1 = tuiReducer(initialState, {
			type: "ADD_MESSAGE",
			message: { role: "user", content: "Hello" },
		});
		const state2 = tuiReducer(state1, { type: "CLEAR_MESSAGES" });
		assert.strictEqual(state2.messages.length, 0);
	});

	it("should ADD_HISTORY", () => {
		const state = tuiReducer(initialState, { type: "ADD_HISTORY", text: "test command" });
		assert.deepStrictEqual(state.chatHistory, ["test command"]);
		assert.strictEqual(state.historyIndex, -1);
	});

	it("should SET_HISTORY_INDEX", () => {
		const state1 = tuiReducer(initialState, {
			type: "ADD_HISTORY",
			text: "command1",
		});
		const state2 = tuiReducer(state1, { type: "ADD_HISTORY", text: "command2" });
		const state3 = tuiReducer(state2, { type: "SET_HISTORY_INDEX", index: 0 });
		assert.strictEqual(state3.historyIndex, 0);
	});

	it("should SET_INPUT_TEXT", () => {
		const state = tuiReducer(initialState, { type: "SET_INPUT_TEXT", text: "hello" });
		assert.strictEqual(state.inputText, "hello");
	});

	it("should SUBMIT_INPUT (clear text)", () => {
		const state1 = tuiReducer(initialState, { type: "SET_INPUT_TEXT", text: "hello" });
		const state2 = tuiReducer(state1, { type: "SUBMIT_INPUT" });
		assert.strictEqual(state2.inputText, "");
	});

	it("should SET_INPUT_FOCUSED", () => {
		const state = tuiReducer(initialState, { type: "SET_INPUT_FOCUSED", focused: false });
		assert.strictEqual(state.inputFocused, false);
	});

	it("should SET_STATUS", () => {
		const state = tuiReducer(initialState, { type: "SET_STATUS", message: "Streaming..." });
		assert.strictEqual(state.statusMessage, "Streaming...");
	});

	it("should SET_CONTEXT_SIZE", () => {
		const state = tuiReducer(initialState, { type: "SET_CONTEXT_SIZE", size: 1234 });
		assert.strictEqual(state.contextSize, 1234);
	});

	it("should SET_COMPACTING", () => {
		const state = tuiReducer(initialState, { type: "SET_COMPACTING", compacting: true });
		assert.strictEqual(state.isCompacting, true);
	});

	it("should SET_STREAMING", () => {
		const state = tuiReducer(initialState, { type: "SET_STREAMING", streaming: true });
		assert.strictEqual(state.isStreaming, true);
	});

	it("should SET_AUTO_CONTINUING", () => {
		const state = tuiReducer(initialState, { type: "SET_AUTO_CONTINUING", autoContinuing: true });
		assert.strictEqual(state.isAutoContinuing, true);
	});

	it("should INCREMENT_AUTO_CONTINUE", () => {
		const state1 = tuiReducer(initialState, { type: "INCREMENT_AUTO_CONTINUE" });
		assert.strictEqual(state1.autoContinueCount, 1);
		const state2 = tuiReducer(state1, { type: "INCREMENT_AUTO_CONTINUE" });
		assert.strictEqual(state2.autoContinueCount, 2);
	});

	it("should RESET_AUTO_CONTINUE", () => {
		const state1 = tuiReducer(initialState, { type: "INCREMENT_AUTO_CONTINUE" });
		const state2 = tuiReducer(state1, { type: "RESET_AUTO_CONTINUE" });
		assert.strictEqual(state2.autoContinueCount, 0);
	});

	it("should SET_SCROLL_OFFSET", () => {
		const state = tuiReducer(initialState, { type: "SET_SCROLL_OFFSET", offset: 42 });
		assert.strictEqual(state.scrollOffset, 42);
	});

	it("should SET_VIEWPORT_HEIGHT", () => {
		const state = tuiReducer(initialState, { type: "SET_VIEWPORT_HEIGHT", height: 24 });
		assert.strictEqual(state.viewportHeight, 24);
	});

	it("should TOGGLE_CONFIG (flip boolean)", () => {
		const state1 = tuiReducer(initialState, { type: "TOGGLE_CONFIG", key: "timestamps" });
		assert.strictEqual(state1.toggles.timestamps, false);
		const state2 = tuiReducer(state1, { type: "TOGGLE_CONFIG", key: "timestamps" });
		assert.strictEqual(state2.toggles.timestamps, true);
	});

	it("should TOGGLE_CONFIG ignore unknown key", () => {
		const state = tuiReducer(initialState, { type: "TOGGLE_CONFIG", key: "nonExistent" });
		assert.deepStrictEqual(state.toggles, initialState.toggles);
	});

	it("should SET_CONFIG (partial update)", () => {
		const state = tuiReducer(initialState, {
			type: "SET_CONFIG",
			updates: { autoScroll: false, debugOutput: true },
		});
		assert.strictEqual(state.toggles.autoScroll, false);
		assert.strictEqual(state.toggles.debugOutput, true);
		assert.strictEqual(state.toggles.timestamps, true); // unchanged
	});

	it("should SET_SHOW_BANNER", () => {
		const state = tuiReducer(initialState, { type: "SET_SHOW_BANNER", show: false });
		assert.strictEqual(state.showBanner, false);
	});

	it("should SET_SHOW_ONBOARDING", () => {
		const state = tuiReducer(initialState, { type: "SET_SHOW_ONBOARDING", show: true });
		assert.strictEqual(state.showOnboarding, true);
	});

	it("should SET_ONBOARDING_RESPONSE", () => {
		const state = tuiReducer(initialState, { type: "SET_ONBOARDING_RESPONSE", response: 5 });
		assert.strictEqual(state.onboardingResponse, 5);
	});

	it("should handle concurrent state updates atomically", () => {
		let state = initialState;
		state = tuiReducer(state, { type: "ADD_MESSAGE", message: { role: "user", content: "test" } });
		state = tuiReducer(state, { type: "SET_STATUS", message: "Streaming..." });
		state = tuiReducer(state, { type: "SET_CONTEXT_SIZE", size: 500 });
		state = tuiReducer(state, { type: "SET_STREAMING", streaming: true });

		assert.strictEqual(state.messages.length, 1);
		assert.strictEqual(state.statusMessage, "Streaming...");
		assert.strictEqual(state.contextSize, 500);
		assert.strictEqual(state.isStreaming, true);
	});
});
