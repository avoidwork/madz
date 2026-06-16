/**
 * TUI State types, interfaces, and initial state.
 * Consolidated state management replacing eight independent useState calls.
 */

/**
 * @typedef {Object} Message
 * @property {string} role - "user" | "assistant" | "system"
 * @property {string} content - The message content
 * @property {string} [reasoningContent] - Thinking/thought content for assistant messages
 * @property {Object} [activeToolCall] - {name: string} for assistant when a tool is running
 * @property {string} [toolCallDisplay] - Tool call result strings for assistant messages
 * @property {string} [time] - Timestamp
 * @property {boolean} [streaming] - Whether currently streaming
 * @property {string} [id] - Stable message identifier
 */

/**
 * @typedef {Object} ToggleConfig
 * @property {boolean} autoScroll - Auto-scroll to bottom on new messages
 * @property {boolean} timestamps - Show timestamps on messages
 * @property {boolean} commandEcho - Echo user commands in chat display
 * @property {boolean} cursorBreathe - Animate cursor when input is focused
 * @property {boolean} debugOutput - Show debug information in messages
 */

/**
 * @typedef {Object} TUIState
 * @property {Message[]} messages - Conversation messages
 * @property {string} statusMessage - Current status indicator text
 * @property {number} contextSize - Current conversation token count
 * @property {string[]} chatHistory - User input history for arrow key navigation
 * @property {number} historyIndex - Current position in chat history (-1 = none)
 * @property {string} inputText - Current text in the input field
 * @property {boolean} inputFocused - Whether the input field has focus
 * @property {boolean} isCompacting - Whether context compaction is in progress
 * @property {boolean} isStreaming - Whether a stream is currently active
 * @property {boolean} isAutoContinuing - Whether auto-continue is active
 * @property {number} autoContinueCount - Consecutive empty response count
 * @property {number} scrollOffset - Current scroll position
 * @property {number} viewportHeight - Current viewport height
 * @property {ToggleConfig} toggles - Runtime toggle state
 * @property {boolean} showBanner - Whether the startup banner is showing
 * @property {boolean} showOnboarding - Whether onboarding is active
 * @property {number} onboardingResponse - Onboarding response counter
 */

/**
 * @typedef {
 *   | { type: "ADD_MESSAGE"; message: Message }
 *   | { type: "UPDATE_MESSAGE"; index: number; updates: Partial<Message> }
 *   | { type: "CLEAR_MESSAGES" }
 *   | { type: "SET_INPUT_TEXT"; text: string }
 *   | { type: "SUBMIT_INPUT" }
 *   | { type: "SET_INPUT_FOCUSED"; focused: boolean }
 *   | { type: "ADD_HISTORY"; text: string }
 *   | { type: "SET_HISTORY_INDEX"; index: number }
 *   | { type: "SET_STATUS"; message: string }
 *   | { type: "SET_CONTEXT_SIZE"; size: number }
 *   | { type: "SET_COMPACTING"; compacting: boolean }
 *   | { type: "SET_STREAMING"; streaming: boolean }
 *   | { type: "SET_AUTO_CONTINUING"; autoContinuing: boolean }
 *   | { type: "INCREMENT_AUTO_CONTINUE" }
 *   | { type: "RESET_AUTO_CONTINUE" }
 *   | { type: "SET_SCROLL_OFFSET"; offset: number }
 *   | { type: "SET_VIEWPORT_HEIGHT"; height: number }
 *   | { type: "TOGGLE_CONFIG"; key: keyof ToggleConfig }
 *   | { type: "SET_CONFIG"; config: Partial<ToggleConfig> }
 *   | { type: "SET_SHOW_BANNER"; show: boolean }
 *   | { type: "SET_SHOW_ONBOARDING"; show: boolean }
 *   | { type: "SET_ONBOARDING_RESPONSE"; response: number }
 * } TUIAction
 */

/**
 * Default toggle configuration.
 */
const DEFAULT_TOGGLES = {
	autoScroll: true,
	timestamps: true,
	commandEcho: true,
	cursorBreathe: true,
	debugOutput: false,
};

/**
 * Initial TUI state with all fields and correct defaults.
 */
export const initialState = {
	messages: [],
	statusMessage: "Ready",
	contextSize: 0,
	chatHistory: [],
	historyIndex: -1,
	inputText: "",
	inputFocused: true,
	isCompacting: false,
	isStreaming: false,
	isAutoContinuing: false,
	autoContinueCount: 0,
	scrollOffset: 0,
	viewportHeight: 0,
	toggles: { ...DEFAULT_TOGGLES },
	showBanner: true,
	showOnboarding: false,
	onboardingResponse: 0,
};

/**
 * Default toggle configuration (exported for tests).
 */
export { DEFAULT_TOGGLES };
