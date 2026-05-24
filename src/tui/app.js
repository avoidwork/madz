import React, { useState } from "react";
import { Box, Text } from "ink";

/**
 * Main App component (Ink). Renders the multi-panel layout:
 * conversation (left), sidebar (right), bottom bar (input + status).
 * Tab/Shift+Tab cycles between panels.
 */
export default function App({ config, registry, sessionState, dispatchProvider, invokeSkill }) {
	const [activePanel, setActivePanel] = useState("conversation");
	const [messages, setMessages] = useState([]);
	const [statusMessage, setStatusMessage] = useState("Ready");

	// Tab-based keyboard navigation between panels (hooked via ink useInput in parent)
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
	const _handleSubmit = async (text) => {
		if (!text) return;
		if (text.startsWith(":")) {
			setStatusMessage(`Command: ${text}`);
			const parts = text.split(/\s+/);
			const cmd = parts[1];
			const args = parts.slice(2).join(" ");
			if (cmd === "quit") {
				process.exit(0);
			} else if (cmd === "status") {
				setStatusMessage("Session active");
			} else if (cmd === "skill" && args) {
				try {
					const result = await invokeSkill(args);
					setMessages((prev) => [...prev, { role: "system", content: result.output }]);
					setStatusMessage(`Skill ${args} executed`);
				} catch (err) {
					setStatusMessage(`Error: ${err.message}`);
				}
			} else {
				setStatusMessage(`Unknown command: ${cmd}`);
			}
		} else {
			const newMsg = { role: "user", content: text };
			setMessages((prev) => [...prev, newMsg]);
			setStatusMessage("Sending...");
			try {
				const response = await dispatchProvider(text, sessionState?.getProvider());
				setMessages((prev) => [...prev, { role: "assistant", content: response.content }]);
				sessionState?.addExchange({ role: "assistant", content: response.content });
				setStatusMessage("Received response");
			} catch (err) {
				setStatusMessage(`Error: ${err.message}`);
			}
		}
	};

	const skillList = registry ? registry.list() : [];
	const configSections = config ? Object.keys(config) : [];

	// Render active panel content
	let panelContent;
	if (activePanel === "conversation") {
		const children = [React.createElement(Text, { bold: true, color: "cyan" }, " Conversation ")];
		if (messages.length === 0) {
			children.push(React.createElement(Text, { gray: true }, " No messages yet. Start chatting!"));
		} else {
			for (let i = 0; i < messages.length; i++) {
				const msg = messages[i];
				children.push(
					React.createElement(
						Box,
						{ key: i, flexDirection: "column" },
						React.createElement(Text, { color: "gray" }, `[${msg.role}]`),
						React.createElement(Text, { wrap: "wrap" }, ` ${msg.content}`),
					),
				);
			}
		}
		panelContent = React.createElement(Box, { flexDirection: "column" }, ...children);
	} else if (activePanel === "skills") {
		const children = [React.createElement(Text, { bold: true, color: "cyan" }, " Skills ")];
		if (skillList.length === 0) {
			children.push(React.createElement(Text, { gray: true }, " No skills registered."));
		} else {
			for (let i = 0; i < skillList.length; i++) {
				children.push(React.createElement(Text, { key: i, wrap: "break" }, ` ${skillList[i]}`));
			}
		}
		panelContent = React.createElement(Box, { flexDirection: "column" }, ...children);
	} else if (activePanel === "memory") {
		panelContent = React.createElement(
			Box,
			{ flexDirection: "column" },
			React.createElement(Text, { bold: true, color: "cyan" }, " Memory "),
			React.createElement(
				Text,
				{ gray: true },
				`${configSections.length} config sections available`,
			),
			React.createElement(Text, { gray: true }, " Use :memory open to view recent entries."),
		);
	} else if (activePanel === "settings") {
		const sectionEls = configSections.map((key) =>
			React.createElement(Text, { key, wrap: "break" }, ` ${key}`),
		);
		panelContent = React.createElement(
			Box,
			{ flexDirection: "column" },
			React.createElement(Text, { bold: true, color: "cyan" }, " Settings "),
			...sectionEls,
			React.createElement(
				Box,
				null,
				React.createElement(Text, { color: "magenta" }, " :config set <key> <value> "),
			),
		);
	}

	// Render sidebar
	const sidebar = React.createElement(
		Box,
		{ flexDirection: "column", width: 35, borderStyle: "single", borderColor: "gray" },
		React.createElement(
			Box,
			null,
			React.createElement(Text, { color: "cyan" }, " Active: "),
			React.createElement(Text, { bold: true }, activePanel),
		),
		React.createElement(
			Box,
			null,
			React.createElement(Text, { color: "cyan" }, " Skills: "),
			React.createElement(Text, null, skillList.length),
		),
		React.createElement(
			Box,
			null,
			React.createElement(Text, { color: "cyan" }, " Messages: "),
			React.createElement(Text, null, messages.length),
		),
		React.createElement(Text, null, " "),
		React.createElement(Box, null, React.createElement(Text, { color: "cyan" }, " Navigation: ")),
		React.createElement(Text, { color: "gray" }, " Tab: next panel"),
		React.createElement(Text, { color: "gray" }, " Shift+Tab: prev"),
		React.createElement(Text, { color: "gray" }, " Enter: send"),
		React.createElement(Text, { color: "gray" }, " Esc: quit"),
		React.createElement(Text, null, " "),
		React.createElement(Text, { color: "green" }, ` ${statusMessage}`),
	);

	// Full render
	return React.createElement(
		Box,
		{ flexDirection: "column", width: "100%", height: "100%" },
		React.createElement(
			Box,
			{ flexDirection: "row", width: "100%" },
			React.createElement(
				Box,
				{ flexDirection: "column", flex: 1, borderStyle: "single", borderColor: "blue" },
				panelContent,
			),
			sidebar,
		),
		React.createElement(
			Box,
			{
				flexDirection: "row",
				width: "100%",
				borderStyle: "double",
				borderColor: "green",
				paddingX: 1,
			},
			React.createElement(Text, null, ` [`),
			React.createElement(Text, { color: "cyan", bold: true }, activePanel),
			React.createElement(Text, null, ":"),
			React.createElement(Text, { color: "yellow" }, " "),
			React.createElement(Text, { color: "gray" }, "_"),
			React.createElement(Text, null, ` ]`),
		),
	);
}
