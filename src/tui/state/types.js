/**
 * TUI State types and initial state.
 * Consolidated state shape replacing eight independent useState calls.
 */

/**
 * Message shape rendered in the conversation panel.
 */
export const MessageShape = {
	role: "user" | "assistant" | "system",
	content: "",
	time: "",
	streaming: false,
	reasoningContent: "",
	activeToolCall: { name: "" },
	toolCallDisplay: "",
	toolCalls: [],
	id: "",
};

/**
 * Runtime toggle configuration.
 */
export const TogglesShape = {
	autoScroll: true,
	timestamps: true,
	commandEcho: true,
	cursorBreathe: true,
	debugOutput: false,
};

/**
 * Complete TUI state shape.
 * All TUI state lives here — one source of truth.
 */
export const TUIStateShape = {
	// Messages
	messages: [],
	chatHistory: [],
	historyIndex: -1,

	// Input
	inputText: "",
	inputFocused: true,

	// Status
	statusMessage: "Ready",
	contextSize: 0,
	isCompacting: false,

	// Streaming
	isStreaming: false,
	isAutoContinuing: false,
	autoContinueCount: 0,

	// Scroll
	scrollOffset: 0,
	viewportHeight: 0,

	// Config overrides (runtime toggles)
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
 */
export const TUIActionType = {
	// Messages
	ADD_MESSAGE: "ADD_MESSAGE",
	UPDATE_MESSAGE: "UPDATE_MESSAGE",
	CLEAR_MESSAGES: "CLEAR_MESSAGES",
	ADD_HISTORY: "ADD_HISTORY",
	SET_HISTORY_INDEX: "SET_HISTORY_INDEX",

	// Input
	SET_INPUT_TEXT: "SET_INPUT_TEXT",
	SUBMIT_INPUT: "SUBMIT_INPUT",
	SET_INPUT_FOCUSED: "SET_INPUT_FOCUSED",

	// Status
	SET_STATUS: "SET_STATUS",
	SET_CONTEXT_SIZE: "SET_CONTEXT_SIZE",
	SET_COMPACTING: "SET_COMPACTING",

	// Streaming
	SET_STREAMING: "SET_STREAMING",
	SET_AUTO_CONTINUING: "SET_AUTO_CONTINUING",
	INCREMENT_AUTO_CONTINUE: "INCREMENT_AUTO_CONTINUE",
	RESET_AUTO_CONTINUE: "RESET_AUTO_CONTINUE",

	// Scroll
	SET_SCROLL_OFFSET: "SET_SCROLL_OFFSET",
	SET_VIEWPORT_HEIGHT: "SET_VIEWPORT_HEIGHT",

	// Config
	TOGGLE_CONFIG: "TOGGLE_CONFIG",
	SET_CONFIG: "SET_CONFIG",
};

/**
 * Initial state object.
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
