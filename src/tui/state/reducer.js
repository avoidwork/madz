/**
 * TUI reducer — handles all state transitions for the terminal interface.
 * Consolidates what was previously eight independent useState calls into
 * a single reducer with typed action types.
 */

import { initialState, ActionTypes } from "./types.js";

/**
 * Handle a single action and return the new state.
 * @param {TUIState} state - Current state
 * @param {TUIAction} action - Action to apply
 * @returns {TUIState} New state
 */
export function tuiReducer(state, action) {
	switch (action.type) {
		// Messages
		case ActionTypes.ADD_MESSAGE:
			return {
				...state,
				messages: [...state.messages, action.message],
			};

		case ActionTypes.UPDATE_MESSAGE: {
			const idx = state.messages.findIndex((m) => m.id === action.id);
			if (idx === -1) return state;
			const updated = [...state.messages];
			updated[idx] = { ...updated[idx], ...action.updates };
			return { ...state, messages: updated };
		}

		case ActionTypes.CLEAR_MESSAGES:
			return { ...state, messages: [] };

		case ActionTypes.ADD_HISTORY:
			return {
				...state,
				chatHistory: [...state.chatHistory.filter((l) => l.trim()), action.text],
				historyIndex: -1,
			};

		case ActionTypes.SET_HISTORY_INDEX:
			return { ...state, historyIndex: action.index };

		// Input
		case ActionTypes.SET_INPUT_TEXT:
			return { ...state, inputText: action.text };

		case ActionTypes.SUBMIT_INPUT:
			return { ...state, inputText: "" };

		case ActionTypes.SET_INPUT_FOCUSED:
			return { ...state, inputFocused: action.focused };

		// Status
		case ActionTypes.SET_STATUS:
			return { ...state, statusMessage: action.message };

		case ActionTypes.SET_CONTEXT_SIZE:
			return { ...state, contextSize: action.size };

		case ActionTypes.SET_COMPACTING:
			return { ...state, isCompacting: action.compacting };

		// Streaming
		case ActionTypes.SET_STREAMING:
			return { ...state, isStreaming: action.streaming };

		case ActionTypes.SET_AUTO_CONTINUING:
			return { ...state, isAutoContinuing: action.autoContinuing };

		case ActionTypes.INCREMENT_AUTO_CONTINUE:
			return { ...state, autoContinueCount: state.autoContinueCount + 1 };

		case ActionTypes.RESET_AUTO_CONTINUE:
			return { ...state, autoContinueCount: 0 };

		// Scroll
		case ActionTypes.SET_SCROLL_OFFSET:
			return { ...state, scrollOffset: action.offset };

		case ActionTypes.SET_VIEWPORT_HEIGHT:
			return { ...state, viewportHeight: action.height };

		// Config toggles
		case ActionTypes.TOGGLE_CONFIG: {
			const key = action.key;
			if (!(key in state.toggles)) return state;
			return {
				...state,
				toggles: {
					...state.toggles,
					[key]: !state.toggles[key],
				},
			};
		}

		case ActionTypes.SET_CONFIG:
			return {
				...state,
				toggles: { ...state.toggles, ...action.updates },
			};

		default:
			return state;
	}
}
