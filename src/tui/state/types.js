/**
 * TUI type definitions using JSDoc for type annotations.
 * This module defines the shape of TUI state, action types, and message structure.
 */

/**
 * @typedef {Object} Message
 * @property {"user" | "assistant" | "system"} role - Message role
 * @property {string} content - The message content
 * @property {string} [time] - Timestamp in HH:MM format
 * @property {boolean} [streaming] - Whether currently streaming
 * @property {string} [reasoningContent] - Thinking/thought content for assistant messages
 * @property {{name: string}} [activeToolCall] - Currently running tool
 * @property {string} [toolCallDisplay] - Completed tool calls (multi-line)
 * @property {{name: string}[]} [toolCalls] - Tool call history
 * @property {string} [id] - Stable identifier for memoization
 */

/**
 * @typedef {Object} TUIState
 * @property {Message[]} messages - All messages in the conversation
 * @property {string[]} chatHistory - User command history
 * @property {number} historyIndex - Current position in chat history
 * @property {string} inputText - Current input text
 * @property {boolean} inputFocused - Whether input is focused
 * @property {string} statusMessage - Current status message
 * @property {number} contextSize - Current conversation token count
 * @property {boolean} isCompacting - Whether context compaction is in progress
 * @property {boolean} isStreaming - Whether a stream is active
 * @property {boolean} isAutoContinuing - Whether auto-continue is active
 * @property {number} autoContinueCount - Consecutive empty response count
 * @property {number} scrollOffset - Current scroll position
 * @property {number} viewportHeight - Current viewport height
 * @property {{autoScroll: boolean, timestamps: boolean, commandEcho: boolean, cursorBreathe: boolean, debugOutput: boolean}} toggles - Runtime toggle overrides
 */

/**
 * @typedef {Object} TUIAction
 * @property {string} type - Action type
 * @property {Message} [message] - For ADD_MESSAGE
 * @property {string} [id] - For UPDATE_MESSAGE
 * @property {Partial<Message>} [updates] - For UPDATE_MESSAGE
 * @property {string} [text] - For SET_INPUT_TEXT, ADD_HISTORY
 * @property {number} [index] - For SET_HISTORY_INDEX
 * @property {boolean} [focused] - For SET_INPUT_FOCUSED
 * @property {string} [message] - For SET_STATUS
 * @property {number} [size] - For SET_CONTEXT_SIZE
 * @property {boolean} [compacting] - For SET_COMPACTING
 * @property {boolean} [streaming] - For SET_STREAMING
 * @property {boolean} [autoContinuing] - For SET_AUTO_CONTINUING
 * @property {number} [offset] - For SET_SCROLL_OFFSET
 * @property {number} [height] - For SET_VIEWPORT_HEIGHT
 * @property {keyof TUIState["toggles"]} [key] - For TOGGLE_CONFIG
 * @property {Partial<TUIState["toggles"]>} [updates] - For SET_CONFIG
 */

/**
 * Initial state for the TUI reducer.
 * @type {TUIState}
 */
export const initialState = {
	messages: [],
	chatHistory: [],
	historyIndex: -1,
	inputText: "",
	inputFocused: true,
	statusMessage: "Ready",
	contextSize: 0,
	isCompacting: false,
	isStreaming: false,
	isAutoContinuing: false,
	autoContinueCount: 0,
	scrollOffset: 0,
	viewportHeight: 0,
	toggles: {
		autoScroll: true,
		timestamps: true,
		commandEcho: true,
		cursorBreathe: true,
		debugOutput: false,
	},
};

/**
 * Action type constants.
 * @enum {string}
 */
export const ActionTypes = {
	ADD_MESSAGE: "ADD_MESSAGE",
	UPDATE_MESSAGE: "UPDATE_MESSAGE",
	CLEAR_MESSAGES: "CLEAR_MESSAGES",
	ADD_HISTORY: "ADD_HISTORY",
	SET_HISTORY_INDEX: "SET_HISTORY_INDEX",
	SET_INPUT_TEXT: "SET_INPUT_TEXT",
	SUBMIT_INPUT: "SUBMIT_INPUT",
	SET_INPUT_FOCUSED: "SET_INPUT_FOCUSED",
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
};
