import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { todoImpl, findTodoByKey, validateRequired } from "../../../src/tools/todo/index.js";

const TEST_DIR = join(process.cwd(), "memory", "__test_todos__");
const TEST_FILE = join(TEST_DIR, "todos.json");

function setupTestFiles() {
	mkdirSync(TEST_DIR, { recursive: true });
	try {
		rmSync(TEST_FILE, { force: true });
	} catch {
		/* ignore */
	}
}

function cleanupTestFiles() {
	try {
		rmSync(TEST_DIR, { recursive: true, force: true });
	} catch {
		// ignore
	}
}

function getOptions() {
	return { filePath: TEST_FILE };
}

describe("tools - todo", () => {
	before(setupTestFiles);
	after(cleanupTestFiles);

	it("list returns empty list when no file exists", async () => {
		const result = await todoImpl({ action: "list" }, getOptions());
		assert.deepStrictEqual(result, { ok: true, todos: [], total: 0 });
	});

	it("list returns structured JSON with todos and total", async () => {
		await todoImpl({ action: "clear", confirm: true }, getOptions());
		await todoImpl({ action: "create", key: "test-item", content: "Test content" }, getOptions());
		const result = await todoImpl({ action: "list" }, getOptions());
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.total, 1);
		assert.strictEqual(result.todos.length, 1);
		assert.strictEqual(result.todos[0].key, "test-item");
		assert.strictEqual(result.todos[0].content, "Test content");
		assert.strictEqual(result.todos[0].completed, false);
	});

	it("create adds a todo with the given key", async () => {
		await todoImpl({ action: "clear", confirm: true }, getOptions());
		const result = await todoImpl(
			{ action: "create", key: "fix-login-bug", content: "Fix the login" },
			getOptions(),
		);
		assert.deepStrictEqual(result, { ok: true, key: "fix-login-bug" });

		const readResult = await todoImpl({ action: "list" }, getOptions());
		assert.strictEqual(readResult.total, 1);
		assert.strictEqual(readResult.todos[0].key, "fix-login-bug");
	});

	it("create accepts optional completed field", async () => {
		await todoImpl({ action: "clear", confirm: true }, getOptions());
		const result = await todoImpl(
			{ action: "create", key: "done-task", content: "Already done", completed: true },
			getOptions(),
		);
		assert.deepStrictEqual(result, { ok: true, key: "done-task" });

		const readResult = await todoImpl({ action: "list" }, getOptions());
		assert.strictEqual(readResult.todos[0].completed, true);
	});

	it("create sets default priority and timestamps", async () => {
		await todoImpl({ action: "clear", confirm: true }, getOptions());
		await todoImpl({ action: "create", key: "defaults", content: "Defaults" }, getOptions());
		const readResult = await todoImpl({ action: "list" }, getOptions());
		assert.strictEqual(readResult.todos[0].priority, "medium");
		assert.ok(readResult.todos[0].createdAt);
		assert.ok(readResult.todos[0].updatedAt);
	});

	it("create accepts explicit priority", async () => {
		await todoImpl({ action: "clear", confirm: true }, getOptions());
		await todoImpl(
			{ action: "create", key: "high-pri", content: "Urgent", priority: "high" },
			getOptions(),
		);
		const readResult = await todoImpl({ action: "list" }, getOptions());
		assert.strictEqual(readResult.todos[0].priority, "high");
	});

	it("create preserves non-ASCII content", async () => {
		await todoImpl({ action: "clear", confirm: true }, getOptions());
		await todoImpl({ action: "create", key: "unicode", content: "café 日本語" }, getOptions());
		const readResult = await todoImpl({ action: "list" }, getOptions());
		assert.strictEqual(readResult.todos[0].content, "café 日本語");
	});

	it("create rejects duplicate key", async () => {
		await todoImpl({ action: "clear", confirm: true }, getOptions());
		await todoImpl({ action: "create", key: "dup-key", content: "First" }, getOptions());
		const result = await todoImpl(
			{ action: "create", key: "dup-key", content: "Second" },
			getOptions(),
		);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /already exists/);
	});

	it("create requires key and content", async () => {
		await todoImpl({ action: "clear", confirm: true }, getOptions());
		const result = await todoImpl({ action: "create", key: "no-content" }, getOptions());
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /create requires/);
	});

	it("update modifies content and completed", async () => {
		await todoImpl({ action: "clear", confirm: true }, getOptions());
		await todoImpl({ action: "create", key: "update-me", content: "Original" }, getOptions());
		const result = await todoImpl(
			{ action: "update", key: "update-me", content: "Updated", completed: true },
			getOptions(),
		);
		assert.deepStrictEqual(result, { ok: true, key: "update-me" });

		const readResult = await todoImpl({ action: "list" }, getOptions());
		assert.strictEqual(readResult.todos[0].content, "Updated");
		assert.strictEqual(readResult.todos[0].completed, true);
	});

	it("update modifies priority and bumps updatedAt", async () => {
		await todoImpl({ action: "clear", confirm: true }, getOptions());
		await todoImpl({ action: "create", key: "prio", content: "P" }, getOptions());
		const before = await todoImpl({ action: "list" }, getOptions());
		await todoImpl({ action: "update", key: "prio", priority: "high" }, getOptions());
		const after = await todoImpl({ action: "list" }, getOptions());
		assert.strictEqual(after.todos[0].priority, "high");
		assert.ok(after.todos[0].updatedAt >= before.todos[0].updatedAt);
	});

	it("update preserves non-ASCII content", async () => {
		await todoImpl({ action: "clear", confirm: true }, getOptions());
		await todoImpl({ action: "create", key: "u", content: "plain" }, getOptions());
		await todoImpl({ action: "update", key: "u", content: "café" }, getOptions());
		const readResult = await todoImpl({ action: "list" }, getOptions());
		assert.strictEqual(readResult.todos[0].content, "café");
	});

	it("update rejects missing key", async () => {
		await todoImpl({ action: "clear", confirm: true }, getOptions());
		const result = await todoImpl({ action: "update", content: "No key" }, getOptions());
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /update requires/);
	});

	it("update rejects unknown key", async () => {
		await todoImpl({ action: "clear", confirm: true }, getOptions());
		const result = await todoImpl(
			{ action: "update", key: "missing", content: "Nope" },
			getOptions(),
		);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /not found/);
	});

	it("complete marks a todo as done", async () => {
		await todoImpl({ action: "clear", confirm: true }, getOptions());
		await todoImpl({ action: "create", key: "finish-me", content: "Do it" }, getOptions());
		const result = await todoImpl({ action: "complete", key: "finish-me" }, getOptions());
		assert.deepStrictEqual(result, { ok: true, key: "finish-me" });

		const readResult = await todoImpl({ action: "list" }, getOptions());
		assert.strictEqual(readResult.todos[0].completed, true);
	});

	it("complete rejects unknown key", async () => {
		await todoImpl({ action: "clear", confirm: true }, getOptions());
		const result = await todoImpl({ action: "complete", key: "missing" }, getOptions());
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /not found/);
	});

	it("delete removes a todo by key", async () => {
		await todoImpl({ action: "clear", confirm: true }, getOptions());
		await todoImpl({ action: "create", key: "delete-me", content: "Remove" }, getOptions());
		const result = await todoImpl({ action: "delete", key: "delete-me" }, getOptions());
		assert.deepStrictEqual(result, { ok: true, key: "delete-me" });

		const readResult = await todoImpl({ action: "list" }, getOptions());
		assert.strictEqual(readResult.total, 0);
	});

	it("delete rejects unknown key", async () => {
		await todoImpl({ action: "clear", confirm: true }, getOptions());
		const result = await todoImpl({ action: "delete", key: "missing" }, getOptions());
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /not found/);
	});

	it("list filters by pending and completed", async () => {
		await todoImpl({ action: "clear", confirm: true }, getOptions());
		await todoImpl({ action: "create", key: "pending-1", content: "Pending" }, getOptions());
		await todoImpl(
			{ action: "create", key: "done-1", content: "Done", completed: true },
			getOptions(),
		);

		const pending = await todoImpl({ action: "list", filter: "pending" }, getOptions());
		assert.strictEqual(pending.total, 1);
		assert.strictEqual(pending.todos[0].key, "pending-1");

		const completed = await todoImpl({ action: "list", filter: "completed" }, getOptions());
		assert.strictEqual(completed.total, 1);
		assert.strictEqual(completed.todos[0].key, "done-1");
	});

	it("list sorts by priority then createdAt", async () => {
		await todoImpl({ action: "clear", confirm: true }, getOptions());
		await todoImpl({ action: "create", key: "low", content: "L", priority: "low" }, getOptions());
		await todoImpl({ action: "create", key: "high", content: "H", priority: "high" }, getOptions());
		await todoImpl(
			{ action: "create", key: "med", content: "M", priority: "medium" },
			getOptions(),
		);

		const result = await todoImpl({ action: "list" }, getOptions());
		assert.deepStrictEqual(
			result.todos.map((t) => t.key),
			["high", "med", "low"],
		);
	});

	it("clear requires confirm", async () => {
		await todoImpl({ action: "clear", confirm: true }, getOptions());
		await todoImpl({ action: "create", key: "a", content: "A" }, getOptions());
		const result = await todoImpl({ action: "clear" }, getOptions());
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /confirm/);
	});

	it("clear removes all todos when confirmed", async () => {
		await todoImpl({ action: "clear", confirm: true }, getOptions());
		await todoImpl({ action: "create", key: "a", content: "A" }, getOptions());
		await todoImpl({ action: "create", key: "b", content: "B" }, getOptions());
		const result = await todoImpl({ action: "clear", confirm: true }, getOptions());
		assert.deepStrictEqual(result, { ok: true });

		const readResult = await todoImpl({ action: "list" }, getOptions());
		assert.strictEqual(readResult.total, 0);
	});

	it("rejects unknown action", async () => {
		const result = await todoImpl({ action: "bogus" }, getOptions());
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /Unknown action/);
	});

	it("enforces maxTodos limit", async () => {
		await todoImpl({ action: "clear", confirm: true }, getOptions());
		await todoImpl(
			{ action: "create", key: "one", content: "1" },
			{ ...getOptions(), maxTodos: 1 },
		);
		const result = await todoImpl(
			{ action: "create", key: "two", content: "2" },
			{ ...getOptions(), maxTodos: 1 },
		);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /max todos/);
	});
});

describe("tools - todo helpers", () => {
	it("findTodoByKey returns found and todo", () => {
		const data = { todos: [{ key: "a", content: "A", completed: false }] };
		assert.deepStrictEqual(findTodoByKey(data, "a"), {
			found: true,
			todo: { key: "a", content: "A", completed: false },
		});
		assert.deepStrictEqual(findTodoByKey(data, "missing"), { found: false, todo: null });
	});

	it("validateRequired reports the actual missing field", () => {
		assert.deepStrictEqual(validateRequired({ key: "a" }, ["key", "content"]), {
			valid: false,
			error: "content missing",
		});
		assert.deepStrictEqual(validateRequired({ content: "b" }, ["key", "content"]), {
			valid: false,
			error: "key missing",
		});
		assert.deepStrictEqual(validateRequired({ key: "a", content: "b" }, ["key", "content"]), {
			valid: true,
			error: null,
		});
	});
});
