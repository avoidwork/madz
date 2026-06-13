import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createTodoQueue } from "./todo_queue.js";
import { todoImpl, stripNonASCII } from "./todo_logic.js";

/**
 * Singleton queue instance — shared across all tool invocations.
 * Created lazily on first use to avoid circular import issues.
 */
let _queue = null;

/**
 * Get or create the singleton todo queue.
 * @param {object} [options]
 * @returns {import("./todo_queue.js").TodoQueue}
 */
function getQueue(options = {}) {
	if (!_queue) {
		_queue = createTodoQueue({
			filePath: options.filePath || "memory/tools/todo.json",
			maxTodos: options.maxTodos,
			onEvent: options.onEvent || (() => {}),
		});
	}
	return _queue;
}

/**
 * Reset the singleton todo queue. Clears the queue instance so the next
 * call to getQueue() creates a fresh one. Useful when starting a new
 * OpenSpec change or recovering from a stale state.
 */
export function resetQueue() {
	_queue = null;
}

/**
 * Queued tool wrapper: intercepts todo calls, enqueues them, and returns
 * a promise that resolves when the action completes.
 *
 * The TUI subscribes to queue events via the `onEvent` callback and
 * renders status updates (queued → processing → completed/failed) inline.
 *
 * @param {z.infer<typeof TodoSchema>} input - The tool input
 * @param {object} options - Runtime options
 * @param {string} [options.filePath] - Path to the todo JSON file
 * @param {number} [options.maxTodos] - Maximum number of todos allowed
 * @param {(event: import("./todo_queue.js").TodoQueueEvent) => void} [options.onEvent] - Status event callback
 * @returns {Promise<string>} JSON string result
 */
export async function queuedTodoImpl(input, options = {}) {
	const queue = getQueue(options);
	const result = await queue.enqueue(input);
	return JSON.stringify(result);
}

/**
 * Task management tool with read, create, update, complete, delete, list, and clear actions.
 * Uses string keys for todo identification and returns structured JSON responses.
 *
 * @deprecated Use `createQueuedTodoTool` for queue-aware execution with TUI status updates.
 */
export const todo = tool(todoImpl, {
	name: "todo",
	description:
		"Task management tool. Actions: read (get all todos), create (add a todo by key), update (modify by key), complete (mark done by key), delete (remove by key), list (all or filter by pending/completed), clear (remove all). Persists to memory/tools/todo.json.",
	schema: z.object({
		action: z
			.enum(["read", "create", "update", "complete", "delete", "list", "clear"])
			.describe("Action to perform"),
		key: z
			.string()
			.optional()
			.transform((val) => (val !== undefined ? stripNonASCII(val) : undefined))
			.describe(
				"Todo key for create, update, complete, and delete actions. MUST use ASCII-only English text.",
			),
		content: z
			.string()
			.optional()
			.transform((val) => (val !== undefined ? stripNonASCII(val) : undefined))
			.describe("Content for create or update action. MUST use ASCII-only English text."),
		completed: z.boolean().optional().describe("Completion status for create or update action"),
		filter: z
			.enum(["all", "pending", "completed"])
			.optional()
			.describe("Filter for list action (all, pending, completed)"),
	}),
});

// --- Factory functions for creating tools with runtime options ---

/**
 * Create a queued todo tool with runtime options.
 * All actions are executed sequentially via a promise-based queue.
 * Status events are emitted to the onEvent callback for TUI display.
 *
 * @param {object} [options] - Runtime options
 * @param {string} [options.filePath] - Path to the todo JSON file (default: "memory/tools/todo.json")
 * @param {number} [options.maxTodos] - Maximum number of todos allowed
 * @param {(event: import("./todo_queue.js").TodoQueueEvent) => void} [options.onEvent] - Status event callback
 * @returns {object} LangChain Tool instance
 */
export function createQueuedTodoTool(options = {}) {
	return tool((input) => queuedTodoImpl(input, options), {
		name: "todo",
		description:
			"Task management tool with queued execution. Actions: read, create, update, complete, delete, list, clear. All mutations are queued and executed sequentially. Persists to memory/tools/todo.json.",
		schema: z.object({
			action: z
				.enum(["read", "create", "update", "complete", "delete", "list", "clear"])
				.describe("Action to perform"),
			key: z
				.string()
				.optional()
				.transform((val) => (val !== undefined ? stripNonASCII(val) : undefined))
				.describe(
					"Todo key for create, update, complete, and delete actions. MUST use ASCII-only English text.",
				),
			content: z
				.string()
				.optional()
				.transform((val) => (val !== undefined ? stripNonASCII(val) : undefined))
				.describe("Content for create or update action. MUST use ASCII-only English text."),
			completed: z.boolean().optional().describe("Completion status for create or update action"),
			filter: z
				.enum(["all", "pending", "completed"])
				.optional()
				.describe("Filter for list action (all, pending, completed)"),
		}),
	});
}

/**
 * Create a todo tool with runtime options (legacy — non-queued).
 * @param {object} [options] - Runtime options
 * @param {string} [options.filePath] - Path to the todo JSON file (default: "memory/tools/todo.json")
 * @param {number} [options.maxTodos] - Maximum number of todos allowed
 * @returns {object} LangChain Tool instance
 */
export function createTodoTool(options = {}) {
	return tool((input) => todoImpl(input, options), {
		name: "todo",
		description:
			"Task management tool. Actions: read (get all todos), create (add a todo by key), update (modify by key), complete (mark done by key), delete (remove by key), list (all or filter by pending/completed), clear (remove all). Persists to memory/tools/todo.json.",
		schema: z.object({
			action: z
				.enum(["read", "create", "update", "complete", "delete", "list", "clear"])
				.describe("Action to perform"),
			key: z
				.string()
				.optional()
				.transform((val) => (val !== undefined ? stripNonASCII(val) : undefined))
				.describe(
					"Todo key for create, update, complete, and delete actions. MUST use ASCII-only English text.",
				),
			content: z
				.string()
				.optional()
				.transform((val) => (val !== undefined ? stripNonASCII(val) : undefined))
				.describe("Content for create or update action. MUST use ASCII-only English text."),
			completed: z.boolean().optional().describe("Completion status for create or update action"),
			filter: z
				.enum(["all", "pending", "completed"])
				.optional()
				.describe("Filter for list action (all, pending, completed)"),
		}),
	});
}

// Re-export for backward compatibility with tests
export {
	todoImpl,
	loadTodos,
	saveTodos,
	findTodoByKey,
	validateRequired,
	stripNonASCII,
} from "./todo_logic.js";
