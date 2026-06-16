/**
 * TUI Reducer — handles all state mutations for the TUI.
 * Replaces eight+ independent useState calls with a single reducer.
 */

import { initialState } from './types.js';

/**
 * TUI reducer function.
 * @param {Object} state - Current TUIState
 * @param {Object} action - TUIAction
 * @returns {Object} New TUIState
 */
export function tuiReducer(state, action) {
	switch (action.type) {
		// Messages
		case 'ADD_MESSAGE':
			return {
				...state,
				messages: [...state.messages, action.message],
			};

		case 'UPDATE_MESSAGE': {
			const idx = state.messages.findIndex((m) => m.id === action.id);
			if (idx === -1) return state;
			const updated = [...state.messages];
			updated[idx] = { ...updated[idx], ...action.updates };
			return { ...state, messages: updated };
		}

		case 'CLEAR_MESSAGES':
			return { ...state, messages: [] };

		// Chat History
		case 'ADD_HISTORY':
			return {
				...state,
				chatHistory: [...state.chatHistory, action.text],
				historyIndex: -1,
			};

		case 'SET_HISTORY_INDEX':
			return { ...state, historyIndex: action.index };

		// Input
		case 'SET_INPUT_TEXT':
			return { ...state, inputText: action.text };

		case 'SUBMIT_INPUT':
			return { ...state, inputText: '' };

		case 'SET_INPUT_FOCUSED':
			return { ...state, inputFocused: action.focused };

		// Status
		case 'SET_STATUS':
			return { ...state, statusMessage: action.message };

		case 'SET_CONTEXT_SIZE':
			return { ...state, contextSize: action.size };

		case 'SET_COMPACTING':
			return { ...state, isCompacting: action.compacting };

		// Streaming
		case 'SET_STREAMING':
			return { ...state, isStreaming: action.streaming };

		case 'SET_AUTO_CONTINUING':
			return { ...state, isAutoContinuing: action.autoContinuing };

		case 'INCREMENT_AUTO_CONTINUE':
			return { ...state, autoContinueCount: state.autoContinueCount + 1 };

		case 'RESET_AUTO_CONTINUE':
			return { ...state, autoContinueCount: 0 };

		// Scroll
		case 'SET_SCROLL_OFFSET':
			return { ...state, scrollOffset: action.offset };

		case 'SET_VIEWPORT_HEIGHT':
			return { ...state, viewportHeight: action.height };

		// Config toggles
		case 'TOGGLE_CONFIG': {
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

		case 'SET_CONFIG':
			return {
				...state,
				toggles: { ...state.toggles, ...action.updates },
			};

		// Banner / Onboarding
		case 'SET_SHOW_BANNER':
			return { ...state, showBanner: action.show };

		case 'SET_SHOW_ONBOARDING':
			return { ...state, showOnboarding: action.show };

		case 'SET_ONBOARDING_RESPONSE':
			return { ...state, onboardingResponse: action.response };

		// Unknown action — return current state
		default:
			return state;
	}
}
