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
import { getActiveProviderConfig } from "../provider/index.js";
import { useMouseScroll, scaleScrollDelta } from "./useMouseScroll.js";
import { buildLayout, extractSelection, mapCoordToChar } from "./selectionLayout.js";
import clipboardy from "clipboardy";

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
	authPrompt,
	onboarding,
	onSaveSession,
	gcManager,
	gcTrigger,
	compactContext,
	getContextMessages,
	model,
	systemPrompt,
}) {
	const [showBanner, setShowBanner] = useState(true);
	const [showOnboarding, setShowOnboarding] = useState(!!onboarding);
	const [onboardingResponse, setOnboardingResponse] = useState(0);
	const [inputFocused, setInputFocused] = useState(true);
	const [currentView, setCurrentView] = useState(PANELS.CONVERSATION);
	const [pendingInput, setPendingInput] = useState("");
	const [activeProject, setActiveProject] = useState("");
	// Global collapse toggles for reasoning and tool-call blocks. Toggled by
	// the key handler (ctrl+r / ctrl+t) and threaded down to MessageBubble.
	// Initial state comes from config so the user can set the starting state.
	const [reasoningCollapsed, setReasoningCollapsed] = useState(
		config?.tui?.reasoningCollapsed ?? true,
	);
	const [toolCallCollapsed, setToolCallCollapsed] = useState(
		config?.tui?.toolCallCollapsed ?? true,
	);
	// Current character selection range (global, in the flattened conversation
	// text). Set during a drag and cleared on release.
	const [selection, setSelection] = useState(null);
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
	// Tracks whether the Copilot auth prompt has been emitted, so the effect
	// fires exactly once even though it re-runs as the conversation area mounts
	// (the Banner/Onboarding render before it, leaving the ref null initially).
	const authPromptEmittedRef = useRef(false);
	// Holds the background poll's cancel function so it can be invoked only on
	// unmount. The effect re-runs as the view/banner state changes, and React
	// runs the previous effect's cleanup on every re-run — cancelling the poll
	// there would kill it mid-flight when the user switches views.
	const authPollCancelRef = useRef(null);

	const skillCount = registry ? registry.list().length : 0;
	const parser = new CommandParser();

	// Rolling token budget (tokens/minute) for the active provider, if enabled.
	// Drives the live token counter in the status bar.
	const activeProvider = getActiveProviderConfig(config);
	const tokenBudget = activeProvider?.rateLimit?.maxTokensMinute || 0;
	// Context window size for the active provider, used to color the streaming
	// spinner by context-window utilization. Falls back to 0 (no budget) when
	// the provider does not configure a context window.
	const contextWindow = activeProvider?.contextWindow || 0;

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
		setActiveProject("");
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

	// GitHub Copilot auth prompt. When the active provider is Copilot and no
	// token is present, `authPrompt` carries a live verification URL + user code
	// (acquired on init). Emit it as a system message once the conversation area
	// is mounted, then poll in the background until the user authorizes (or the
	// device code expires). This is the chat-only path — the user has no CLI.
	// When `authPrompt.error` is set (device-code request failed), emit the
	// static fallback message instead — no polling.
	//
	// The conversation area mounts only after the Banner/Onboarding are
	// dismissed, so `conversationAreaRef.current` is null on the first render.
	// The effect re-runs as `showBanner`/`showOnboarding`/`currentView` change;
	// `authPromptEmittedRef` guarantees the message is emitted exactly once.
	//
	// On a 401 (token expired/invalid), the fetch interceptor clears the token
	// and invokes the registered re-auth handler, which re-acquires a fresh
	// device code and re-emits the prompt + poll.
	const startAuthPoll = useCallback(
		async ({ verificationUri, userCode, deviceCode, deploymentType }) => {
			if (!conversationAreaRef.current) return;
			conversationAreaRef.current.addMessage({
				role: "system",
				content:
					`GitHub Copilot requires authentication.\n` +
					`Open ${verificationUri} and enter code: ${userCode}`,
			});
			let cancelled = false;
			authPollCancelRef.current = () => {
				cancelled = true;
			};
			const { pollForToken } = await import("../provider/copilotAuth.js");
			const memoryDir = config?.memory?.directory || "memory/";
			const result = await pollForToken(deviceCode, { memoryDir, deploymentType });
			if (cancelled) return;
			if (result.ok) {
				conversationAreaRef.current?.addMessage({
					role: "system",
					content: "GitHub Copilot authenticated.",
				});
			} else {
				conversationAreaRef.current?.addMessage({
					role: "system",
					content: `GitHub Copilot authentication failed: ${result.error || "unknown error"}.`,
				});
			}
		},
		[config],
	);

	useEffect(() => {
		if (!authPrompt || !conversationAreaRef.current) return;
		if (authPromptEmittedRef.current) return;
		authPromptEmittedRef.current = true;
		if (authPrompt.error) {
			conversationAreaRef.current.addMessage({
				role: "system",
				content: authPrompt.error,
			});
			return;
		}
		startAuthPoll(authPrompt);
	}, [authPrompt, config, showBanner, showOnboarding, currentView, startAuthPoll]);

	// Register the 401 re-auth handler. When a Copilot request returns 401, the
	// interceptor clears the token and calls this, which re-acquires a fresh
	// device code and re-emits the prompt + poll. Only active when the provider
	// is Copilot.
	useEffect(() => {
		if (activeProvider.type !== "github-copilot") return;
		let disposed = false;
		import("../provider/copilotAuth.js").then(({ setAuthRequiredHandler }) => {
			if (disposed) return;
			setAuthRequiredHandler(async () => {
				const { getAuthPrompt } = await import("../provider/copilotAuth.js");
				const memoryDir = config?.memory?.directory || "memory/";
				const deploymentType = activeProvider.enterpriseUrl
					? activeProvider.enterpriseUrl.replace(/^https?:\/\//i, "").replace(/\/+$/, "")
					: "github.com";
				const prompt = await getAuthPrompt({ deploymentType, memoryDir });
				if (prompt) {
					startAuthPoll(prompt);
				} else {
					conversationAreaRef.current?.addMessage({
						role: "system",
						content: "GitHub Copilot authentication expired. Please restart to re-authenticate.",
					});
				}
			});
		});
		return () => {
			disposed = true;
			import("../provider/copilotAuth.js").then(({ setAuthRequiredHandler }) => {
				setAuthRequiredHandler(null);
			});
		};
	}, [activeProvider, config, startAuthPoll]);

	// Cancel the background auth poll only on unmount — not on re-render.
	useEffect(() => {
		return () => {
			authPollCancelRef.current?.();
		};
	}, []);

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

		// Ctrl+r / Ctrl+t toggle the global collapse state for reasoning and
		// tool-call blocks. Return early so the key never reaches the input
		// panel (which would render the letter).
		if (key.ctrl && input === "r") {
			setReasoningCollapsed((prev) => !prev);
			return;
		}
		if (key.ctrl && input === "t") {
			setToolCallCollapsed((prev) => !prev);
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

	const { rows, columns } = useWindowSize();

	// Mouse-wheel scrolling and drag selection — active only when the
	// conversation panel has focus (inputFocused is false, i.e. tabbed out of
	// the input). When the input panel is focused, mouse reporting is disabled
	// so mouse events bubble out to the terminal's native handling (text
	// selection, link clicks). Also gated on the conversation view with the
	// file picker closed, matching the keyboard scroll routing above.
	useMouseScroll(
		(delta) => {
			if (currentView !== PANELS.CONVERSATION) return;
			if (inputAreaRef.current?.isPickerOpen?.()) return;
			conversationAreaRef.current?.scrollBy(
				scaleScrollDelta(delta, config?.tui?.mouseScrollLines || 1),
			);
		},
		(sel) => {
			if (currentView !== PANELS.CONVERSATION) return;
			if (inputAreaRef.current?.isPickerOpen?.()) return;
			const width = columns || 80;
			const scrollOffset = conversationAreaRef.current?.getScrollOffset?.() || 0;
			const messages = conversationAreaRef.current?.getSelectionMessages?.() || [];
			const layout = buildLayout({ width, scrollOffset, messages });
			const text = extractSelection(layout, sel.start, sel.end);
			if (text) {
				clipboardy.write(text).catch(() => {});
			}
			setSelection(null);
		},
		(sel) => {
			if (currentView !== PANELS.CONVERSATION) return;
			if (inputAreaRef.current?.isPickerOpen?.()) return;
			// Live highlight during the drag: map the current range to a global
			// character range and store it so the message list can render it.
			const width = columns || 80;
			const scrollOffset = conversationAreaRef.current?.getScrollOffset?.() || 0;
			const messages = conversationAreaRef.current?.getSelectionMessages?.() || [];
			const layout = buildLayout({ width, scrollOffset, messages });
			const startIdx = mapCoordToChar(layout, sel.start);
			const endIdx = mapCoordToChar(layout, sel.end);
			if (startIdx !== -1 && endIdx !== -1) {
				const [a, b] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
				setSelection({ start: a, end: b });
			}
		},
		// Enable mouse reporting only when the conversation panel has focus
		// (tabbed out of the input). When the input is focused, mouse events
		// bubble out to the terminal's native handling.
		!inputFocused,
	);

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
							compactContext,
							getContextMessages,
							model,
							systemPrompt,
							activeProject,
							setActiveProject,
							selection,
							reasoningCollapsed,
							toolCallCollapsed,
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
					contextWindow,
					statusBar: config?.tui?.statusBar,
					cwd: activeProject || config?.cwd || process.cwd(),
					activeProject,
				})
			: null,
	);
}

export default App;
