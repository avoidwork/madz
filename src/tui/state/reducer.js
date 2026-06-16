/**
 * TUI Reducer — handles all state transitions for the consolidated TUI state.
 * Replaces eight independent useState calls with a single useReducer.
 */
import { initialState, TUIActionType } from "./types.js";

/**
 * Update the last message in the messages array.
 * @param {Array} messages - Current messages array
 * @param {Object} updates - Partial message to merge into the last message
 * @returns {Array} New messages array
 */
export function updateLastMessage(messages, updates) {
	if (messages.length === 0) return messages;
	const cloned = [...messages];
	const last = cloned[cloned.length - 1];
	if (last && last.role === "assistant" && last.streaming) {
		Object.assign(last, updates);
	}
	return cloned;
}

/**
 * TUI reducer — processes all action types and returns a new state.
 * @param {Object} state - Current TUIState
 * @param {Object} action - { type, ...payload }
 * @returns {Object} New TUIState
 */
export function tuiReducer(state, action) {
	switch (action.type) {
		// === Messages ===
		case TUIActionType.ADD_MESSAGE: {
			const newMessage = { ...action.message, time: action.message.time || "" };
			return {
				...state,
				messages: [...state.messages, newMessage],
			};
		}

		case TUIActionType.UPDATE_MESSAGE: {
			const { id, updates } = action;
			return {
				...state,
				messages: state.messages.map((msg) =>
					msg.id === id ? { ...msg, ...updates } : msg
				),
			};
		}

		case TUIActionType.CLEAR_MESSAGES:
			return {
				...state,
				messages: [],
				statusMessage: "Conversation cleared.",
			};

		case TUIActionType.ADD_HISTORY:
			return {
				...state,
				chatHistory: [...state.chatHistory, action.text],
				historyIndex: -1,
			};

		case TUIActionType.SET_HISTORY_INDEX:
			return {
				...state,
				historyIndex: action.index,
			};

		// === Input ===
		case TUIActionType.SET_INPUT_TEXT:
			return {
				...state,
				inputText: action.text,
			};

		case TUIActionType.SUBMIT_INPUT:
			return {
				...state,
				inputText: "",
			};

		case TUIActionType.SET_INPUT_FOCUSED:
			return {
				...state,
				inputFocused: action.focused,
			};

		// === Status ===
		case TUIActionType.SET_STATUS:
			return {
				...state,
				statusMessage: action.message,
			};

		case TUIActionType.SET_CONTEXT_SIZE:
			return {
				...state,
				contextSize: action.size,
			};

		case TUIActionType.SET_COMPACTING:
			return {
				...state,
				isCompacting: action.compacting,
			};

		// === Streaming ===
		case TUIActionType.SET_STREAMING:
			return {
				...state,
				isStreaming: action.streaming,
			};

		case TUIActionType.SET_AUTO_CONTINUING:
			return {
				...state,
				isAutoContinuing: action.autoContinuing,
			};

		case TUIActionType.INCREMENT_AUTO_CONTINUE:
			return {
				...state,
				autoContinueCount: state.autoContinueCount + 1,
			};

		case TUIActionType.RESET_AUTO_CONTINUE:
			return {
				...state,
				autoContinueCount: 0,
			};

		// === Scroll ===
		case TUIActionType.SET_SCROLL_OFFSET:
			return {
				...state,
				scrollOffset: action.offset,
			};

		case TUIActionType.SET_VIEWPORT_HEIGHT:
			return {
				...state,
				viewportHeight: action.height,
			};

		// === Config ===
		case TUIActionType.TOGGLE_CONFIG: {
			const key = action.key;
			const current = state.toggles[key];
			return {
				...state,
				toggles: {
					...state.toggles,
					[key]: !current,
				},
			};
		}

		case TUIActionType.SET_CONFIG:
			return {
				...state,
				toggles: {
					...state.toggles,
					...action.updates,
				},
			};

		default:
			return state;
	}
}
