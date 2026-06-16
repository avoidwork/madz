/**
 * Main App component (Ink) — refactored with useReducer, hooks, and new structure.
 * Renders an IRC-style layout: full-height conversation REPL at top, input bar at bottom.
 */
import React, { useReducer, useEffect, useRef, useCallback } from "react";
import { Box, useWindowSize, useApp, useStdout } from "ink";
import { useCursor } from "ink";
import { CommandRegistry } from "./utils/commandParser.js";
import { ConversationPanel } from "./components/ConversationPanel.js";
import { StatusBar } from "./components/StatusBar.js";
import { InputPanel } from "./components/InputPanel.js";
import { Banner } from "./components/Banner.js";
import { OnboardingPanel } from "./panels/OnboardingPanel.js";
import { tuiReducer, initialState } from "./state/reducer.js";
import { getStatusMessage, getToggleIndicators, hasStreamingMessage } from "./state/selectors.js";
import { useScroll } from "./hooks/useScroll.js";
import { useInputRouting } from "./hooks/useInput.js";
import { useStreaming } from "./hooks/useStreaming.js";
import { createSession } from "../session/factory.js";
import { setConfigValue } from "../config/loader.js";
import { isAvailable, getGcCalls } from "../memory/gc.js";
import { loadSystemPrompt } from "../memory/prompts.js";
import { setTodoStreamingCallback } from "../tools/todo_queue.js";
import { calculateConversationTokens } from "./utils/contextTokens.js";
import { handleToggleCommand } from "./utils/format.js";

/**
 * Main App component.
 */
