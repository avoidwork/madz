import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, render, Text } from "ink";
import { ConversationPanel } from "./conversationPanel.jsx";
import { InputPanel } from "./inputPanel.jsx";

const CONVERSATION_CLEAR = "CONVERSATION_CLEAR";
const CONSOLE_SKILL_PREFIX = "CONSOLE_SKILL_";
const CONSOLE_EXIT = "CONSOLE_EXIT";

/**
 * Main TUI application.
 * @param {Object} config - Project configuration
 * @param {string} sessionId - Thread ID for this session
 * @param {() => Promise<Object>} dispatchProvider - Streaming provider dispatcher
 * @param {() => Promise<Object>} handleConversation - Non-streaming conversation handler
 * @param {(name: string, input?: Object) => Promise<Object>} invokeSkill - Skill invoker
 * @param {Object} sessionState - Session state manager
 * @param {() => void} [onExit] - Optional callback when app exits
 * @returns {{ unmount: () => void }}
 */
export function createApp(
	config,
	sessionId,
	dispatchProvider,
	handleConversation,
	invokeSkill,
	sessionState,
	onExit,
) {
	const { unmount } = render(
		<App
			appName={config.tui?.name || "madz"}
			cursorChar={config.tui?.cursorChar || "\u2588"}
			promptChar={config.tui?.promptChar || ">"}
			sessionId={sessionId}
			dispatchProvider={dispatchProvider}
			handleConversation={handleConversation}
			invokeSkill={invokeSkill}
			sessionState={sessionState}
			onExit={onExit}
		/>,
	);

	return { unmount, sessionId };
}

/**
 * App component composing all TUI panels.
 * @param {Object} props
 * @param {string} props.appName - Display name
 * @param {string} props.promptChar - Prompt character
 * @param {string} props.sessionId - Thread ID
 * @param {() => Promise<Object>} props.dispatchProvider - Streaming provider dispatcher
 * @param {(name: string, input?: Object) => Promise<Object>} props.invokeSkill - Skill invoker
 * @param {Object} props.sessionState - Session state manager
 * @param {() => void} [props.onExit] - Optional callback when app exits
 * @returns {React$Element}
 */
