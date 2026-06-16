/**
 * OnboardingPanel — first-run onboarding flow.
 */
import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";

const BOX_WIDTH = "60";

const PROGRESS_PREFIX = (current, total) => {
	if (!total || total <= 0) return "";
	return " (" + current + "/" + total + ")";
};

/**
 * Onboarding panel component.
 * @param {Object} props
 * @param {Object} props.onboarding - Onboarding instance
 * @param {number} props.responseId - Response ID for re-rendering
 * @param {Function} props.onComplete - Called when onboarding completes
 * @param {Function} props.onExit - Called when user exits onboarding
 */
export function OnboardingPanel({ onboarding, responseId, onComplete, _onExit }) {
	const [messages, setMessages] = useState([]);
	const [phase, setPhase] = useState(null);

	useEffect(() => {
		if (!onboarding) return;
		const checkPhase = () => {
			const p = onboarding.getPhase();
			if (p !== phase) setPhase(p);
			return p;
		};
		const currentPhase = checkPhase();
		if (currentPhase === "TRANSCEND") {
			onComplete();
			return;
		}
		if (currentPhase === "INIT" && !onboarding.isStarted()) {
			onboarding.processResponse("continue");
		}
		const updatedPhase = checkPhase();
		if (updatedPhase === "TRANSCEND") {
			onComplete();
			return;
		}
		const prompt = onboarding.getCurrentPrompt();
		if (prompt) {
			const progress = PROGRESS_PREFIX(prompt.current, prompt.total);
			setMessages([{ role: "system", content: prompt.prompt, _progress: progress }]);
		}
	}, [onboarding, responseId]);

	if (!phase || phase === "TRANSCEND") return null;

	return React.createElement(
		Box,
		{ flexDirection: "column", width: "100%", flexGrow: 1 },
		messages.map((msg, i) =>
			React.createElement(
				Box,
				{
					key: "msg-" + i,
					borderStyle: "round",
					borderColor: "yellow",
					width: BOX_WIDTH,
					paddingX: 1,
				},
				React.createElement(Text, { color: "yellow" }, (msg.content || "") + (msg._progress || "")),
			),
		),
	);
}
