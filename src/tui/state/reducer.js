/**
 * TUI reducer handling all state transitions.
 * Consolidates eight independent useState calls into a single reducer.
 */
import { initialState, DEFAULT_TOGGLES } from "./types.js";

/**
 * TUI reducer — handles all action types for the TUI state machine.
 * @param {Object} state - Current TUIState
 * @param {Object} action - TUIAction
 * @returns {Object} New TUIState
 */
export function tuiReducer(state, action) {
	switch (action.type) {
		// ── Message actions ──────────────────────────────────────────

		case "ADD_MESSAGE": {
			const newMessage = {
				...action.message,
				id: action.message.id ?? Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
			};
			return { ...state, messages: [...state.messages, newMessage] };
		}

		case "UPDATE_MESSAGE": {
			const { index, updates } = action;
			if (index < 0 || index >= state.messages.length) return state;
			const updatedMessages = [...state.messages];
			updatedMessages[index] = { ...updatedMessages[index], ...updates };
			return { ...state, messages: updatedMessages };
		}

		case "CLEAR_MESSAGES":
			return { ...state, messages: [] };

		// ── Input actions ────────────────────────────────────────────

		case "SET_INPUT_TEXT":
			return { ...state, inputText: action.text };

		case "SUBMIT_INPUT":
			return { ...state, inputText: "", inputFocused: true };

		case "SET_INPUT_FOCUSED":
			return { ...state, inputFocused: action.focused };

		// ── History actions ──────────────────────────────────────────

		case "ADD_HISTORY": {
			const filtered = state.chatHistory.filter((line) => line.trim());
			return {
				...state,
				chatHistory: [...filtered, action.text],
				historyIndex: -1,
			};
		}

		case "SET_HISTORY_INDEX":
			return { ...state, historyIndex: action.index };

		// ── Status actions ───────────────────────────────────────────

		case "SET_STATUS":
			return { ...state, statusMessage: action.message };

		case "SET_CONTEXT_SIZE":
			return { ...state, contextSize: action.size };

		case "SET_COMPACTING":
			return { ...state, isCompacting: action.compacting };

		// ── Streaming actions ────────────────────────────────────────

		case "SET_STREAMING":
			return {
				...state,
				isStreaming: action.streaming,
				isAutoContinuing: false,
			};

		case "SET_AUTO_CONTINUING":
			return { ...state, isAutoContinuing: action.autoContinuing };

		case "INCREMENT_AUTO_CONTINUE":
			return { ...state, autoContinueCount: state.autoContinueCount + 1 };

		case "RESET_AUTO_CONTINUE":
			return { ...state, autoContinueCount: 0 };

		// ── Scroll actions ───────────────────────────────────────────

		case "SET_SCROLL_OFFSET":
			return { ...state, scrollOffset: action.offset };

		case "SET_VIEWPORT_HEIGHT":
			return { ...state, viewportHeight: action.height };

		// ── Config/toggle actions ────────────────────────────────────

		case "TOGGLE_CONFIG": {
			const key = action.key;
			const current = state.toggles[key];
			if (current === undefined) return state;
			return {
				...state,
				toggles: {
					...state.toggles,
					[key]: !current,
				},
			};
		}

		case "SET_CONFIG":
			return {
				...state,
				toggles: {
					...state.toggles,
					...action.config,
				},
			};

		// ── Banner/Onboarding actions ────────────────────────────────

		case "SET_SHOW_BANNER":
			return { ...state, showBanner: action.show };

		case "SET_SHOW_ONBOARDING":
			return { ...state, showOnboarding: action.show };

		case "SET_ONBOARDING_RESPONSE":
			return { ...state, onboardingResponse: action.response };

		// ── Unknown action ───────────────────────────────────────────
		default:
			return state;
	}
}

/**
 * Helper to create an ADD_MESSAGE action with a stable id.
 * @param {Object} message - Message data
 * @returns {Object} ADD_MESSAGE action
 */
export function addMessageAction(message) {
	return {
		type: "ADD_MESSAGE",
		message: {
			...message,
			id: message.id ?? Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
		},
	};
}

/**
 * Helper to create an UPDATE_MESSAGE action.
 * @param {number} index - Message index
 * @param {Object} updates - Fields to update
 * @returns {Object} UPDATE_MESSAGE action
 */
export function updateMessageAction(index, updates) {
	return { type: "UPDATE_MESSAGE", index, updates };
}

/**
 * Get all action type constants (exported for tests).
 */
export const ActionTypes = {
	ADD_MESSAGE: "ADD_MESSAGE",
	UPDATE_MESSAGE: "UPDATE_MESSAGE",
	CLEAR_MESSAGES: "CLEAR_MESSAGES",
	SET_INPUT_TEXT: "SET_INPUT_TEXT",
	SUBMIT_INPUT: "SUBMIT_INPUT",
	SET_INPUT_FOCUSED: "SET_INPUT_FOCUSED",
	ADD_HISTORY: "ADD_HISTORY",
	SET_HISTORY_INDEX: "SET_HISTORY_INDEX",
	SET_STATUS: "SET_STATUS",
	SET_CONTEXT_SIZE: "SET_CONTEXT_SIZE",
	SET_COMPACTING: "SET_COMPACTING",
	SET_STREAMING: "SET_STREAMING",
	SET_AUTO_CONTINUING: "SET_AUTO_CONTINUING",
	INCREMENT_AUTO_CONTINUE: "INCREMENT_AUTO_CONTINUE",
	RESET_AUTO_CONTINUE: "RESET_AUTO_CONTINUE",
	SET_SCROLL_OFFSET: "SET_SCROLL_OFFSET",
	SET_VIEWPORT_HEIGHT: "SET_VIEWPORT_HEIGHT",
	TOGGLE_CONFIG: "TOGGLE_CONFIG",
	SET_CONFIG: "SET_CONFIG",
	SET_SHOW_BANNER: "SET_SHOW_BANNER",
	SET_SHOW_ONBOARDING: "SET_SHOW_ONBOARDING",
	SET_ONBOARDING_RESPONSE: "SET_ONBOARDING_RESPONSE",
};
