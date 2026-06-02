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
	const [pendingPrompt, setPendingPrompt] = useState(null);
	const [done, setDone] = useState(false);

	// Show initial prompt and check for TRANSCEND phase
	useEffect(() => {
		if (done || !onboarding) return;
		if (onboarding.getPhase() === "TRANSCEND") {
			setDone(true);
			onComplete();
		}
	}, [onboarding, done, onComplete]);

	// Show ATTRACTOR prompt on mount
	useEffect(() => {
		if (!pendingPrompt && !done && onboarding) {
			const prompt = onboarding.getCurrentPrompt();
			if (prompt) {
				setMessages([{ role: "system", content: prompt.prompt, time: getTimestamp() }]);
				setPendingPrompt(prompt);
			}
		}
	}, [pendingPrompt, done, onboarding]);

	if (done) return null;

	return React.createElement(
		Box,
		{ flexDirection: "column", width: "100%" },
		messages.map((msg, i) => {
			if (msg.role === "system") {
				return React.createElement(Text, { key: "sys-" + i, color: "yellow" }, msg.content);
			}
			return React.createElement(Text, { key: "msg-" + i, color: "white" }, msg.content);
		}),
		React.createElement(StatusIndicator, { pendingPrompt: pendingPrompt }),
	);
}

/**
 * Status indicator showing current prompt with progress.
 * @param {Object} props
 * @param {Object|null} props.pendingPrompt - Current prompt info
 */
function StatusIndicator({ pendingPrompt }) {
	if (!pendingPrompt) return null;
	const progress = PROGRESS_PREFIX(pendingPrompt.current, pendingPrompt.total);
	return React.createElement(
		Text,
		{ color: "gray" },
		"> " + pendingPrompt.prompt + (progress || ""),
	);
}

/**
 * Generate a timestamp string in HH:MM format.
 * @returns {string}
 */
function getTimestamp() {
	const now = new Date();
	return String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
}
