/**
 * useCommand hook — command parsing and dispatch.
 * Wraps the command registry for use within the TUI component.
 */

import { useCallback } from "react";

/**
 * Hook for command handling.
 * @param {Object} deps - Dependencies
 * @param {Object} deps.commandRegistry - Command registry instance
 * @param {Function} deps.dispatch - TUI state dispatcher
 * @param {Function} deps.addMessage - Add message helper
 * @param {Function} deps.handleSubmit - Submit handler for skill execution
 * @param {Object} deps.context - Command execution context
 * @returns {Object} Command handling object
 */
export function useCommand(deps) {
	const { commandRegistry, dispatch, addMessage, handleSubmit, context } = deps;

	/**
	 * Parse and execute a command.
	 * @param {string} input - Raw command input
	 * @returns {Promise<void>}
	 */
	const executeCommand = useCallback(
		async (input) => {
			const result = commandRegistry.parse(input, context);

			if (!result) return;

			if (result.action === "quit") {
				context.handleQuit();
				return;
			}

			if (result.action === "new") {
				context.handleNewSession();
				return;
			}

			if (result.action === "clear") {
				dispatch({ type: "CLEAR_MESSAGES" });
				context.setStatusMessage(result.message || "Conversation cleared.");
				return;
			}

			if (result.action === "unknown") {
				context.setStatusMessage(result.message);
				return;
			}

			if (result.action === "skill" && result.subAction === "load" && result.skillBody) {
				context.setStatusMessage("Streaming...");
				context.sessionState?.addExchange({ role: "user", content: input });
				await context.handleSkillStream(result.skillBody);
				return;
			}

			if (result.message && result.action !== "provider" && result.action !== "schedule") {
				addMessage({ role: "system", content: result.message });
			}
		},
		[commandRegistry, dispatch, addMessage, context],
	);

	return { executeCommand };
}
