import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createTodoQueue } from "../../src/tools/todo_queue.js";
import { setTodoStreamingCallback } from "../../src/tools/todo_queue.js";
import { resetQueue } from "../../src/tools/todo.js";

const TEST_DIR = join(process.cwd(), "memory", "__test_queue__");
const TEST_FILE = "memory/__test_queue__/todos.json";

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

function readTodos() {
	const content = readFileSync(TEST_FILE, "utf-8");
	return JSON.parse(content);
}

describe("TodoQueue", () => {
	beforeEach(() => {
		setupTestFiles();
		resetQueue();
		setTodoStreamingCallback(null);
	});

	after(() => {
		cleanupTestFiles();
	});

	it("executes actions sequentially", async () => {
		const queue = createTodoQueue(getOptions());
		const order = [];

		// Enqueue multiple creates
		const p1 = queue.enqueue({ action: "create", key: "task-a", content: "First" });
		order.push("enqueued-a");
		const p2 = queue.enqueue({ action: "create", key: "task-b", content: "Second" });
		order.push("enqueued-b");
		const p3 = queue.enqueue({ action: "create", key: "task-c", content: "Third" });
		order.push("enqueued-c");

		await Promise.all([p1, p2, p3]);

		// All should have been enqueued before any started
		assert.deepStrictEqual(order, ["enqueued-a", "enqueued-b", "enqueued-c"]);

		// Verify all todos exist
		const data = readTodos();
		assert.strictEqual(data.todos.length, 3);
		assert.strictEqual(data.todos[0].key, "task-a");
		assert.strictEqual(data.todos[1].key, "task-b");
		assert.strictEqual(data.todos[2].key, "task-c");
	});

	it("emits queued, processing, completed events in order", async () => {
		const queue = createTodoQueue(getOptions());
		const events = [];

		queue.subscribe((event) => {
			events.push(event.type);
		});

		await queue.enqueue({ action: "create", key: "test-1", content: "Test" });

		assert.deepStrictEqual(events, ["queued", "processing", "completed"]);
	});

	it("emits failed event when task fails", async () => {
		const queue = createTodoQueue(getOptions());
		const events = [];

		queue.subscribe((event) => {
			events.push(event.type);
		});

		// Try to create duplicate key — should fail
		await queue.enqueue({ action: "create", key: "dup", content: "First" });
		await queue.enqueue({ action: "create", key: "dup", content: "Second" });

		assert.deepStrictEqual(events, [
			"queued",
			"processing",
			"completed",
			"queued",
			"processing",
			"failed",
		]);
	});

	it("tracks stats correctly", async () => {
		const queue = createTodoQueue(getOptions());

		await queue.enqueue({ action: "create", key: "a", content: "A" });
		await queue.enqueue({ action: "create", key: "b", content: "B" });
		await queue.enqueue({ action: "create", key: "c", content: "C" });

		const stats = queue.getStats();
		assert.strictEqual(stats.totalCompleted, 3);
		assert.strictEqual(stats.totalFailed, 0);
	});

	it("respects maxTodos limit", async () => {
		const queue = createTodoQueue({ ...getOptions(), maxTodos: 2 });

		const r1 = await queue.enqueue({ action: "create", key: "x", content: "X" });
		const r2 = await queue.enqueue({ action: "create", key: "y", content: "Y" });
		const r3 = await queue.enqueue({ action: "create", key: "z", content: "Z" });

		assert.strictEqual(r1.ok, true);
		assert.strictEqual(r2.ok, true);
		assert.strictEqual(r3.ok, false);
		assert.ok(r3.error.includes("max todos"));
	});

	it("resetQueue clears the singleton", async () => {
		const queue1 = createTodoQueue(getOptions());
		await queue1.enqueue({ action: "create", key: "before", content: "Before" });

		resetQueue();

		const queue2 = createTodoQueue(getOptions());
		const stats = queue2.getStats();
		assert.strictEqual(stats.totalCompleted, 0);
		assert.strictEqual(stats.totalFailed, 0);
	});

	it("setTodoStreamingCallback emits events to callback", async () => {
		const streamEvents = [];
		setTodoStreamingCallback((event) => {
			streamEvents.push(event.type);
		});

		const queue = createTodoQueue(getOptions());
		await queue.enqueue({ action: "create", key: "stream-test", content: "Stream" });

		assert.deepStrictEqual(streamEvents, ["queued", "processing", "completed"]);

		// Cleanup
		setTodoStreamingCallback(null);
	});

	it("handles update and complete actions", async () => {
		const queue = createTodoQueue(getOptions());

		await queue.enqueue({ action: "create", key: "upd", content: "Original" });
		await queue.enqueue({ action: "update", key: "upd", content: "Updated" });
		await queue.enqueue({ action: "complete", key: "upd" });

		const data = readTodos();
		const todo = data.todos.find((t) => t.key === "upd");
		assert.strictEqual(todo.content, "Updated");
		assert.strictEqual(todo.completed, true);
	});

	it("handles delete action", async () => {
		const queue = createTodoQueue(getOptions());

		await queue.enqueue({ action: "create", key: "del", content: "Delete me" });
		await queue.enqueue({ action: "delete", key: "del" });

		const data = readTodos();
		assert.strictEqual(data.todos.length, 0);
	});

	it("handles list with filters", async () => {
		const queue = createTodoQueue(getOptions());

		await queue.enqueue({ action: "create", key: "p1", content: "Pending" });
		await queue.enqueue({ action: "create", key: "c1", content: "Done" });
		await queue.enqueue({ action: "complete", key: "c1" });

		const pendingResult = await queue.enqueue({ action: "list", filter: "pending" });
		const completedResult = await queue.enqueue({ action: "list", filter: "completed" });

		// Queue returns raw objects (not JSON strings)
		assert.strictEqual(pendingResult.total, 1);
		assert.strictEqual(completedResult.total, 1);
	});

	it("handles clear action", async () => {
		const queue = createTodoQueue(getOptions());

		await queue.enqueue({ action: "create", key: "a", content: "A" });
		await queue.enqueue({ action: "create", key: "b", content: "B" });
		await queue.enqueue({ action: "clear" });

		const data = readTodos();
		assert.strictEqual(data.todos.length, 0);
	});
});


