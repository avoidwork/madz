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
		if (prompt) {
			const progress = PROGRESS_PREFIX(prompt.current, prompt.total);
			setMessages([
				{ role: "system", content: prompt.prompt, _progress: progress, time: getTimestamp() },
			]);
			setCurrentPrompt(prompt);
		}
	}, [onboarding, done, transitioned, currentPrompt]);

	if (done || transitioned) return null;

	const children = messages.map((msg, i) => {
		const progress = msg._progress || "";
		return React.createElement(
			Box,
			{
				key: "msg-" + i,
				borderStyle: "round",
				borderColor: "yellow",
				growDirection: "down",
				width: BOX_WIDTH,
				paddingX: 1,
			},
			React.createElement(Text, { color: "yellow" }, (msg.content || "") + (progress || "")),
		);
	});

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