export default function App({
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
	checkpointer,
}) {
	const [state, dispatch] = useReducer(tuiReducer, initialState);
	const { exit } = useApp();
	const exitRef = useRef(exit);
	exitRef.current = exit;
	const { stdout } = useStdout();
	const { setCursorPosition } = useCursor();

	const skillList = registry ? registry.list() : [];
	const parser = new CommandRegistry();

	// Scroll hook
	const { scrollRef, scrollToBottom, remeasure } = useScroll(dispatch);

	// Terminal resize handling
	useEffect(() => {
		const resizeHandler = () => {
			if (scrollRef.current && stdout.isTTY && !process.env.CI) {
				remeasure();
			}
		};
		stdout.on("resize", resizeHandler);
		return () => stdout.off("resize", resizeHandler);
	}, [stdout, scrollRef, remeasure]);

	// Initialize contextSize from current conversation tokens
	useEffect(() => {
		function onUncaught(err) {
			dispatch((s) => ({
				...s,
				messages: [...s.messages, { role: "system", content: `Uncaught error: ${err.message}` }],
			}));
		}
		function onUnhandled(reason) {
			const msg = reason?.message || String(reason);
			dispatch((s) => ({
				...s,
				messages: [...s.messages, { role: "system", content: `Unhandled rejection: ${msg}` }],
			}));
		}
		process.on("uncaughtException", onUncaught);
		process.on("unhandledRejection", onUnhandled);

		if (sessionState) {
			const conversation = sessionState.getConversation();
			const providerName = sessionState.getProvider();
			const providerConfig = config?.providers?.[providerName] || {};
			const modelName = providerConfig.model || "gpt-4o";
			const encoding = providerConfig.encoding;

			let totalTokens = calculateConversationTokens(conversation, modelName, encoding);
			const systemPrompt = loadSystemPrompt();
			if (systemPrompt) {
				totalTokens += calculateConversationTokens(
					[{ role: "system", content: systemPrompt }],
					modelName,
					encoding,
				);
			}
			dispatch({ type: "SET_CONTEXT_SIZE", size: totalTokens });
		}

		return () => {
			process.off("uncaughtException", onUncaught);
			process.off("unhandledRejection", onUnhandled);
		};
	}, []);

	// Streaming hook
	const getTimestamp = useCallback(() => {
		const now = new Date();
		return String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
	}, []);

	const {
		startStreaming,
		handleAutoContinue,
		finalizeStreaming,
		stopStreaming,
		cleanupAfterStream,
		shouldAbort,
		streamingState,
	} = useStreaming({
		dispatchProvider,
		sessionState,
		config,
		dispatch,
		addMessage: (msg) => {
			const time = getTimestamp();
			dispatch((s) => ({ ...s, messages: [...s.messages, { ...msg, time }] }));
		},
		getTimestamp,
	});

	// Handle streaming interruption
	const handleInterrupt = async () => {
		await stopStreaming();
		cleanupAfterStream({ isAbort: true, sessionState, checkpointer });
	};

	// Handle quit
	const handleQuit = useCallback(() => {
		exit();
		process.exit(0);
	}, [exit]);

	// Handle new session
	const handleNewSession = useCallback(() => {
		const newSession = createSession({ provider: sessionState.getProvider() });
		sessionState.createNewSession(newSession.sessionId);
		dispatch({ type: "SET_COMPACTING", compacting: false });
		dispatch({ type: "CLEAR_MESSAGES" });
		dispatch({ type: "SET_CONTEXT_SIZE", size: 0 });
		dispatch((s) => ({
			...s,
			messages: [
				...s.messages,
				{
					role: "system",
					content: `New session started (thread: ${newSession.sessionId.slice(0, 8)}...).`,
				},
			],
		}));
	}, [sessionState, getTimestamp]);

	// Process onboarding input
	const processOnboardingInput = useCallback(
		(text) => {
			if (!onboarding || !state.showOnboarding) return false;
			const trimmed = text.trim();

			if (trimmed === "exit") {
				dispatch({ type: "SET_SHOW_BANNER", show: true });
				dispatch({ type: "SET_SHOW_ONBOARDING", show: false });
				exitRef.current();
				return true;
			}

			const result = onboarding.processResponse(trimmed);

			if (result.action === "exit") {
				dispatch({ type: "SET_SHOW_BANNER", show: true });
				dispatch({ type: "SET_SHOW_ONBOARDING", show: false });
				exitRef.current();
				return true;
			}

			if (result.action === "save") {
				const saved = onboarding.save();
				if (saved) {
					dispatch((s) => ({
						...s,
						messages: [
							...s.messages,
							{ role: "system", content: "Profile saved. Let's get started!" },
						],
					}));
					dispatch({ type: "SET_SHOW_BANNER", show: true });
					dispatch({ type: "SET_SHOW_ONBOARDING", show: false });
				}
				return true;
			}

			if (trimmed) {
				dispatch({ type: "ADD_HISTORY", text: trimmed });
			}

			dispatch({ type: "SET_ONBOARDING_RESPONSE", response: state.onboardingResponse + 1 });

			if (result.action === "nextPrompt" && onboarding) {
				return true;
			}

			return true;
		},
		[onboarding, state.showOnboarding, state.onboardingResponse, dispatch],
	);

	// Handle chat submission
	const handleChat = useCallback(
		async (text) => {
			if (shouldAbort()) return;
			dispatch({ type: "SET_STATUS", message: "Streaming..." });
			dispatch((s) => ({
				...s,
				messages: [
					...s.messages,
					{ role: "user", content: text, time: getTimestamp() },
				],
			}));

			// Update context size
			if (sessionState) {
				const conversation = sessionState.getConversation();
				const providerName = sessionState.getProvider();
				const providerConfig = config?.providers?.[providerName] || {};
				const modelName = providerConfig.model || "gpt-4o";
				const encoding = providerConfig.encoding;

				let totalTokens = calculateConversationTokens(conversation, modelName, encoding);
				const systemPrompt = loadSystemPrompt();
				if (systemPrompt) {
					totalTokens += calculateConversationTokens(
						[{ role: "system", content: systemPrompt }],
						modelName,
						encoding,
					);
				}
				dispatch({ type: "SET_CONTEXT_SIZE", size: totalTokens });
			}

			gcManager?.();

			try {
				const responseContent = await startStreaming(text);

				// Auto-continue if stalled
				const continued = await handleAutoContinue(responseContent);
				if (continued || shouldAbort()) {
					// Auto-continue handled its own finalization
					return;
				}

				finalizeStreaming(responseContent);

				// Persist to session state
				if (sessionState) {
					sessionState.addExchange({ role: "user", content: text });
					sessionState.addExchange({ role: "assistant", content: responseContent });

					// Recalculate context
					const conversation = sessionState.getConversation();
					const providerName = sessionState.getProvider();
					const providerConfig = config?.providers?.[providerName] || {};
					const modelName = providerConfig.model || "gpt-4o";
					const encoding = providerConfig.encoding;

					let totalTokens = calculateConversationTokens(conversation, modelName, encoding);
					const systemPrompt = loadSystemPrompt();
					if (systemPrompt) {
						totalTokens += calculateConversationTokens(
							[{ role: "system", content: systemPrompt }],
							modelName,
							encoding,
						);
					}
					dispatch({ type: "SET_CONTEXT_SIZE", size: totalTokens });
				}
				if (onSaveSession) onSaveSession();
				gcManager?.();
				dispatch({ type: "SET_STATUS", message: "Received response" });
			} catch (err) {
				if (err.name === "AbortError") {
					cleanupAfterStream({ isAbort: true, sessionState, checkpointer });
				} else {
					if (onSaveSession) onSaveSession();
					dispatch((s) => ({
						...s,
						messages: s.messages.filter((m) => !m.streaming),
					}));
					dispatch({ type: "SET_STATUS", message: "Something went wrong" });
					dispatch((s) => ({
						...s,
						messages: [
							...s.messages,
							{
								role: "system",
								content: `I couldn't connect right now - ${err.message}. Try sending your message again?`,
							},
						],
					}));
				}
			}
		},
		[
			shouldAbort,
			dispatch,
			getTimestamp,
			sessionState,
			config,
			gcManager,
			startStreaming,
			handleAutoContinue,
			finalizeStreaming,
			onSaveSession,
			cleanupAfterStream,
			checkpointer,
		],
	);

	// Handle command submission
	const handleCommand = useCallback(
		async (trimmed) => {
			try {
				dispatch((s) => ({
					...s,
					messages: [
						...s.messages,
						{ role: "user", content: trimmed, time: getTimestamp() },
					],
				}));

				const result = parser.parse(trimmed, {
					_sessionState: sessionState,
					_setConfigValue: (dotPath, valueStr) => {
						if (config) setConfigValue(config, dotPath, valueStr);
					},
					_scheduleList: scheduleManager ? scheduleManager.list() : [],
					_schedulePause: (name) => {
						scheduleManager?.pause(name);
						return scheduleManager.list();
					},
					_scheduleResume: (name) => {
						scheduleManager?.resume(name);
						return scheduleManager.list();
					},
					_gcTrigger: gcTrigger,
					_gcStatus: gcTrigger
						? () => ({
								available: isAvailable(),
								calls: getGcCalls(),
								hourCalls: getGcCalls().length,
							})
						: null,
					_skillList: skillList,
					_executeSkill: (skillName, _args) => {
						const skill = registry.get(skillName);
						if (!skill) {
							return { action: "skill", subAction: "error", message: `Skill "${skillName}" not found.` };
						}
						const body = registry.getSkillBody(skillName);
						return {
							action: "skill",
							subAction: "load",
							name: skillName,
							skillBody: body || "",
							message: body ? `Skill "${skillName}" loaded.\n${body}` : `Skill "${skillName}" loaded. No instructions found.`,
						};
					},
					_toggles: state.toggles,
					_handleToggle: (args, toggles) => handleToggleCommand(args, toggles),
				});

				if (result.action === "quit") {
					handleQuit();
					return;
				}
				if (result.action === "new") {
					handleNewSession();
					return;
				}
				if (result.action === "clear") {
					dispatch({ type: "CLEAR_MESSAGES" });
					if (result.message) {
						dispatch((s) => ({ ...s, statusMessage: result.message }));
					}
					return;
				}
				if (result.action === "unknown") {
					dispatch((s) => ({ ...s, messages: [...s.messages, { role: "system", content: result.message, time: getTimestamp() }] }));
					return;
				}
				if (result.action === "skill" && result.subAction === "load" && result.skillBody) {
					gcManager?.();
					dispatch({ type: "SET_STATUS", message: "Streaming..." });

					if (sessionState) {
						sessionState.addExchange({ role: "user", content: trimmed });
					}

					try {
						const responseContent = await startStreaming(result.skillBody);
						const continued = await handleAutoContinue(responseContent);
						if (continued || shouldAbort()) return;
						finalizeStreaming(responseContent);

						if (sessionState) {
							sessionState.addExchange({ role: "assistant", content: responseContent });
						}
					} catch (err) {
						if (err.name === "AbortError") {
							if (sessionState) sessionState.popExchange();
							cleanupAfterStream({ isAbort: true, sessionState, checkpointer });
						} else {
							dispatch((s) => ({ ...s, messages: s.messages.filter((m) => !m.streaming) }));
							dispatch({ type: "SET_STATUS", message: `Error: ${err.message}` });
						}
					}
					return;
				}

				if (result.message && result.action !== "provider" && result.action !== "schedule" && result.action !== "skill") {
					dispatch((s) => ({
						...s,
						messages: [...s.messages, { role: "system", content: result.message, time: getTimestamp() }],
					}));
				}

				if (result.action === "toggle" && result.toggles) {
					dispatch({ type: "SET_CONFIG", updates: result.toggles });
				}
			} catch (err) {
				dispatch((s) => ({
					...s,
					messages: [...s.messages, { role: "system", content: `Command error: ${err.message}`, time: getTimestamp() }],
				}));
				dispatch({ type: "SET_STATUS", message: "Something went wrong" });
			}
		},
		[
			parser,
			sessionState,
			config,
			scheduleManager,
			gcTrigger,
			skillList,
			registry,
			state.toggles,
			handleQuit,
			handleNewSession,
			dispatch,
			getTimestamp,
			gcManager,
			startStreaming,
			handleAutoContinue,
			finalizeStreaming,
			shouldAbort,
			cleanupAfterStream,
			checkpointer,
		],
	);

	// Handle submit (command or chat)
	const handleSubmit = useCallback(
		async (text) => {
			const trimmed = text.trim();
			if (!trimmed) return;

			if (shouldAbort()) {
				await handleInterrupt();
			}

			dispatch({ type: "ADD_HISTORY", text: trimmed });
			dispatch({ type: "SET_INPUT_TEXT", text: "" });

			if (parser.isCommand(trimmed)) {
				await handleCommand(trimmed);
			} else {
				gcManager?.();
				await handleChat(trimmed);
			}
		},
		[shouldAbort, handleInterrupt, dispatch, parser, handleCommand, handleChat, gcManager],
	);

	// Input routing hook
	useInputRouting({
		showOnboarding: state.showOnboarding,
		processOnboardingInput,
		showBanner: state.showBanner,
		setShowBanner: (show) => dispatch({ type: "SET_SHOW_BANNER", show }),
		handleQuit,
		handleSubmit,
		inputText: state.inputText,
		setInputText: (text) => dispatch({ type: "SET_INPUT_TEXT", text }),
		inputFocused: state.inputFocused,
		setInputFocused: (focused) => dispatch({ type: "SET_INPUT_FOCUSED", focused }),
		chatHistory: state.chatHistory,
		historyIndex: state.historyIndex,
		setHistoryIndex: (index) => dispatch({ type: "SET_HISTORY_INDEX", index }),
		scrollUp: () => scrollRef.current?.scrollBy(-1),
		scrollDown: () => scrollRef.current?.scrollBy(1),
		pageUp: () => {
			const height = scrollRef.current?.getViewportHeight() || 1;
			scrollRef.current?.scrollBy(-height);
		},
		pageDown: () => {
			const height = scrollRef.current?.getViewportHeight() || 1;
			scrollRef.current?.scrollBy(height);
		},
		isStreaming: streamingState.isStreaming,
		handleInterrupt,
	});

	// Cursor management
	useEffect(() => {
		if (state.inputFocused) {
			// Cursor shown at input position — handled by InputPanel
		} else {
			setCursorPosition(undefined);
		}
	}, [state.inputFocused, setCursorPosition]);

	// Auto-scroll on new messages
	useEffect(() => {
		if (state.toggles.autoScroll && state.messages.length > 0) {
			const lastMsg = state.messages[state.messages.length - 1];
			if (lastMsg?.streaming) {
				scrollToBottom();
			}
		}
	}, [state.messages, state.toggles.autoScroll, scrollToBottom]);

	// Status bar props
	const statusProps = {
		skillCount: skillList.length,
		messageCount: state.messages.length,
		contextSize: state.contextSize,
		statusMessage: getStatusMessage(state),
		isCompacting: state.isCompacting,
		toggles: state.toggles,
	};

	const { rows } = useWindowSize();

	return React.createElement(
		Box,
		{ flexDirection: "column", width: "100%", height: rows },
		state.showOnboarding
			? React.createElement(OnboardingPanel, {
					onboarding,
					responseId: state.onboardingResponse,
					onComplete: () => {
						dispatch({ type: "SET_SHOW_BANNER", show: true });
						dispatch({ type: "SET_SHOW_ONBOARDING", show: false });
					},
					onExit: () => {
						dispatch({ type: "SET_SHOW_BANNER", show: true });
						dispatch({ type: "SET_SHOW_ONBOARDING", show: false });
					},
				})
			: state.showBanner
				? React.createElement(Banner, {
						onDismiss: () => dispatch({ type: "SET_SHOW_BANNER", show: false }),
						version: appInfo ? appInfo.version : undefined,
					})
				: React.createElement(
						Box,
						{
							key: "conversation-wrapper",
							flexDirection: "column",
							flexGrow: 1,
							backgroundColor: undefined,
						},
						React.createElement(ConversationPanel, {
							messages: state.messages,
							assistantName: config?.tui?.name || "Assistant",
							scrollRef: scrollRef,
						}),
					),
		!state.showBanner && !state.showOnboarding
			? React.createElement(StatusBar, statusProps)
			: null,
		state.showOnboarding || (!state.showBanner && !state.showOnboarding)
			? React.createElement(
					Box,
					{
						key: "input-wrapper",
						flexDirection: "row",
						paddingX: 1,
						paddingY: 0,
					},
					React.createElement(InputPanel, {
						key: state.inputFocused ? "input-focused" : "input-unfocused",
						inputText: state.inputText,
						cursorChar: config?.tui?.cursorChar ?? "\u2588",
						cursorColor: state.inputFocused ? undefined : "#202020",
					}),
				)
			: null,
	);
}
