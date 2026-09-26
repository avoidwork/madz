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
import { FilePicker } from "./filePicker.js";
import { QUOTES, getRandomQuoteIndex } from "./quotes.js";
import { getSharedTokenBudget } from "../provider/openai.js";

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
		focus,
		skillCount,
		messageCountRef,
		showBanner,
		showOnboarding,
		initialValue = "",
		onInitialValueConsumed,
		appInfo,
		tokenBudget = 0,
		statusBar = {},
	},
	ref,
) {
	const [inputText, setInputText] = useState(initialValue);
	const [historyIndex, setHistoryIndex] = useState(-1);
	const [chatHistory, setChatHistory] = useState([]);
	const [statusMessage, setStatusMessage] = useState("Ready");
	const [contextSize, setContextSize] = useState(0);
	const [isCompacting, setIsCompacting] = useState(false);
	const [quoteIndex, setQuoteIndex] = useState(-1);
	const [tokenCount, setTokenCount] = useState(0);
	const [pickerOpen, setPickerOpen] = useState(false);
	const pickerOpenRef = useRef(false);

	// Keep the ref in sync so the imperative isPickerOpen() reads current state.
	useEffect(() => {
		pickerOpenRef.current = pickerOpen;
	}, [pickerOpen]);

	// Open the picker when the input contains an `@` token with content after it.
	// Once open, keep it open as long as the `@` remains — closing only when
	// the `@` is erased, the user makes a selection, or presses Escape.
	/* node:coverage disable */
	useEffect(() => {
		const lastAt = inputText.lastIndexOf("@");
		if (lastAt === -1) {
			setPickerOpen(false);
			return;
		}
		// Already open — keep it open while the `@` remains.
		if (pickerOpenRef.current) {
			return;
		}
		// Initial open: require `@` followed by content.
		// The token is bounded by whitespace (unquoted) or quotes (quoted).
		let end = lastAt + 1;
		let quoted = false;
		while (end < inputText.length) {
			const ch = inputText[end];
			if (ch === '"') {
				quoted = !quoted;
				end++;
				continue;
			}
			if (!quoted && /\s/.test(ch)) {
				break;
			}
			end++;
		}
		const token = inputText.slice(lastAt, end);
		setPickerOpen(token.length > 1);
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
		setStatusMessage,
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
					statusMessage,
					skillCount,
					messageCount,
					contextSize,
					isCompacting,
					version: appInfo?.version,
					model: appInfo?.model,
					quote: quoteIndex >= 0 ? QUOTES[quoteIndex] : "",
					tokenCount,
					tokenBudget,
					statusBar,
				})
			: null,
		// InputPanel in normal mode and during onboarding
		React.createElement(
			Box,
			{
				key: "input-wrapper",
				flexDirection: "column",
				paddingX: 1,
				paddingY: 0,
			},
			React.createElement(InputPanel, {
				key: focus ? "input-focused" : "input-unfocused",
				value: inputText,
				onChange: setInputText,
				onSubmit: handleSubmit,
				onFocus,
				onBlur,
				focus: focus && !pickerOpen,
			}),
			pickerOpen
				? React.createElement(FilePicker, {
						value: inputText,
						onChange: setInputText,
						onClose: () => setPickerOpen(false),
						cwd: process.cwd(),
					})
				: null,
		),
	);
});

export default InputArea;
