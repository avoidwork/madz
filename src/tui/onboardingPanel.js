import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";

const BOX_WIDTH = "60";

const PROGRESS_PREFIX = (current, total) => {
	if (!total || total <= 0) return "";
	return " (" + current + "/" + total + ")";
};

export function OnboardingPanel({ onboarding, onComplete, _onExit }) {
	const [messages, setMessages] = useState([]);
	const [currentPrompt, setCurrentPrompt] = useState(null);
	const [done, setDone] = useState(false);
	const [transitioned, setTransitioned] = useState(false);

	useEffect(() => {
		if (done || !onboarding || transitioned) return;
		if (onboarding.getPhase() === "TRANSCEND") {
			setTransitioned(true);
			setDone(true);
			onComplete();
			return;
		}
		if (!onboarding.isStarted()) {
			onboarding.processResponse("continue");
		}
		if (onboarding.getPhase() === "TRANSCEND") {
			setTransitioned(true);
			setDone(true);
			onComplete();
			return;
		}
		const prompt = onboarding.getCurrentPrompt();
		if (prompt && !currentPrompt) {
			setMessages([{ role: "system", content: prompt.prompt, time: getTimestamp() }]);
			setCurrentPrompt(prompt);
		}
	}, [onboarding, done, transitioned, currentPrompt]);

	if (done || transitioned) return null;

	const children = messages.map((msg, i) => {
		if (msg.role === "system") {
			return React.createElement(
				Box,
				{
					key: "sys-" + i,
					borderStyle: "round",
					borderColor: "yellow",
					growDirection: "down",
					width: BOX_WIDTH,
					paddingX: 1,
				},
				React.createElement(Text, { color: "yellow" }, msg.content),
			);
		}
		return React.createElement(Text, { key: "msg-" + i, color: "white" }, msg.content);
	});

	if (currentPrompt) {
		const progress = PROGRESS_PREFIX(currentPrompt.current, currentPrompt.total);
		const promptText = progress ? currentPrompt.prompt + " " + progress : currentPrompt.prompt;
		children.push(
			React.createElement(
				Box,
				{
					key: "prompt-box",
					borderStyle: "round",
					borderColor: "cyan",
					growDirection: "down",
					width: Math.min(BOX_WIDTH, promptText.length + 4),
					paddingX: 1,
				},
				React.createElement(Text, { color: "cyan" }, promptText),
			),
		);
	}

	return React.createElement(
		Box,
		{ flexDirection: "column", width: "100%", flexGrow: 1 },
		children,
	);
}

function getTimestamp() {
	const now = new Date();
	return String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
}