function App({
	appName,
	promptChar,
	sessionId,
	dispatchProvider,
	invokeSkill,
	sessionState,
	onExit,
}) {
	const [messages, setMessages] = useState([]);
	const [input, setInput] = useState("");
	const [hasFocus, setHasFocus] = useState(true);
	const [isStreaming, setIsStreaming] = useState(false);
	const scrollRef = useRef(null);

	// Command history: deduplicated human messages from session state, in reverse order
	const commandHistory = React.useMemo(() => {
		if (!sessionState?.getConversation) return [];
		const conv = sessionState.getConversation();
		const dedup = [];
		const seen = new Set();
		for (let i = conv.length - 1; i >= 0; i--) {
			const msg = conv[i];
			if (msg?.role === "user" && msg?.content && !seen.has(msg.content)) {
				seen.add(msg.content);
				dedup.push(msg.content);
			}
			if (dedup.length >= 20) break;
		}
		return dedup.reverse();
	}, []);

	// Load existing conversation from session state
	useEffect(() => {
		if (sessionState?.getConversation) {
			const conv = sessionState.getConversation();
			if (Array.isArray(conv)) {
				const existing = conv.map((m, i) => ({
					id: `existing-${i}`,
					role: m.role === "user" ? "human" : m.role,
					content: m.content,
					timestamp: m.timestamp,
				}));
				setMessages(existing);
			}
		}
	}, []);

	// Stream callback for dispatchProvider
	const streamCallback = useCallback((event) => {
		setIsStreaming(true);
		if (event.type === "text" && event.text) {
			setMessages((prev) => {
				const lastIdx = prev.length - 1;
				if (prev[lastIdx]?.role === "ai" && prev[lastIdx]?.streaming) {
					const updated = [...prev];
					updated[lastIdx] = {
						...updated[lastIdx],
						content: updated[lastIdx].content + event.text,
					};
					return updated;
				}
				return [
					...prev,
					{
						id: `streaming-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
						role: "ai",
						content: event.text,
						streaming: true,
						toolCalls: prev[lastIdx]?.streaming ? prev[lastIdx].toolCalls : [],
					},
				];
			});
		}
		if (event.type === "tool_start") {
			setMessages((prev) => [
				...prev,
				{
					id: `tool-${Date.now()}-${event.toolCallId}`,
					role: "ai",
					content: "",
					streaming: false,
					toolCalls: [{ id: event.toolCallId, name: event.toolName }],
				},
			]);
		}
		if (event.type === "tool_end") {
			setMessages((prev) =>
				prev.map((m, i) => {
					if (m.id?.startsWith("tool-") && i === prev.length - 1) {
						const existing = m.toolCalls?.[0] || { id: event.toolCallId, name: event.toolName };
						return { ...m, toolCalls: [{ ...existing, duration: undefined }] };
					}
					return m;
				}),
			);
		}
	}, []);

	// Send message handler
	const handleSend = useCallback(
		async (text) => {
			if (!text) return;

			// Console commands from inputPanel (special prefixed strings)
			if (text === CONVERSATION_CLEAR) {
				setMessages([]);
				return;
			}
			if (text === CONSOLE_EXIT) {
				onExit?.();
				return;
			}
			if (text.startsWith(CONSOLE_SKILL_PREFIX)) {
				const skillName = text.slice(CONSOLE_SKILL_PREFIX.length);
				try {
					const result = await invokeSkill(skillName, {});
					const output = typeof result === "string" ? result : JSON.stringify(result, null, 2);
					setMessages((prev) => [
						...prev,
						{
							id: `skill-${Date.now()}`,
							role: "system",
							content: `[Skill ${skillName}]:\n${output}`,
						},
					]);
				} catch (err) {
					setMessages((prev) => [
						...prev,
						{
							id: `skill-error-${Date.now()}`,
							role: "system",
							content: `[Skill ${skillName} error]: ${err.message}`,
						},
					]);
				}
				return;
			}

			// Regular user message
			const userMsg = {
				id: `human-${Date.now()}`,
				role: "human",
				content: text,
			};

			setMessages((prev) => [...prev, userMsg]);
			sessionState.addExchange({ role: "user", content: text });

			try {
				await dispatchProvider(text, streamCallback);
			} catch (err) {
				setMessages((prev) => [
					...prev,
					{ id: `error-${Date.now()}`, role: "system", content: `Error: ${err.message}` },
				]);
				setIsStreaming(false);
			}

			// Mark final streaming block as complete
			setMessages((prev) => {
				const updated = [...prev];
				for (let i = updated.length - 1; i >= 0; i--) {
					if (updated[i]?.streaming) updated[i] = { ...updated[i], streaming: false };
				}
				return updated;
			});
		},
		[dispatchProvider, streamCallback, invokeSkill, sessionState, onExit],
	);

	// Focus toggle via Tab
	const handleToggleFocus = useCallback(() => {
		setHasFocus((v) => !v);
	}, []);

	return (
		<Box flexDirection="column" width="100%" height="100%">
			{/* Header bar */}
			<Box borderTop="single" borderLeft="single" borderRight="single" padLeft={1} padRight={2}>
				<Text color="green">{appName}</Text>
				<Box flexGrow={1} />
				<Text color="gray" dimColor>
					{sessionId}
				</Text>
				{isStreaming && (
					<Text color="green" dimColor>
						{"\u2588"} streaming
					</Text>
				)}
			</Box>

			{/* Conversation panel */}
			<ConversationPanel
				messages={messages}
				scrollRef={scrollRef}
				atBottom
				shouldAutoScroll={hasFocus}
			/>

			{/* Input panel */}
			<Box borderBottom="single" borderLeft="single" borderRight="single">
				<InputPanel
					input={input}
					hasFocus={hasFocus}
					setInput={setInput}
					onSubmit={handleSend}
					onToggleFocus={handleToggleFocus}
					promptChar={promptChar}
					messageHistory={commandHistory}
				/>
			</Box>
		</Box>
	);
}
