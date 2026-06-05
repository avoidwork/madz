// statusBar.js - TUI status bar
import React from "react";

/**
 * Get connection status indicator and color based on status message.
 * @param {string} status
 * @returns {{ indicator: string, color: string }}
 */
function getStatusIndicator(status) {
	if (status.startsWith("Error")) {
		return { indicator: "\u2716", color: "#FF0000" };
	}
	if (status === "Sending..." || status === "Streaming...") {
		return { indicator: "\u25B6", color: "#FFFF00" };
	}
	return { indicator: "\u25CF", color: "#00FF00" };
}

/**
 * Bottom status bar.
 * @param {object} props
 * @param {string} props.statusMessage
 * @param {number} props.skillCount
 * @param {number} props.messageCount
 * @param {object} props.appInfo
 * @returns {JSX.Element}
 */
export const StatusBar = React.memo(function StatusBar({
	statusMessage = "",
	skillCount = 0,
	messageCount = 0,
	appInfo,
}) {
	const status = getStatusIndicator(statusMessage);

	return (
		<box
			flexDirection="row"
			alignItems="center"
			width="100%"
			paddingX={1}
			backgroundColor="#404040"
			justifyContent="space-between"
		>
			<box key="left" flexDirection="row" alignItems="center">
				<text key="status-indicator" fg={status.color} bold>
					{status.indicator + " "}
				</text>
				<text key="status-msg" style={{ dim: true }}>
					{" " + statusMessage}
				</text>
				<text key="sep">{" | "}</text>
				<text key="info" style={{ dim: true }}>
					{"skills:" + skillCount + " msg:" + messageCount}
				</text>
			</box>
			{appInfo && (
				<text key="app-name" fg="#FFFFFF">
					{appInfo.name + " " + (appInfo.version || "")}
				</text>
			)}
		</box>
	);
});
