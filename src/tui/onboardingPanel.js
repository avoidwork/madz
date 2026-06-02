import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";

const PROGRESS_PREFIX = (current, total) => {
	if (!total || total <= 0) return "";
	return " (" + current + "/" + total + ")";
};

/**
 * Component that renders the contextual onboarding flow.
 * Shows prompts from the onboarding state machine.
 * Input processing is handled by the parent (app.js) through processOnboardingInput.
 * @param {Object} props
 * @param {Object} props.onboarding - Onboarding state machine instance
 * @param {() => void} props.onComplete - Callback when onboarding finishes
 * @param {() => void} props.onExit - Callback when user exits entirely
 */
export function OnboardingPanel({ onboarding, onComplete, _onExit }) {
	const [messages, setMessages] = useState([]);
	const [currentPrompt, setCurrentPrompt] = useState(null);
	const [done, setDone] = useState(false);
	const [transitioned, setTransitioned] = useState(false);

	useEffect(() => {
		if (done || !onboarding || transitioned) return;
		// Auto-advance from INIT to ATTRACTOR if not yet started
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
			return React.createElement(Text, { key: "sys-" + i, color: "yellow" }, msg.content);
		}
		return React.createElement(Text, { key: "msg-" + i, color: "white" }, msg.content);
	});

	children.push(
		React.createElement(
			Text,
			{ key: "prompt", color: "gray" },
			currentPrompt
				? "> " + currentPrompt.prompt + PROGRESS_PREFIX(currentPrompt.current, currentPrompt.total)
				: "",
		),
	);

	return React.createElement(Box, { flexDirection: "column", width: "100%" }, children);
}

/**
 * Generate a timestamp string in HH:MM format.
 * @returns {string}
 */
function getTimestamp() {
	const now = new Date();
	return String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
}
