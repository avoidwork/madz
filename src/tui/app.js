import React, { useState } from "react";
import { Box, Text } from "ink";

/**
 * Main App component (Ink). Renders the three-panel layout:
 * conversation (left), sidebar (right), bottom bar (input + status).
 * Tab/Shift+Tab cycles between panels.
 */
export default function App({ config, registry, _sessionState, _dispatchProvider, _invokeSkill }) {
	const _exit = useApp();
	const [activePanel, setActivePanel] = useState("conversation");
	const [messages, setMessages] = useState([]);
	const [inputText, setInputText] = useState("");
	const [statusMessage, setStatusMessage] = useState("Ready");

	// Tab-based keyboard navigation between panels
	const _cyclePanel = (direction) => {
		setActivePanel((prev) => {
			const order = ["conversation", "skills", "memory", "settings"];
			const idx = order.indexOf(prev);
			const nextIdx =
				direction === 1 ? (idx + 1) % order.length : (idx - 1 + order.length) % order.length;
			return order[nextIdx];
		});
	};

	// Handle command/message input
	const _handleSubmit = (text) => {
		if (!text) return;
		if (text.startsWith(":")) {
			setStatusMessage(`Command: ${text}`);
			// Command dispatched by command parser in parent
		} else {
			// Send message to conversation
			const newMsg = { role: "user", content: text };
			setMessages((prev) => [...prev, newMsg]);
			setStatusMessage("Sending...");
			// Would call dispatchProvider here
		}
		setInputText("");
	};

	// Get skills list and memory entries from props
	const skillList = registry ? registry.list() : [];
	const configSections = config ? Object.keys(config) : [];

	return (
		<Box flexDirection="column" width="100%" height="100%">
			{/* Main layout: conversation left, sidebar right */}
			<Box flexDirection="row" width="100%">
				{/* Left panel: active content area */}
				<Box flexDirection="column" flex={1} borderStyle="single" borderColor="blue">
					{activePanel === "conversation" && (
						<Box flexDirection="column">
							<Text bold color="cyan">
								{" "}
								Conversation{" "}
							</Text>
							{messages.map((msg, i) => (
								<Box key={i} flexDirection="column">
									<Text color="gray">[{msg.role}]</Text>
									<Text wrap="wrap"> {msg.content}</Text>
								</Box>
							))}
							{messages.length === 0 && <Text gray> No messages yet. Start chatting!</Text>}
						</Box>
					)}
					{activePanel === "skills" && (
						<Box flexDirection="column">
							<Text bold color="cyan">
								{" "}
								Skills{" "}
							</Text>
							{skillList.map((skill, i) => (
								<Text key={i} wrap="break">
									{" "}
									{skill}
								</Text>
							))}
							{skillList.length === 0 && <Text gray> No skills registered.</Text>}
						</Box>
					)}
					{activePanel === "memory" && (
						<Box flexDirection="column">
							<Text bold color="cyan">
								{" "}
								Memory{" "}
							</Text>
							<Text gray> {configSections.length} config sections available</Text>
							<Text gray> Use :memory open to view recent entries.</Text>
						</Box>
					)}
					{activePanel === "settings" && (
						<Box flexDirection="column">
							<Text bold color="cyan">
								{" "}
								Settings{" "}
							</Text>
							{configSections.map((key) => (
								<Text key={key} wrap="break">
									{" "}
									{key}
								</Text>
							))}
							<Box>
								<Text color="magenta"> :config set &lt;key&gt; &lt;value&gt; </Text>
							</Box>
						</Box>
					)}
				</Box>

				{/* Right sidebar: status and info */}
				<Box flexDirection="column" width="35" borderStyle="single" borderColor="gray">
					<Box>
						<Text color="cyan"> Active: </Text>
						<Text bold>{activePanel}</Text>
					</Box>
					<Box>
						<Text color="cyan"> Skills: </Text>
						<Text>{skillList.length}</Text>
					</Box>
					<Box>
						<Text color="cyan"> Messages: </Text>
						<Text>{messages.length}</Text>
					</Box>
					<Text> </Text>
					<Box>
						<Text color="cyan"> Navigation: </Text>
					</Box>
					<Text color="gray"> Tab: next panel</Text>
					<Text color="gray"> Shift+Tab: prev</Text>
					<Text color="gray"> Enter: send</Text>
					<Text color="gray"> Esc: quit</Text>
					<Text> </Text>
					<Text color="green"> {statusMessage} </Text>
				</Box>
			</Box>

			{/* Bottom bar: input */}
			<Box flexDirection="row" width="100%" borderStyle="double" borderColor="green" paddingX={1}>
				<Text>[</Text>
				<Text color="cyan" bold>
					{activePanel}
				</Text>
				<Text>:</Text>
				<Text color="yellow">{inputText}</Text>
				<Text color="gray">_</Text>
			</Box>
		</Box>
	);
}
