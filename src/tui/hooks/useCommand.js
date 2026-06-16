/**
 * useCommand hook — parses commands and dispatches to the registry.
 */

import { useState, useCallback } from 'react';
import { CommandRegistry } from '../utils/commandParser.js';

/**
 * Hook that manages command parsing and dispatch.
 * @param {Object} options
 * @param {Function} options.dispatch - React dispatch function
 * @param {Function} options.addMessage - Add message function
 * @param {Object} options.context - Command execution context
 * @returns {Object} Command hook return value
 */
export function useCommand({ dispatch, addMessage, context }) {
	const [registry] = useState(() => new CommandRegistry());

	/**
	 * Parse and execute a command.
	 * @param {string} text - Raw input text
	 * @returns {Promise<boolean>} Whether input was consumed as a command
	 */
	const executeCommand = useCallback(async (text) => {
		const trimmed = text.trim();
		if (!trimmed || !trimmed.startsWith('/')) return false;

		const result = registry.parse(trimmed, context);
		if (!result) return false;

		if (result.action === 'quit') {
			// Handled by parent
			return true;
		}

		if (result.action === 'new') {
			// Handled by parent
			return true;
		}

		if (result.action === 'clear') {
			dispatch((state) => ({ ...state, messages: [] }));
			if (result.message) {
				addMessage({ role: 'system', content: result.message });
			}
			return true;
		}

		if (result.action === 'unknown') {
			addMessage({ role: 'system', content: result.message });
			return true;
		}

		if (result.action === 'skill' && result.subAction === 'load' && result.skillBody) {
			// Handled by parent for streaming
			return true;
		}

		if (result.message && result.action !== 'provider' && result.action !== 'schedule' && result.action !== 'skill') {
			addMessage({ role: 'system', content: result.message });
		}

		return true;
	}, [dispatch, addMessage, context]);

	return {
		registry,
		executeCommand,
	};
}
