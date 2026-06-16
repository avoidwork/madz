/**
 * TUI State types and initial state.
 * Centralized state shape for the TUI — replaces scattered useState calls.
 */

/**
 * @typedef {Object} TUIState
 * @property {Array<Object>} messages - Current conversation messages
 * @property {Array<string>} chatHistory - User command history
 * @property {number} historyIndex - Current position in chat history
 * @property {string} inputText - Current input text
 * @property {boolean} inputFocused - Whether input panel has focus
 * @property {string} statusMessage - Current status text
 * @property {number} contextSize - Current conversation token count
 * @property {boolean} isCompacting - Whether context compaction is in progress
 * @property {boolean} isStreaming - Whether streaming is active
 * @property {boolean} isAutoContinuing - Whether auto-continue is active
 * @property {number} autoContinueCount - Consecutive auto-continue count
 * @property {number} scrollOffset - Current scroll position
 * @property {number} viewportHeight - Current viewport height
 * @property {Toggles} toggles - Runtime toggle overrides
 */

/**
 * @typedef {Object} Toggles
 * @property {boolean} autoScroll - Auto-scroll to bottom on new messages
 * @property {boolean} timestamps - Show timestamps on messages
 * @property {boolean} commandEcho - Echo user commands to output
 * @property {boolean} cursorBreathe - Enable breathing cursor model
 * @property {boolean} debugOutput - Show debug-level messages
 */

/**
 * @typedef {
 *   | { type: 'ADD_MESSAGE'; message: Object }
 *   | { type: 'UPDATE_MESSAGE'; id: string; updates: Object }
 *   | { type: 'CLEAR_MESSAGES' }
 *   | { type: 'ADD_HISTORY'; text: string }
 *   | { type: 'SET_HISTORY_INDEX'; index: number }
 *   | { type: 'SET_INPUT_TEXT'; text: string }
 *   | { type: 'SUBMIT_INPUT' }
 *   | { type: 'SET_INPUT_FOCUSED'; focused: boolean }
 *   | { type: 'SET_STATUS'; message: string }
 *   | { type: 'SET_CONTEXT_SIZE'; size: number }
 *   | { type: 'SET_COMPACTING'; compacting: boolean }
 *   | { type: 'SET_STREAMING'; streaming: boolean }
 *   | { type: 'SET_AUTO_CONTINUING'; autoContinuing: boolean }
 *   | { type: 'INCREMENT_AUTO_CONTINUE' }
 *   | { type: 'RESET_AUTO_CONTINUE' }
 *   | { type: 'SET_SCROLL_OFFSET'; offset: number }
 *   | { type: 'SET_VIEWPORT_HEIGHT'; height: number }
 *   | { type: 'TOGGLE_CONFIG'; key: keyof Toggles }
 *   | { type: 'SET_CONFIG'; updates: Partial<Toggles> }
 *   | { type: 'SET_SHOW_BANNER'; show: boolean }
 *   | { type: 'SET_SHOW_ONBOARDING'; show: boolean }
 *   | { type: 'SET_ONBOARDING_RESPONSE'; response: number }
 * } TUIAction
 */

/**
 * Initial state for the TUI.
 */
export const initialState = {
	messages: [],
	chatHistory: [],
	historyIndex: -1,
	inputText: '',
	inputFocused: true,
	statusMessage: 'Ready',
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
	showBanner: true,
	showOnboarding: false,
	onboardingResponse: 0,
};
