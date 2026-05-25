import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";

const TODO_FILE = "memory/tools/todo.json";

/**
 * Load the todo list from file storage.
 * @returns {Promise<{ todos: Array<{ id: number, content: string, completed: boolean }>}>} The todo list
 */
async function loadTodos() {
	try {
		await access("./" + TODO_FILE);
	} catch {
		return { todos: [] };
	}
	const content = await readFile("./" + TODO_FILE, "utf-8");
	return JSON.parse(content);
}

/**
 * Save the todo list to file storage.
 * @param {{ todos: Array<{ id: number, content: string, completed: boolean }> }} data - Todo data
 * @returns {Promise<void>}
 */
async function saveTodos(data) {
	const dir = join("./", TODO_FILE, "..");
	await mkdir(dir, { recursive: true });
	await writeFile("./" + TODO_FILE, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Core todo logic implementing read, create, update, complete, and clear actions.
 * @param {z.infer<typeof TodoSchema>} input - The tool input
 * @param {object} _options - Runtime options (unused, for API compatibility)
 * @returns {Promise<string>} Result of the operation
 */
export async function todoImpl(input, _options) {
	const { action, todos: inputTodos, id, content: inputContent, completed: inputCompleted } = input;

	switch (action) {
		case "read": {
			const data = await loadTodos();
			return JSON.stringify({ todos: data.todos, total: data.todos.length }, null, 0);
		}

		case "create": {
			const data = await loadTodos();
			const existingIds = new Set(data.todos.map((t) => t.id));
			// Find next available ID
			let nextId = data.todos.length > 0 ? Math.max(...data.todos.map((t) => t.id)) + 1 : 1;
			const added = [];
			const inputItems = inputTodos || [];

			for (const item of inputItems) {
				const existingItem = data.todos.find((t) => t.id === item.id);
				if (existingItem) {
					// Update existing item
					existingItem.content = item.content ?? existingItem.content;
					existingItem.completed = item.completed ?? existingItem.completed;
				} else {
					// Assign auto-generated ID if not provided
					let id = item.id;
					if (id === undefined || existingIds.has(id)) {
						id = nextId;
						while (existingIds.has(id) || added.some((t) => t.id === id)) id++;
					}
					data.todos.push({ id, content: item.content, completed: item.completed || false });
					existingIds.add(id);
					added.push({ id, content: item.content });
				}
			}

			await saveTodos(data);
			return `Created ${added.length} todo(s) with IDs: ${added.map((t) => t.id).join(", ")}`;
		}

		case "update": {
			const data = await loadTodos();
			const todoItem = data.todos.find((t) => t.id === id);
			if (!todoItem) {
				return `Todo with ID ${id} not found`;
			}
			if (inputContent !== undefined) {
				todoItem.content = inputContent;
			}
			if (inputCompleted !== undefined) {
				todoItem.completed = inputCompleted;
			}
			await saveTodos(data);
			return `Updated todo ${id}: ${todoItem.content} (completed: ${todoItem.completed})`;
		}

		case "complete": {
			const data = await loadTodos();
			const todoItem = data.todos.find((t) => t.id === id);
			if (!todoItem) {
				return `Todo with ID ${id} not found`;
			}
			todoItem.completed = true;
			await saveTodos(data);
			return `Completed todo ${id}: ${todoItem.content}`;
		}

		case "clear": {
			await saveTodos({ todos: [] });
			return "All todos cleared";
		}

		default:
			return `Error: Unknown action '${action}'. Supported: read, create, update, complete, clear`;
	}
}

/**
 * Task management tool with read, create, update, complete, and clear actions.
 */
export const todo = tool(todoImpl, {
	name: "todo",
	description:
		"Task management tool. Actions: read (get all todos), create (add todos with auto-generated IDs), update (modify by ID), complete (mark done), clear (remove all). Persists to memory/tools/todo.json.",
	schema: z.object({
		action: z.enum(["read", "create", "update", "complete", "clear"]).describe("Action to perform"),
		id: z.number().int().optional().describe("Todo ID for update/complete actions"),
		todos: z
			.array(
				z.object({
					id: z.number().int().optional(),
					content: z.string(),
					completed: z.boolean().optional(),
				}),
			)
			.optional()
			.describe("Todo items for create action"),
		content: z.string().optional().describe("New content for update action"),
		completed: z.boolean().optional().describe("Completion status for update action"),
	}),
});
