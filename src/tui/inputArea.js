import React, {
	useState,
	useEffect,
	useCallback,
	forwardRef,
	useImperativeHandle,
	useRef,
} from "react";
import { Box } from "ink";
import { StatusBar } from "./statusBar.js";
import { InputPanel } from "./inputPanel.js";
import { FilePicker, shouldOpenPicker } from "./filePicker.js";
import { CommandPicker, shouldOpenCommandPicker } from "./commandPicker.js";
import { QUOTES, getRandomQuoteIndex } from "./quotes.js";
import { getSharedTokenBudget } from "../provider/openai.js";

/** Border color of the input panel in the default (mouse) mode or while searching. */
export const INPUT_BORDER_DEFAULT = "gray";
/** Border color of the input panel when select mode is active. */
export const INPUT_BORDER_SELECT_MODE = "cyan";

/**
 * Pick the input panel border color. Cyan signals select mode (Tab toggled,
 * mouse reporting off so the terminal does native drag-select and copy).
 * @param {boolean} selectMode - Whether select mode is active
 * @param {boolean} [searchMode=false] - Whether the search input is showing
 * @returns {string} Ink border color
 */
export function getSelectModeBorderColor(selectMode, searchMode = false) {
	return selectMode && !searchMode ? INPUT_BORDER_SELECT_MODE : INPUT_BORDER_DEFAULT;
}

/**
 * Whether the main text input should be rendered. It stays mounted in select
 * mode (unfocused) so the user can see where typed keys will land; it is
 * hidden only while a picker or search input owns the bottom of the screen.
 * @param {Object} state
 * @param {boolean} [state.pickerOpen] - File picker open
 * @param {boolean} [state.commandPickerOpen] - Command picker open
 * @param {boolean} [state.searchMode] - Search input showing
 * @returns {boolean} True when the main input should render
 */
export function shouldShowInput({ pickerOpen, commandPickerOpen, searchMode } = {}) {
	return !pickerOpen && !commandPickerOpen && !searchMode;
}

/**
 * InputArea — owns all input and status state.
 * Renders StatusBar and InputPanel.
 * Reads messageCount from a ref exposed by ConversationArea.
 * @type {React.ForwardRefRenderFunction}
 */
