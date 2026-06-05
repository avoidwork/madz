// onboardingPanel.js - TUI onboarding panel
import React, { useState, useEffect } from "react";

const BOX_WIDTH = 60;

const PROGRESS_PREFIX = (current, total) => {
	if (!total || total <= 0) return "";
	return " (" + current + "/" + total + ")";
};

/**
 * Onboarding panel for initial user profile setup.
 * @param {object} props
 * @param {object} props.onboarding
 * @param {() => void} props.onComplete
 * @param {number} props.responseId
 */
export function OnboardingPanel({ onboarding, onComplete, _onExit, responseId }) {
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

	const msgEl =
		messages.length > 0
			? messages.map((msg, i) => (
					<box
						key={"msg-" + i}
						borderStyle="rounded"
						borderColor="#FFFF00"
						width={BOX_WIDTH}
						paddingX={1}
					>
						<text fg="#FFFF00">{(msg.content || "") + (msg._progress || "")}</text>
					</box>
				))
			: null;

	return (
		<box flexDirection="column" width="100%" flexGrow={1}>
			{msgEl}
		</box>
	);
}
