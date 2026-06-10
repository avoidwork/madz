import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { todoImpl } from "../../src/tools/todo.js";

const TEST_DIR = join(process.cwd(), "memory", "__test_todos__");
const TEST_FILE = "memory/__test_todos__/todos.json";

function setupTestFiles() {
	mkdirSync(TEST_DIR, { recursive: true });
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

	it("read returns empty list when no file exists", async () => {
		const result = await todoImpl({ action: "read" }, getOptions());
		assert.deepStrictEqual(result, { ok: true, todos: [], total: 0 });
	});

	it("read returns structured JSON with todos and total", async () => {
		await todoImpl({ action: "clear" }, getOptions());
		await todoImpl({ action: "create", key: "test-item", content: "Test content" }, getOptions());
		const result = await todoImpl({ action: "read" }, getOptions());
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.total, 1);
		assert.strictEqual(result.todos.length, 1);
		assert.strictEqual(result.todos[0].key, "test-item");
		assert.strictEqual(result.todos[0].content, "Test content");
		assert.strictEqual(result.todos[0].completed, false);
	});

	it("create adds a todo with the given key", async () => {
		await todoImpl({ action: "clear" }, getOptions());
		const result = await todoImpl(
			{ action: "create", key: "fix-login-bug", content: "Fix the login" },
			getOptions(),
		);
		assert.deepStrictEqual(result, { ok: true, key: "fix-login-bug" });

		const readResult = await todoImpl({ action: "read" }, getOptions());
		assert.strictEqual(readResult.total, 1);
		assert.strictEqual(readResult.todos[0].key, "fix-login-bug");
	});

	it("create accepts optional completed field", async () => {
		await todoImpl({ action: "clear" }, getOptions());
		const result = await todoImpl(
			{ action: "create", key: "done-task", content: "Already done", completed: true },
			getOptions(),
		);
		assert.deepStrictEqual(result, { ok: true, key: "done-task" });

		const readResult = await todoImpl({ action: "read" }, getOptions());
		assert.strictEqual(readResult.todos[0].completed, true);
	});

	it("create rejects duplicate key", async () => {
		await todoImpl({ action: "clear" }, getOptions());
		await todoImpl({ action: "create", key: "dup-key", content: "First" }, getOptions());
		const result = await todoImpl(
			{ action: "create", key: "dup-key", content: "Second" },
			getOptions(),
		);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("already exists"));
	});

	it("create requires key and content", async () => {
		const result = await todoImpl({ action: "create" }, getOptions());
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("create requires"));
	});

	it("create requires key", async () => {
		const result = await todoImpl({ action: "create", content: "No key" }, getOptions());
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("create requires"));
	});

	it("update modifies an existing todo by key", async () => {
		await todoImpl({ action: "clear" }, getOptions());
		await todoImpl({ action: "create", key: "update-me", content: "Original" }, getOptions());
		const result = await todoImpl(
			{ action: "update", key: "update-me", content: "Updated" },
			getOptions(),
		);
		assert.deepStrictEqual(result, { ok: true, key: "update-me" });

		const readResult = await todoImpl({ action: "read" }, getOptions());
		assert.strictEqual(readResult.todos[0].content, "Updated");
	});

	it("update modifies completed field by key", async () => {
		await todoImpl({ action: "clear" }, getOptions());
		await todoImpl({ action: "create", key: "complete-me", content: "Task" }, getOptions());
		const result = await todoImpl(
			{ action: "update", key: "complete-me", completed: true },
			getOptions(),
		);
		assert.deepStrictEqual(result, { ok: true, key: "complete-me" });

		const readResult = await todoImpl({ action: "read" }, getOptions());
		assert.strictEqual(readResult.todos[0].completed, true);
	});

	it("update does not change content when only completed provided", async () => {
		await todoImpl({ action: "clear" }, getOptions());
		await todoImpl({ action: "create", key: "partial", content: "Original text" }, getOptions());
		await todoImpl({ action: "update", key: "partial", completed: true }, getOptions());
		const readResult = await todoImpl({ action: "read" }, getOptions());
		assert.strictEqual(readResult.todos[0].content, "Original text");
	});

	it("update returns not found for missing key", async () => {
		const result = await todoImpl(
			{ action: "update", key: "nonexistent", content: "Nope" },
			getOptions(),
		);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("not found"));
	});

	it("update requires key", async () => {
		const result = await todoImpl({ action: "update", content: "No key" }, getOptions());
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("update requires"));
	});

	it("complete marks a todo as done", async () => {
		await todoImpl({ action: "clear" }, getOptions());
		await todoImpl({ action: "create", key: "to-complete", content: "Task" }, getOptions());
		const result = await todoImpl({ action: "complete", key: "to-complete" }, getOptions());
		assert.deepStrictEqual(result, { ok: true, key: "to-complete" });

		const readResult = await todoImpl({ action: "read" }, getOptions());
		assert.strictEqual(readResult.todos[0].completed, true);
	});

	it("complete returns not found for missing key", async () => {
		const result = await todoImpl({ action: "complete", key: "nonexistent" }, getOptions());
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("not found"));
	});

	it("complete requires key", async () => {
		const result = await todoImpl({ action: "complete" }, getOptions());
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("complete requires"));
	});

	it("delete removes a todo by key", async () => {
		await todoImpl({ action: "clear" }, getOptions());
		await todoImpl({ action: "create", key: "to-delete", content: "Delete me" }, getOptions());
		const result = await todoImpl({ action: "delete", key: "to-delete" }, getOptions());
		assert.deepStrictEqual(result, { ok: true, key: "to-delete" });

		const readResult = await todoImpl({ action: "read" }, getOptions());
		assert.strictEqual(readResult.total, 0);
	});

	it("delete returns not found for missing key", async () => {
		const result = await todoImpl({ action: "delete", key: "nonexistent" }, getOptions());
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("not found"));
	});

	it("delete requires key", async () => {
		const result = await todoImpl({ action: "delete" }, getOptions());
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("delete requires"));
	});

	it("list returns all todos", async () => {
		await todoImpl({ action: "clear" }, getOptions());
		await todoImpl({ action: "create", key: "item-a", content: "A" }, getOptions());
		await todoImpl({ action: "create", key: "item-b", content: "B" }, getOptions());
		const result = await todoImpl({ action: "list" }, getOptions());
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.total, 2);
	});

	it("list with pending filter returns only incomplete todos", async () => {
		await todoImpl({ action: "clear" }, getOptions());
		await todoImpl({ action: "create", key: "pending-item", content: "Pending" }, getOptions());
		await todoImpl(
			{ action: "create", key: "done-item", content: "Done", completed: true },
			getOptions(),
		);
		const result = await todoImpl({ action: "list", filter: "pending" }, getOptions());
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.total, 1);
		assert.strictEqual(result.todos[0].key, "pending-item");
	});

	it("list with completed filter returns only completed todos", async () => {
		await todoImpl({ action: "clear" }, getOptions());
		await todoImpl({ action: "create", key: "pending-item", content: "Pending" }, getOptions());
		await todoImpl(
			{ action: "create", key: "done-item", content: "Done", completed: true },
			getOptions(),
		);
		const result = await todoImpl({ action: "list", filter: "completed" }, getOptions());
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.total, 1);
		assert.strictEqual(result.todos[0].key, "done-item");
	});

	it("clear removes all todos", async () => {
		await todoImpl({ action: "clear" }, getOptions());
		await todoImpl({ action: "create", key: "clear-me", content: "Will be cleared" }, getOptions());
		const result = await todoImpl({ action: "clear" }, getOptions());
		assert.deepStrictEqual(result, { ok: true });

		const readResult = await todoImpl({ action: "read" }, getOptions());
		assert.strictEqual(readResult.total, 0);
	});

	it("rejects unknown action", async () => {
		const result = await todoImpl({ action: "foobar" }, getOptions());
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Unknown action"));
		assert.ok(result.error.includes("read"));
		assert.ok(result.error.includes("create"));
	});
});