const InputArea = forwardRef(function InputArea(
	{
		onSubmit,
		onFocus,
		onBlur,
		selectMode = false,
		skillCount,
		messageCountRef,
		showBanner,
		showOnboarding,
		initialValue = "",
		onInitialValueConsumed,
		appInfo,
		tokenBudget = 0,
		contextWindow = 0,
		statusBar = {},
		cwd,
		activeProject,
		searchMode = false,
		searchQuery = "",
		onSearchQueryChange,
		commandList = [],
		isStreaming = false,
		history: externalHistory,
		onHistoryChange,
	},
	ref,
) {
	const [inputText, setInputText] = useState(initialValue);
	const [historyIndex, setHistoryIndex] = useState(-1);
	// History may be owned by App so it survives unmounts (panel views).
	const [localHistory, setLocalHistory] = useState([]);
	const chatHistory = externalHistory ?? localHistory;
	const setChatHistory = onHistoryChange ?? setLocalHistory;
	const [contextSize, setContextSize] = useState(0);
	const [isCompacting, setIsCompacting] = useState(false);
	const [quoteIndex, setQuoteIndex] = useState(-1);
	const [tokenCount, setTokenCount] = useState(0);
	const [pickerOpen, setPickerOpen] = useState(false);
	const pickerOpenRef = useRef(false);
	const [commandPickerOpen, setCommandPickerOpen] = useState(false);
	const commandPickerOpenRef = useRef(false);

	// Keep the ref in sync so the imperative isPickerOpen() reads current state.
	useEffect(() => {
		pickerOpenRef.current = pickerOpen;
	}, [pickerOpen]);

	// Keep the command picker ref in sync.
	useEffect(() => {
		commandPickerOpenRef.current = commandPickerOpen;
	}, [commandPickerOpen]);

	// Open the picker when the input contains a valid `@` trigger token at a
	// word boundary (start of input or preceded by a space) followed by word
	// characters. Once open, keep it open as long as the `@` remains — closing
	// only when the `@` is erased, the user makes a selection, or presses Escape.
	// The gate mirrors `deriveFilter` so it never opens on `@` mid-string (e.g.
	// a git URL like `git@github.com`) or on a bare `@`.
	/* node:coverage disable */
	useEffect(() => {
		if (!shouldOpenPicker(inputText)) {
			setPickerOpen(false);
			return;
		}
		// Already open — keep it open while the `@` remains.
		if (pickerOpenRef.current) {
			return;
		}
		// The pickers are mutually exclusive: don't open over the command picker.
		if (commandPickerOpenRef.current) {
			return;
		}
		setPickerOpen(true);
	}, [inputText]);
	/* node:coverage enable */

	// Open the command picker when the input contains a valid `/` trigger token
	// at a word boundary (start of input or preceded by a space) followed by a
	// non-whitespace character. Once open, keep it open as long as the `/`
	// remains — closing only when the `/` is erased, the user makes a selection,
	// or presses Escape. The gate mirrors `deriveCommandFilter` so it never opens
	// on `/` mid-string (e.g. a URL like `https://example.com`) or on a bare `/`.
	// The command picker and file picker are mutually exclusive — only one can be
	// open at a time.
	/* node:coverage disable */
	useEffect(() => {
		if (!shouldOpenCommandPicker(inputText)) {
			setCommandPickerOpen(false);
			return;
		}
		// Already open — keep it open while the `/` remains.
		if (commandPickerOpenRef.current) {
			return;
		}
		// Close the file picker if it's open — the two are mutually exclusive.
		if (pickerOpenRef.current) {
			setPickerOpen(false);
		}
		setCommandPickerOpen(true);
	}, [inputText]);
	/* node:coverage enable */

	// Consume a pre-loaded initial value once on mount (e.g., skill selection).
	useEffect(() => {
		if (initialValue) {
			onInitialValueConsumed?.();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Rotate the status bar quote at a fixed ~2 minute interval.
	// Only ticks while the status bar is visible (normal mode, not during banner/onboarding).
	const statusBarVisible = !showBanner && !showOnboarding;
	useEffect(() => {
		if (!statusBarVisible) return;

		// Initialize the quote on first visibility.
		setQuoteIndex((prev) => (prev === -1 ? getRandomQuoteIndex(-1) : prev));

		const interval = setInterval(() => {
			setQuoteIndex((prev) => getRandomQuoteIndex(prev));
		}, 120000);

		return () => clearInterval(interval);
	}, [statusBarVisible]);

	// Poll the shared token budget so the status bar shows the live rolling
	// window (tokens added by dispatches, expiring after the 60s window).
	// Only ticks while the bar is visible and a budget is configured.
	useEffect(() => {
		if (!statusBarVisible || tokenBudget <= 0) {
			setTokenCount(0);
			return;
		}
		const budget = getSharedTokenBudget(tokenBudget);
		setTokenCount(budget.current());
		const interval = setInterval(() => setTokenCount(budget.current()), 1000);
		return () => clearInterval(interval);
	}, [statusBarVisible, tokenBudget]);

	/**
	 * Handle input-side submit: trim, track in chatHistory, clear input, call onSubmit.
	 */
	const handleSubmit = useCallback(
		(text) => {
			const trimmed = text.trim();
			if (!trimmed) return;

			// Track user input in chat history (non-empty lines only)
			setChatHistory((prev) => {
				const filtered = prev.filter((line) => line.trim());
				return [...filtered, trimmed];
			});
			setHistoryIndex(-1);
			setInputText("");

			// Forward to App's onSubmit (which routes to ConversationArea)
			onSubmit(trimmed);
		},
		[onSubmit],
	);

	// Expose imperative methods to App
	useImperativeHandle(ref, () => ({
		navigateHistory: (direction) => {
			if (direction === "up") {
				if (chatHistory.length === 0) return;
				const newIndex =
					historyIndex === -1 ? chatHistory.length - 1 : Math.max(0, historyIndex - 1);
				setHistoryIndex(newIndex);
				setInputText(chatHistory[newIndex]);
			} else if (direction === "down") {
				if (historyIndex === -1) return;
				const nextIndex = historyIndex + 1;
				if (nextIndex >= chatHistory.length) {
					setHistoryIndex(-1);
					setInputText("");
				} else {
					setHistoryIndex(nextIndex);
					setInputText(chatHistory[nextIndex]);
				}
			}
		},
		// Append text typed to leave select mode (the unfocused input ignores keys).
		appendInput: (text) => {
			setHistoryIndex(-1);
			setInputText((prev) => prev + text);
		},
		clearInput: () => setInputText(""),
		setInputText: (text) => setInputText(text),
		getInputText: () => inputText,
		clearHistory: () => {
			setChatHistory([]);
			setHistoryIndex(-1);
		},
		addToHistory: (text) => {
			if (!text?.trim()) return;
			setChatHistory((prev) => {
				const filtered = prev.filter((l) => l.trim());
				return [...filtered, text.trim()];
			});
			setHistoryIndex(-1);
		},
		setContextSize,
		setIsCompacting,
		isPickerOpen: () => pickerOpenRef.current,
	}));

	const messageCount = messageCountRef?.current || 0;

	// Don't render during banner mode
	if (showBanner && !showOnboarding) return null;

	return React.createElement(
		React.Fragment,
		null,
		// StatusBar only in normal mode (not during onboarding)
		!showBanner && !showOnboarding
			? React.createElement(StatusBar, {
					isStreaming,
					skillCount,
					messageCount,
					contextSize,
					isCompacting,
					version: appInfo?.version,
					model: appInfo?.model,
					quote: quoteIndex >= 0 ? QUOTES[quoteIndex] : "",
					tokenCount,
					tokenBudget,
					contextWindow,
					statusBar,
					project: activeProject,
				})
			: null,
		// InputPanel in normal mode and during onboarding
		React.createElement(
			Box,
			{
				key: "input-wrapper",
				flexDirection: "column",
			},
			React.createElement(
				Box,
				{
					borderStyle: "round",
					// Cyan signals select mode (mouse reporting off, native selection).
					borderColor: getSelectModeBorderColor(selectMode, searchMode),
					borderTop: true,
					borderBottom: false,
					borderLeft: false,
					borderRight: false,
					paddingX: 1,
					width: "100%",
				},
				shouldShowInput({ pickerOpen, commandPickerOpen, searchMode })
					? React.createElement(InputPanel, {
							// Remount on mode change so the cursor lands at the end of the text.
							key: selectMode ? "input-select-mode" : "input-active",
							value: inputText,
							onChange: setInputText,
							onSubmit: handleSubmit,
							onFocus,
							onBlur,
							focus: !selectMode,
						})
					: null,
				searchMode
					? React.createElement(InputPanel, {
							key: "search-input",
							value: searchQuery,
							onChange: onSearchQueryChange,
							onSubmit: () => {},
							onFocus,
							onBlur,
							focus: true,
							placeholder: "Search...",
						})
					: null,
				pickerOpen
					? React.createElement(FilePicker, {
							value: inputText,
							onChange: setInputText,
							onClose: () => setPickerOpen(false),
							cwd: cwd || process.cwd(),
						})
					: null,
				commandPickerOpen
					? React.createElement(CommandPicker, {
							value: inputText,
							onChange: setInputText,
							onClose: () => setCommandPickerOpen(false),
							commandList,
						})
					: null,
			),
		),
	);
});

export default InputArea;
