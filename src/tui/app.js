import React, { useState, useRef, useCallback } from "react";
import { Box, useApp, useInput, useWindowSize } from "ink";
import ConversationArea from "./conversationArea.js";
import InputArea from "./inputArea.js";
import { Banner } from "./banner.js";
import { OnboardingPanel } from "./onboardingPanel.js";
import { CommandParser } from "./commandParser.js";
import { PANELS } from "./panels.js";
import { SkillsPanel } from "./skillsPanel.js";
import { MemoryPanel } from "./memoryPanel.js";
import { SettingsPanel } from "./settingsPanel.js";
import { SessionsPanel } from "./sessionsPanel.js";

/**
 * App router — holds cross-cutting state and view routing.
 * Renders ConversationArea + InputArea in conversation view,
 * or a panel component in panel views.
 */
function App({
	config,
	registry,
	sessionState,
	dispatchProvider,
	scheduleManager,
	appInfo,
	onboarding,
	onSaveSession,
	gcManager,
	gcTrigger,
}) {
	const [showBanner, setShowBanner] = useState(true);
	const [showOnboarding, setShowOnboarding] = useState(!!onboarding);
	const [onboardingResponse, setOnboardingResponse] = useState(0);
	const [inputFocused, setInputFocused] = useState(true);
	const [currentView, setCurrentView] = useState(PANELS.CONVERSATION);
	const lastInterruptTimeRef = useRef(0);
	const { exit } = useApp();
	const exitRef = useRef(exit);
	exitRef.current = exit;

	const conversationAreaRef = useRef(null);
	const inputAreaRef = useRef(null);
	const messageCountRef = useRef(0);

	const skillCount = registry ? registry.list().length : 0;
	const parser = new CommandParser();

	// Stable callbacks — flow status/context/compacting from ConversationArea into InputArea
	const onStatusChange = useCallback((msg) => inputAreaRef.current?.setStatusMessage(msg), []);
	const onContextChange = useCallback((size) => inputAreaRef.current?.setContextSize(size), []);
	const onCompactingChange = useCallback((val) => inputAreaRef.current?.setIsCompacting(val), []);
	const onInterruptInput = useCallback(() => inputAreaRef.current?.clearInput(), []);

	/**
	 * onViewChange — switch between conversation and panel views.
	 * When returning to conversation view, reload messages from session state
	 * (e.g., after session resume).
	 * @param {string} view - One of PANELS values
	 */
	const handleViewChange = useCallback((view) => {
		setCurrentView(view);
		if (view === PANELS.CONVERSATION && conversationAreaRef.current) {
			const conv = sessionState?.getConversation();
			if (conv && conv.length > 0) {
				conversationAreaRef.current.loadConversation(conv);
			}
		}
	}, [sessionState]);

	/**
	 * handleSubmit — App-level router.
	 * Interrupts if streaming, then routes to handleCommand/handleChat on ConversationArea.
	 */
	const handleSubmit = useCallback(
		async (text) => {
			const trimmed = text.trim();
			if (!trimmed) return;

			const area = conversationAreaRef.current;
			if (!area) return;

			// Interrupt if currently streaming
			if (area.isStreaming?.()) {
				await area.interrupt();
			}

			if (parser.isCommand(trimmed)) {
				await area.handleCommand(trimmed);
			} else {
				gcManager?.();
				await area.handleChat(trimmed);
			}
		},
		[gcManager],
	);

	/**
	 * handleNewSession — App-level router.
	 * Resets both ConversationArea and InputArea.
	 */
	const handleNewSession = useCallback(async () => {
		await conversationAreaRef.current?.newSession();
		inputAreaRef.current?.clearHistory();
	}, []);

	/**
	 * handleQuit — App-level exit.
	 */
	const handleQuit = useCallback(() => {
		exit();
		process.exit(0);
	}, [exit]);

	/**
	 * Process onboarding input.
	 */
	async function processOnboardingInput(text) {
		if (!onboarding || !showOnboarding) return false;
		const trimmed = text.trim();

		if (trimmed === "exit") {
			setShowBanner(true);
			setShowOnboarding(false);
			exitRef.current();
			return true;
		}

		const result = onboarding.processResponse(trimmed);

		if (result.action === "exit") {
			setShowBanner(true);
			setShowOnboarding(false);
			exitRef.current();
			return true;
		}

		if (result.action === "save") {
			const saved = await onboarding.save();
			if (saved) {
				conversationAreaRef.current?.addMessage({
					role: "system",
					content: "Profile saved. Let's get started!",
				});
				setShowBanner(true);
				setShowOnboarding(false);
			}
			return true;
		}

		// Track user input in chat history for normal responses during onboarding
		if (trimmed) {
			inputAreaRef.current?.addToHistory(trimmed);
		}

		// Trigger onboarding panel to refresh with new prompt
		setOnboardingResponse((prev) => prev + 1);

		if (result.action === "nextPrompt" && onboarding) {
			return true;
		}

		return true;
	}

	// Focus-aware key routing
	useInput((input, key) => {
		// Onboarding phase takes priority
		if (showOnboarding) {
			if (key.return && !key.shift) {
				processOnboardingInput(inputAreaRef.current?.getInputText() || "");
				inputAreaRef.current?.clearInput();
			} else if (key.escape) {
				handleQuit();
			}
			return;
		}

		// When banner is showing, any key dismisses it
		if (showBanner) {
			if (key.escape) {
				handleQuit();
				return;
			}
			setShowBanner(false);
		}

		// Panel view — defer all input to the active panel via its own useInput({ isActive })
		// Each panel handles Escape to return to conversation when appropriate.
		if (currentView !== PANELS.CONVERSATION) {
			return;
		}

		// Conversation view key handling
		// Global keys always handled at app level, regardless of focus state
		if (input === "\t" || key.tab) {
			setInputFocused((prev) => !prev);
			return;
		}

		if (key.escape) {
			const now = Date.now();
			if (now - lastInterruptTimeRef.current < 500) {
				return;
			}
			conversationAreaRef.current?.interrupt();
			lastInterruptTimeRef.current = now;
			return;
		}

		// Focus-aware key routing
		if (inputFocused) {
			if (key.upArrow) {
				inputAreaRef.current?.navigateHistory("up");
			} else if (key.downArrow) {
				inputAreaRef.current?.navigateHistory("down");
			}
		} else {
			if (key.upArrow) conversationAreaRef.current?.scrollBy(-1);
			if (key.downArrow) conversationAreaRef.current?.scrollBy(1);
			if (key.pageUp)
				conversationAreaRef.current?.scrollBy(
					-(conversationAreaRef.current?.getViewportHeight?.() || 1),
				);
			if (key.pageDown)
				conversationAreaRef.current?.scrollBy(
					conversationAreaRef.current?.getViewportHeight?.() || 1,
				);
		}
	});

	const { rows } = useWindowSize();

	// Stable handlers for child components
	const handleInputFocus = useCallback(() => setInputFocused(true), []);
	const handleInputBlur = useCallback(() => setInputFocused(false), []);

	// Determine which panel component to render
	let panelComponent = null;
	if (currentView === PANELS.SKILLS) {
		panelComponent = React.createElement(SkillsPanel, {
			skills: registry ? registry.list() : [],
			onViewChange: handleViewChange,
			isActive: currentView !== PANELS.CONVERSATION,
		});
	} else if (currentView === PANELS.MEMORY) {
		panelComponent = React.createElement(MemoryPanel, {
			config,
			onViewChange: handleViewChange,
			isActive: currentView !== PANELS.CONVERSATION,
		});
	} else if (currentView === PANELS.SETTINGS) {
		panelComponent = React.createElement(SettingsPanel, {
			config,
			onViewChange: handleViewChange,
			isActive: currentView !== PANELS.CONVERSATION,
		});
	} else if (currentView === PANELS.SESSIONS) {
		panelComponent = React.createElement(SessionsPanel, {
			sessionState,
			config,
			onViewChange: handleViewChange,
			isActive: currentView !== PANELS.CONVERSATION,
		});
	}

	return React.createElement(
		Box,
		{ flexDirection: "column", width: "100%", height: rows },
		showOnboarding
			? React.createElement(OnboardingPanel, {
					onboarding: onboarding,
					responseId: onboardingResponse,
					onComplete: () => {
						setShowBanner(true);
						setShowOnboarding(false);
					},
					onExit: () => {
						setShowBanner(true);
						setShowOnboarding(false);
					},
				})
			: showBanner
				? React.createElement(Banner, {
						onDismiss: () => setShowBanner(false),
						version: appInfo ? appInfo.version : undefined,
					})
				: currentView !== PANELS.CONVERSATION
					? panelComponent
					: React.createElement(ConversationArea, {
							ref: conversationAreaRef,
							config,
							registry,
							sessionState,
							dispatchProvider,
							scheduleManager,
							appInfo,
							onSaveSession,
							gcManager,
							gcTrigger,
							onStatusChange,
							onContextChange,
							onCompactingChange,
							onInterruptInput,
							onQuit: handleQuit,
							onNewSession: handleNewSession,
							onViewChange: handleViewChange,
							messageCountRef,
						}),
		// InputArea — hidden during panel views
		currentView === PANELS.CONVERSATION || showOnboarding
			? React.createElement(InputArea, {
					ref: inputAreaRef,
					onSubmit: handleSubmit,
					onFocus: handleInputFocus,
					onBlur: handleInputBlur,
					focus: inputFocused,
					skillCount,
					messageCountRef,
					showBanner,
					showOnboarding,
				})
			: null,
	);
}

export default App;
