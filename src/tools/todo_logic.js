/**
 * Core todo logic — read, create, update, complete, delete, list, clear.
 * This module is pure: no queue, no side effects beyond file I/O.
 * Used by both the direct tool wrapper and the queue executor.
 */

import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";

const TODO_FILE = "memory/tools/todo.json";
const VALID_ACTIONS = ["read", "create", "update", "complete", "delete", "list", "clear"];

/**
 * Strip non-ASCII characters from a string.
 * @param {string} str - The string to strip
 * @returns {string} The ASCII-only string
 */
export function stripNonASCII(str) {
	// eslint-disable-next-line no-control-regex
	return str.replace(/[^\x00-\x7F]/g, "");
}

/**
 * Load the todo list from file storage.
 * @param {string} filePath - Path to the todo JSON file
 * @returns {Promise<{ todos: Array<{ key: string, content: string, completed: boolean }>}>}
 */
export async function loadTodos(filePath) {
	try {
		await access("./" + filePath);
	} catch {
		return { todos: [] };
	}
	const content = await readFile("./" + filePath, "utf-8");
	return JSON.parse(content);
}

/**
 * Save the todo list to file storage.
 * @param {string} filePath - Path to the todo JSON file
 * @param {{ todos: Array<{ key: string, content: string, completed: boolean }> }} data - Todo data
 * @returns {Promise<void>}
 */
export async function saveTodos(filePath, data) {
	const dir = join("./", filePath, "..");
	await mkdir(dir, { recursive: true });
	await writeFile("./" + filePath, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Find a todo by its key.
 * @param {{ todos: Array<{ key: string, content: string, completed: boolean }> }} data - Todo data
 * @param {string} key - The key to find
 * @returns {{ found: boolean, todo: { key: string, content: string, completed: boolean } | null }}
 */
export function findTodoByKey(data, key) {
	const todo = data.todos.find((t) => t.key === key);
	return { found: !!todo, todo: todo || null };
}

/**
 * Validate that required fields are present in the input.
 * @param {object} input - The tool input object
 * @param {string[]} fields - Array of field names that must be present
 * @returns {{ valid: boolean, error: string | null }}
 */
export function validateRequired(input, fields) {
	const missing = fields.filter((f) => input[f] === undefined || input[f] === "");
	if (missing.length > 0) {
		return { valid: false, error: `${fields[0]} missing` };
	}
	return { valid: true, error: null };
}

/**
 * Core todo logic implementing read, create, update, complete, delete, list, and clear actions.
 * @param {object} input - The tool input
 * @param {object} options - Runtime options
 * @param {string} [options.filePath] - Path to the todo JSON file (default: "memory/tools/todo.json")
 * @param {number} [options.maxTodos] - Maximum number of todos allowed
 * @returns {Promise<object>} Result of the operation as structured JSON
 */
export async function todoImpl(input, options) {
	const filePath = options?.filePath || TODO_FILE;
	const maxTodos = options?.maxTodos;
	const { action } = input;

	switch (action) {
		case "read": {
			const data = await loadTodos(filePath);
			return { ok: true, todos: data.todos, total: data.todos.length };
		}

		case "create": {
			const validation = validateRequired(input, ["key", "content"]);
			if (!validation.valid) {
				return { ok: false, error: `create requires: ${validation.error}` };
			}

			const data = await loadTodos(filePath);

			if (maxTodos && data.todos.length >= maxTodos) {
				return { ok: false, error: `max todos (${maxTodos}) reached` };
			}

			const existing = findTodoByKey(data, input.key);
			if (existing.found) {
				return { ok: false, error: `key '${input.key}' already exists` };
			}

			data.todos.push({
				key: input.key,
				content: input.content,
				completed: input.completed || false,
			});

			await saveTodos(filePath, data);
			return { ok: true, key: input.key };
		}

		case "update": {
			const validation = validateRequired(input, ["key"]);
			if (!validation.valid) {
				return { ok: false, error: `update requires: ${validation.error}` };
			}

			const data = await loadTodos(filePath);
			const { found, todo } = findTodoByKey(data, input.key);
			if (!found) {
				return { ok: false, error: `Todo with key '${input.key}' not found` };
			}

			if (input.content !== undefined) {
				todo.content = stripNonASCII(input.content);
			}
			if (input.completed !== undefined) {
				todo.completed = input.completed;
			}

			await saveTodos(filePath, data);
			return { ok: true, key: input.key };
		}

		case "complete": {
			const validation = validateRequired(input, ["key"]);
			if (!validation.valid) {
				return { ok: false, error: `complete requires: ${validation.error}` };
			}

			const data = await loadTodos(filePath);
			const { found, todo } = findTodoByKey(data, input.key);
			if (!found) {
				return { ok: false, error: `Todo with key '${input.key}' not found` };
			}

			todo.completed = true;
			await saveTodos(filePath, data);
			return { ok: true, key: input.key };
		}

		case "delete": {
			const validation = validateRequired(input, ["key"]);
			if (!validation.valid) {
				return { ok: false, error: `delete requires: ${validation.error}` };
			}

			const data = await loadTodos(filePath);
			const index = data.todos.findIndex((t) => t.key === input.key);
			if (index === -1) {
				return { ok: false, error: `Todo with key '${input.key}' not found` };
			}

			data.todos.splice(index, 1);
			await saveTodos(filePath, data);
			return { ok: true, key: input.key };
		}

		case "list": {
			const data = await loadTodos(filePath);
			const filter = input.filter;

			let todos = data.todos;
			if (filter === "pending") {
				todos = data.todos.filter((t) => !t.completed);
			} else if (filter === "completed") {
				todos = data.todos.filter((t) => t.completed);
			}

			return { ok: true, todos, total: todos.length };
		}

		case "clear": {
			await saveTodos(filePath, { todos: [] });
			return { ok: true };
		}

		default:
			return {
				ok: false,
				error: `Unknown action: '${action}'. Valid actions: ${VALID_ACTIONS.join(", ")}`,
			};
	}
}

export { VALID_ACTIONS };
