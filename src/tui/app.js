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
import { SubagentsPanel } from "./subagentsPanel.js";
import { updateSubagentStore } from "./subagentStore.js";
import { setProjectCwd } from "../workspace/project.js";
import { logger } from "../shared/logger.js";
import { getActiveProviderConfig } from "../provider/index.js";
import { useMouseScroll, scaleScrollDelta } from "./useMouseScroll.js";
import { MouseProvider } from "@ink-tools/ink-mouse";
import { MouseGate } from "./headerClick.js";
import { buildLayout, extractSelection, mapCoordToChar } from "./selectionLayout.js";
import clipboardy from "clipboardy";
import { findLinkAt } from "./linkHit.js";
import { openUrl } from "./openUrl.js";
import { isPrintableKey, routeNavKey, isMouseEnabled, shouldHandleClick } from "./selectMode.js";

/**
 * Change the process working directory, guarding against an invalid target.
 *
 * `process.chdir` throws when the target path does not exist or cannot be
 * entered; we record the failure through the structured logger rather than
 * letting it propagate and crash the TUI (AGENTS.md 1.1 — no silent catch).
 *
 * @param {string} target - The directory to change into
 * @returns {void}
 */
export function safeChdir(target) {
	try {
		process.chdir(target);
	} catch (err) {
		logger.error(`[tui] failed to change cwd to ${target}: ${err.message}`);
	}
}

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
	resumeProvider,
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
	contextLength,
}) {
	const [showBanner, setShowBanner] = useState(true);
	const [showOnboarding, setShowOnboarding] = useState(!!onboarding);
	const [onboardingResponse, setOnboardingResponse] = useState(0);
	// Select mode: opt-in via Tab. Mouse reporting is off so the terminal can
	// do native drag-select; default (false) keeps mouse reporting on.
	const [selectMode, setSelectMode] = useState(false);
	const [currentView, setCurrentView] = useState(PANELS.CONVERSATION);
	const [pendingInput, setPendingInput] = useState("");
	// Input history lives here so it survives InputArea unmounting in panel views.
	const [inputHistory, setInputHistory] = useState([]);
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
	// In-conversation search mode. When active, Ctrl+F toggles it on/off and
	// the search query is forwarded to the MessageList for match highlighting
	// and jump-to-next. Search mode takes precedence over normal input focus.
	const [searchMode, setSearchMode] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	// Subagent store — accumulated subagent activity keyed by namespace. Lifted
	// to App so the SUBAGENTS panel re-renders live as subagents stream. The
	// ConversationArea's streaming handler reports each subagent event here via
	// onSubagentUpdate, which updates this state and re-renders the panel.
	const [subagentStore, setSubagentStore] = useState({});
	const [isStreaming, setIsStreaming] = useState(false);
	const lastInterruptTimeRef = useRef(0);
	const { exit } = useApp();
	const exitRef = useRef(exit);
	exitRef.current = exit;

	const conversationAreaRef = useRef(null);
	const inputAreaRef = useRef(null);
	const subagentsPanelRef = useRef(null);
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
	// Generation counter so a stale effect cleanup never clears a newer handler.
	const authHandlerGenRef = useRef(0);

	const skillCount = registry ? registry.list().length : 0;
	const parser = new CommandParser();
	// Command list for the slash-command autocomplete picker: registered
	// commands plus available skill names, so both appear as suggestions.
	// Sorted alphabetically (case-insensitive) so the picker reads cleanly.
	const commandList = [...parser.listCommands(), ...(registry ? registry.list() : [])].sort(
		(a, b) => a.localeCompare(b),
	);

	// Rolling token budget (tokens/minute) for the active provider, if enabled.
	// Drives the live token counter in the status bar.
	const activeProvider = getActiveProviderConfig(config);
	const tokenBudget = activeProvider?.rateLimit?.maxTokensMinute || 0;
	// Context window size for the active provider, used to color the streaming
	// spinner by context-window utilization. Falls back to 0 (no budget) when
	// the provider does not configure a context window. When the orchestrator
	// resolved the real model context length at init, prefer that value over the
	// configured default so the status bar reflects the live model context.
	const contextWindow = contextLength ?? activeProvider?.contextWindow ?? 0;

	// Stable callbacks — flow context/compacting from ConversationArea into InputArea
	const onContextChange = useCallback((size) => inputAreaRef.current?.setContextSize(size), []);
	const onCompactingChange = useCallback((val) => inputAreaRef.current?.setIsCompacting(val), []);
	const onStreamingChange = useCallback((val) => setIsStreaming(val), []);
	const onInterruptInput = useCallback(() => inputAreaRef.current?.clearInput(), []);
	// Fold a subagent event into the App-level subagent store. Called by the
	// ConversationArea's streaming handler for each subagent_* event. Updating
	// this state re-renders App, which passes the fresh store to the SUBAGENTS
	// panel so it updates live.
	const onSubagentUpdate = useCallback((event) => {
		setSubagentStore((prev) => updateSubagentStore(prev, event));
	}, []);

	/**
	 * onViewChange — switch between conversation and panel views.
	 * The ConversationArea stays mounted across panel views, so the message
	 * list and session state survive the round-trip. No reload is needed on
	 * return — the conversation is already rendered.
	 * @param {string} view - One of PANELS values
	 */
	const handleViewChange = useCallback((view) => {
		setCurrentView(view);
	}, []);

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
		// Append a trailing space so the "/<skill>" token is no longer a slash
		// trigger and the command picker does not immediately re-open — matching
		// the slash autocomplete's replaceCommandToken behavior.
		setPendingInput(`/${skillName} `);
	}, []);

	/**
	 * handleSelectProject — switch to the conversation view and set the active
	 * project directory. The file picker globs this directory, and the status
	 * bar displays it.
	 * @param {string} projectPath - The selected project directory
	 */
	const handleSelectProject = useCallback((projectPath) => {
		setActiveProject(projectPath);
		setProjectCwd(projectPath);
		safeChdir(projectPath);
		setCurrentView(PANELS.CONVERSATION);
		// Silently notify the agent that we're now working in the selected project.
		// The conversation area is unmounted during the panel view, so stage the
		// message and dispatch it once it mounts. Use the absolute path so the
		// agent's downstream path resolution (e.g. agents) is not relative to
		// a mutated process.cwd().
		pendingSilentMessageRef.current = `We are working in ${projectPath}.`;
	}, []);

	/**
	 * handleClearProject — reset the active project to the default (config.cwd)
	 * and return to the conversation view.
	 */
	const handleClearProject = useCallback(() => {
		setActiveProject("");
		setProjectCwd("");
		safeChdir(config.cwd || process.cwd());
		setCurrentView(PANELS.CONVERSATION);
		// Silently notify the agent that we've returned to the root directory.
		pendingSilentMessageRef.current = "We are now working in madz root directory.";
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
			// Cancel any earlier poll so only one runs at a time.
			authPollCancelRef.current?.();
			let cancelled = false;
			authPollCancelRef.current = () => {
				cancelled = true;
			};
			let result;
			try {
				const { pollForToken } = await import("../provider/copilotAuth.js");
				const memoryDir = config?.memory?.directory || "memory/";
				result = await pollForToken(deviceCode, { memoryDir, deploymentType });
			} catch (err) {
				result = { ok: false, error: err?.message || String(err) };
			}
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
		const myGen = ++authHandlerGenRef.current;
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
				// Skip if a newer effect run has since registered its own handler.
				if (authHandlerGenRef.current === myGen) setAuthRequiredHandler(null);
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

			// Interrupt if currently streaming — but skip for view-switching
			// commands (/skills, /subagents, /memories, etc.). Those are pure
			// panel switches and should not kill an in-flight stream.
			if (area.isStreaming?.() && !parser.isViewCommand(trimmed)) {
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
		// Reset the active project so the status bar project indicator is
		// cleared. A new session has no project context, so leaving the prior
		// selection in place would falsely imply one is active.
		setActiveProject("");
		// Restore the process cwd to the configured root, consistent with
		// clearing the active project.
		safeChdir(config.cwd || process.cwd());
	}, [config]);

	/**
	 * handleQuit — App-level exit.
	 */
	const handleQuit = useCallback(() => {
		// Belt and braces: make sure mouse reporting is off even if effect
		// cleanups don't get to run before the process exits.
		try {
			process.stdout.write("\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l");
		} catch {
			// stdout may be closed; nothing to restore
		}
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
	// Scroll the currently visible scrollable view (conversation or subagents)
	// to the bottom after a global collapse toggle reflows content.
	const scrollActiveViewToBottom = () => {
		setTimeout(() => {
			const target =
				currentView === PANELS.SUBAGENTS ? subagentsPanelRef.current : conversationAreaRef.current;
			target?.scrollToBottom?.();
		}, 50);
	};

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

		// Ctrl+r / Ctrl+t toggle the global collapse state for reasoning and
		// tool-call blocks. The state is global: both the conversation view and
		// the SUBAGENTS panel read it. Scroll-to-bottom targets the active view.
		// Return early so the key never reaches the input panel (which would
		// render the letter).
		if (key.ctrl && input === "r") {
			setReasoningCollapsed((prev) => !prev);
			scrollActiveViewToBottom();
			return;
		}
		if (key.ctrl && input === "t") {
			setToolCallCollapsed((prev) => !prev);
			scrollActiveViewToBottom();
			return;
		}

		// Panel view — defer all input to the active panel via its own useInput({ isActive })
		// Each panel handles Escape to return to conversation when appropriate.
		if (currentView !== PANELS.CONVERSATION) {
			return;
		}

		// Conversation view key handling
		// Global keys always handled at app level, regardless of mode
		if (input === "\t" || key.tab) {
			setSelectMode((prev) => !prev);
			return;
		}

		// Bail when the file picker is open — it owns all keystrokes.
		if (inputAreaRef.current?.isPickerOpen?.()) {
			return;
		}

		// Ctrl+F toggles in-conversation search mode. When toggled on, the
		// search input takes precedence over normal input focus; Escape exits
		// search mode and restores the chat input.
		if (key.ctrl && input === "f") {
			setSearchMode((prev) => {
				const next = !prev;
				if (next) {
					setSearchQuery("");
					setSelectMode(false);
				}
				return next;
			});
			return;
		}

		// In search mode, Escape exits search mode before the interrupt handler.
		if (searchMode && key.escape) {
			setSearchMode(false);
			setSearchQuery("");
			conversationAreaRef.current?.clearSearch?.();
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

		// In search mode, Enter jumps to the next match; Shift+Enter jumps to
		// the previous match. The search input's ink-text-input onSubmit is a
		// no-op, so these keys are handled here.
		if (searchMode) {
			if (key.return && !key.shift) {
				conversationAreaRef.current?.searchNext?.();
				return;
			}
			if (key.return && key.shift) {
				conversationAreaRef.current?.searchPrev?.();
				return;
			}
		}

		// Select mode: any printable key exits it and is delivered to the input.
		// The input is unfocused in select mode (it ignores keys), so forward
		// the text explicitly. In search mode the search input is always
		// focused and receives the key itself.
		if (selectMode && isPrintableKey(input, key)) {
			setSelectMode(false);
			if (!searchMode) inputAreaRef.current?.appendInput?.(input);
			return;
		}

		// Mode-aware key routing
		const route = routeNavKey(selectMode, key);
		if (route?.type === "history") {
			inputAreaRef.current?.navigateHistory(route.direction);
		} else if (route?.type === "scroll") {
			// In the SUBAGENTS view, route scroll keys to the subagents panel
			// (which has its own virtualized scroll). Otherwise route to the
			// conversation area.
			const scrollTarget =
				currentView === PANELS.SUBAGENTS ? subagentsPanelRef.current : conversationAreaRef.current;
			const amount = route.unit === "page" ? scrollTarget?.getViewportHeight?.() || 1 : 1;
			scrollTarget?.scrollBy(route.direction * amount);
		}
	});

	const { rows, columns } = useWindowSize();

	// Mouse-wheel scrolling, drag selection and clicks — on by default and
	// off only in select mode (Tab), where mouse events bubble out to the
	// terminal's native handling (drag-select, copy). Handlers are also gated
	// on the conversation view with the file picker closed.
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
		// Mouse reporting is enabled unless select mode is active.
		isMouseEnabled(selectMode),
		// Click (press+release on the same cell, no drag): open a link under the cursor.
		(click) => {
			if (!shouldHandleClick(selectMode, currentView === PANELS.CONVERSATION)) return;
			if (inputAreaRef.current?.isPickerOpen?.()) return;
			const href = findLinkAt(click);
			if (href) openUrl(href);
		},
	);

	// Stable handlers for child components
	const handleInputFocus = useCallback(() => setSelectMode(false), []);
	const handleInputBlur = useCallback(() => setSelectMode(true), []);

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
			onResumeSession: (conversation) =>
				conversationAreaRef.current?.loadConversation(conversation),
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
	} else if (currentView === PANELS.SUBAGENTS) {
		panelComponent = React.createElement(SubagentsPanel, {
			ref: subagentsPanelRef,
			subagentStore,
			reasoningCollapsed,
			toolCallCollapsed,
			onViewChange: handleViewChange,
			activeView: currentView,
		});
	}

	return React.createElement(
		MouseProvider,
		{ autoEnable: false },
		React.createElement(MouseGate, {
			active:
				isMouseEnabled(selectMode) &&
				(currentView === PANELS.CONVERSATION || currentView === PANELS.SUBAGENTS),
		}),
		React.createElement(
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
					: React.createElement(
							Box,
							{ flexDirection: "column", width: "100%", height: rows },
							// ConversationArea stays mounted across panel views so the
							// session (message list, scroll position, streaming state)
							// survives the round-trip. When a panel is active it renders
							// nothing (hidden), so the panel is shown in its place. The
							// app-level key handler gates on `currentView`, so Escape in
							// a panel view only switches back to conversation — it never
							// reaches the interrupt path while a panel is active.
							React.createElement(ConversationArea, {
								ref: conversationAreaRef,
								config,
								registry,
								sessionState,
								dispatchProvider,
								resumeProvider,
								scheduleManager,
								appInfo,
								onSaveSession,
								gcManager,
								gcTrigger,
								onContextChange,
								onCompactingChange,
								onStreamingChange,
								onInterruptInput,
								onSubagentUpdate,
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
								hidden: currentView !== PANELS.CONVERSATION,
							}),
							currentView !== PANELS.CONVERSATION ? panelComponent : null,
						),
			// InputArea — hidden during panel views
			currentView === PANELS.CONVERSATION || showOnboarding
				? React.createElement(InputArea, {
						ref: inputAreaRef,
						history: inputHistory,
						onHistoryChange: setInputHistory,
						onSubmit: handleSubmit,
						onFocus: handleInputFocus,
						onBlur: handleInputBlur,
						selectMode,
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
						searchMode,
						searchQuery,
						onSearchQueryChange: (query) => {
							setSearchQuery(query);
							conversationAreaRef.current?.setSearchQuery?.(query);
						},
						commandList,
						isStreaming,
					})
				: null,
		),
	);
}

export default App;
