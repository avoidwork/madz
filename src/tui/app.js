import React, { useState, useRef, useCallback, useEffect } from "react";
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
import { ProjectsPanel } from "./projectsPanel.js";

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
	contextEstimate,
}) {
	const [showBanner, setShowBanner] = useState(true);
	const [showOnboarding, setShowOnboarding] = useState(!!onboarding);
	const [onboardingResponse, setOnboardingResponse] = useState(0);
	const [inputFocused, setInputFocused] = useState(true);
	const [currentView, setCurrentView] = useState(PANELS.CONVERSATION);
	const [pendingInput, setPendingInput] = useState("");
	const [activeProject, setActiveProject] = useState(config?.cwd || process.cwd());
	const lastInterruptTimeRef = useRef(0);
	const { exit } = useApp();
	const exitRef = useRef(exit);
	exitRef.current = exit;

	const conversationAreaRef = useRef(null);
	const inputAreaRef = useRef(null);
	const messageCountRef = useRef(0);
	// Pending silent message to dispatch once the conversation area is mounted.
	// The conversation area unmounts during panel views, so the ref is null when
	// a project is selected/cleared; we stage the message here and dispatch it in
	// an effect once the ref is live.
	const pendingSilentMessageRef = useRef(null);

	const skillCount = registry ? registry.list().length : 0;
	const parser = new CommandParser();

	// Rolling token budget (tokens/minute) for the active provider, if enabled.
	// Drives the live token counter in the status bar.
	const providerName = Object.keys(config?.providers || {})[0] || "openai";
	const tokenBudget = config?.providers?.[providerName]?.rateLimit?.maxTokensMinute || 0;

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
	const handleViewChange = useCallback(
		(view) => {
			setCurrentView(view);
			if (view === PANELS.CONVERSATION && conversationAreaRef.current) {
				const conv = sessionState?.getConversation();
				if (conv && conv.length > 0) {
					conversationAreaRef.current.loadConversation(conv);
				}
			}
		},
		[sessionState],
	);

	/**
	 * handleSelectSkill — switch to the conversation view and pre-load the
	 * "/<skill>" command into the input so the user can hit Enter to execute
	 * or append to it.
	 * @param {string} skillName - The selected skill name
	 */
	const handleSelectSkill = useCallback((skillName) => {
		setCurrentView(PANELS.CONVERSATION);
		// Pre-load the command into the input. InputArea is unmounted during
		// panel views, so set a pending value that it consumes on mount.
		setPendingInput(`/${skillName}`);
		inputAreaRef.current?.setStatusMessage(`Selected ${skillName} — press Enter to run or append.`);
	}, []);

	/**
	 * handleSelectProject — switch to the conversation view and set the active
	 * project directory. The file picker globs this directory, and the status
	 * bar displays it.
	 * @param {string} projectPath - The selected project directory
	 */
	const handleSelectProject = useCallback((projectPath) => {
		setActiveProject(projectPath);
		setCurrentView(PANELS.CONVERSATION);
		inputAreaRef.current?.setStatusMessage(`Active project: ${projectPath}`);
		// Silently notify the agent that we're now working in the selected project.
		// The conversation area is unmounted during the panel view, so stage the
		// message and dispatch it once it mounts. Derive the project name the same
		// way the status bar does — the segment after the last "projects/".
		const projectName = projectPath.includes("projects/")
			? projectPath.slice(projectPath.lastIndexOf("projects/") + "projects/".length)
			: projectPath;
		pendingSilentMessageRef.current = `We are working in projects/${projectName}`;
	}, []);

	/**
	 * handleClearProject — reset the active project to the default (config.cwd)
	 * and return to the conversation view.
	 */
	const handleClearProject = useCallback(() => {
		setActiveProject(config?.cwd || process.cwd());
		setCurrentView(PANELS.CONVERSATION);
		inputAreaRef.current?.setStatusMessage("Active project cleared.");
		// Silently notify the agent that we've returned to the root directory.
		pendingSilentMessageRef.current = "We are now working in madz root directory";
	}, [config]);

	// Dispatch a staged silent message once the conversation area is mounted.
	// This covers project selection/clear, where the view switches from a panel
	// back to the conversation view and the ref is null during the handler.
	useEffect(() => {
		if (pendingSilentMessageRef.current && conversationAreaRef.current) {
			const message = pendingSilentMessageRef.current;
			pendingSilentMessageRef.current = null;
			conversationAreaRef.current.handleChat(message, { silentUser: true });
		}
	}, [currentView]);

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

		// Bail when the file picker is open — it owns all keystrokes.
		if (inputAreaRef.current?.isPickerOpen?.()) {
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
	// Each panel derives its own isActive from the active view name.
	let panelComponent = null;
	if (currentView === PANELS.SKILLS) {
		panelComponent = React.createElement(SkillsPanel, {
			skills: registry ? registry.getCatalog() : [],
			onViewChange: handleViewChange,
			onSelectSkill: handleSelectSkill,
			activeView: currentView,
		});
	} else if (currentView === PANELS.MEMORIES) {
		panelComponent = React.createElement(MemoryPanel, {
			config,
			onViewChange: handleViewChange,
			activeView: currentView,
		});
	} else if (currentView === PANELS.SETTINGS) {
		panelComponent = React.createElement(SettingsPanel, {
			config,
			onViewChange: handleViewChange,
			activeView: currentView,
		});
	} else if (currentView === PANELS.SESSIONS) {
		panelComponent = React.createElement(SessionsPanel, {
			sessionState,
			config,
			onViewChange: handleViewChange,
			activeView: currentView,
		});
	} else if (currentView === PANELS.PROJECTS) {
		panelComponent = React.createElement(ProjectsPanel, {
			cwd: config?.cwd || process.cwd(),
			onViewChange: handleViewChange,
			onSelectProject: handleSelectProject,
			onClearProject: handleClearProject,
			activeView: currentView,
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
							contextEstimate,
							activeProject,
							setActiveProject,
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
					initialValue: pendingInput,
					onInitialValueConsumed: () => setPendingInput(""),
					appInfo,
					tokenBudget,
					statusBar: config?.tui?.statusBar,
					cwd: activeProject || config?.cwd || process.cwd(),
					activeProject,
				})
			: null,
	);
}

export default App;
