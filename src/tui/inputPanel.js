// inputPanel.js - TUI input panel with static cursor
import React from "react";

/**
 * Display-only input panel with static cursor.
 * All input handling is handled by App's single useKeyboard hook.
 * Props:
 *   inputText    - current text being typed (for display)
 *   cursorChar   - character to use as cursor indicator
 */
export function InputPanel({ inputText = "", cursorChar = "\u2588" }) {
	return (
		<box flexDirection="row">
			<text flexGrow={1}>{inputText || ""}</text>
			<text bold>{cursorChar || "\u2588"}</text>
		</box>
	);
}
