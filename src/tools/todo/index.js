import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { loadConfig } from "../../config/loader.js";

const config = loadConfig();
const cwd = config.cwd;

const DEFAULT_FILE = join(cwd, config.memory.toolsDir, "todo.json");
const VALID_ACTIONS = [
	"read",
	"create",
	"update",
	"complete",
	"delete",
	"list",
	"reorder",
	"clear",
];
const VALID_PRIORITIES = ["low", "medium", "high"];

/**
 * Strip non-ASCII characters from a string. Used for keys only — content is
 * free text and must pass through untouched.
 * @param {string} str - The string to strip
 * @returns {string} The ASCII-only string
 */
export function stripNonASCII(str) {
	// eslint-disable-next-line no-control-regex
	return str.replace(/[^\x00-\x7F]/g, "");
}

/**
 * Check if a file path exists.
 * @param {string} filePath - File path to check
 * @returns {Promise<boolean>}
 */
async function pathExists(filePath) {
	try {
		await access(filePath);
		return true;
	} catch (_err) {
		return false;
	}
}

/**
 * Load the todo list from file storage.
 * @param {string} filePath - Path to the todo JSON file
 * @returns {Promise<{ todos: Array<object> }>}
 */
async function loadTodos(filePath) {
	if (!(await pathExists(filePath))) {
		return { todos: [] };
	}
	const content = await readFile(filePath, "utf-8");
	return JSON.parse(content);
}

/**
 * Save the todo list to file storage.
 * @param {string} filePath - Path to the todo JSON file
 * @param {{ todos: Array<object> }} data - Todo data
 * @returns {Promise<void>}
 */
async function saveTodos(filePath, data) {
	await mkdir(dirname(filePath), { recursive: true });
	await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Find a todo by its key.
 * @param {{ todos: Array<object> }} data - Todo data
 * @param {string} key - The key to find
 * @returns {{ found: boolean, todo: object | null }}
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
		return { valid: false, error: `${missing[0]} missing` };
	}
	return { valid: true, error: null };
}

/**
 * Sort todos by priority (high > medium > low). The sort is stable, so within
 * a priority group the stored array order is preserved — this is what makes
 * the `reorder` action meaningful. Missing priority defaults to medium.
 * @param {Array<object>} todos - Todos to sort
 * @returns {Array<object>} Sorted todos
 */
function sortTodos(todos) {
	const rank = { high: 0, medium: 1, low: 2 };
	return [...todos].sort((a, b) => {
		const pa = rank[a.priority] ?? 1;
		const pb = rank[b.priority] ?? 1;
		return pa - pb;
	});
}

/**
 * Core todo logic implementing read, create, update, complete, delete, list,
 * reorder, and clear actions.
 * @param {object} input - The tool input
 * @param {object} [options] - Runtime options
 * @param {string} [options.filePath] - Path to the todo JSON file (default: memory/tools/todo.json)
 * @param {number} [options.maxTodos] - Maximum number of todos allowed
 * @returns {Promise<object>} Result of the operation
 */
export async function todoImpl(input, options = {}) {
	const filePath = options.filePath || DEFAULT_FILE;
	const maxTodos = options.maxTodos;
	const { action } = input;

	switch (action) {
		case "read": {
			const data = await loadTodos(filePath);
			const todos = sortTodos(data.todos);
			return { ok: true, todos, total: todos.length };
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

			const now = new Date().toISOString();
			data.todos.push({
				key: input.key,
				content: input.content,
				completed: input.completed || false,
				priority: input.priority || "medium",
				createdAt: now,
				updatedAt: now,
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
				todo.content = input.content;
			}
			if (input.completed !== undefined) {
				todo.completed = input.completed;
			}
			if (input.priority !== undefined) {
				todo.priority = input.priority;
			}
			todo.updatedAt = new Date().toISOString();

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
			todo.updatedAt = new Date().toISOString();
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

			todos = sortTodos(todos);
			return { ok: true, todos, total: todos.length };
		}

		case "reorder": {
			const validation = validateRequired(input, ["key", "position"]);
			if (!validation.valid) {
				return { ok: false, error: `reorder requires: ${validation.error}` };
			}

			const data = await loadTodos(filePath);
			const index = data.todos.findIndex((t) => t.key === input.key);
			if (index === -1) {
				return { ok: false, error: `Todo with key '${input.key}' not found` };
			}

			const position = input.position;
			if (position < 0 || position >= data.todos.length) {
				return {
					ok: false,
					error: `position '${position}' out of range (0-${data.todos.length - 1})`,
				};
			}

			const [moved] = data.todos.splice(index, 1);
			data.todos.splice(position, 0, moved);
			await saveTodos(filePath, data);
			return { ok: true, key: input.key, position };
		}

		case "clear": {
			if (input.confirm !== true) {
				return { ok: false, error: "clear requires confirm: true" };
			}
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

/**
 * Task management tool with read, create, update, complete, delete, list,
 * reorder, and clear actions. Uses string keys for todo identification and
 * returns structured JSON responses. Todos carry priority (low/medium/high),
 * createdAt, and updatedAt. Persists to memory/tools/todo.json.
 */
export const todo = tool(
	(input) =>
		todoImpl(input, {
			filePath: DEFAULT_FILE,
			maxTodos: config.memory.maxTodos,
		}),
	{
		name: "todo",
		description:
			"Task management tool. Actions: read (get all todos), create (add a todo by key), update (modify by key), complete (mark done by key), delete (remove by key), list (all or filter by pending/completed), reorder (move a todo to a position), clear (remove all, requires confirm: true). Todos carry priority (low/medium/high), createdAt, and updatedAt. Persists to memory/tools/todo.json.",
		schema: z.object({
			action: z
				.enum(["read", "create", "update", "complete", "delete", "list", "reorder", "clear"])
				.describe("Action to perform"),
			key: z
				.string()
				.optional()
				.transform((val) => (val !== undefined ? stripNonASCII(val) : undefined))
				.describe(
					"Todo key for create, update, complete, delete, and reorder actions. MUST use ASCII-only English text.",
				),
			content: z
				.string()
				.optional()
				.describe("Content for create or update action. Free text — non-ASCII preserved."),
			completed: z.boolean().optional().describe("Completion status for create or update action"),
			priority: z
				.enum(VALID_PRIORITIES)
				.optional()
				.describe("Priority for create or update action (low, medium, high)"),
			position: z
				.number()
				.int()
				.nonnegative()
				.optional()
				.describe("Zero-based position for reorder action"),
			filter: z
				.enum(["all", "pending", "completed"])
				.optional()
				.describe("Filter for list action (all, pending, completed)"),
			confirm: z.boolean().optional().describe("Set to true to confirm a destructive clear action"),
		}),
	},
);
