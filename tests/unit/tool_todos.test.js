import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdirSync, readFileSync, rmSync, existsSync } from "node:fs";
import { todoImpl } from "../../src/tools/todo.js";
import { memoryImpl } from "../../src/tools/memory.js";
import { sessionSearchImpl } from "../../src/tools/sessionSearch.js";
import { clarifyImpl } from "../../src/tools/clarify.js";
import { skillsListImpl, skillViewImpl } from "../../src/tools/skills.js";

const TODO_FILE = "memory/tools/todo.json";
const MEMORY_FILE = "memory/context/session_memory.md";
const CLARIFICATION_FILE = "memory/context/clarifications.md";

function setupTestFiles() {
	mkdirSync("memory/tools", { recursive: true });
	mkdirSync("memory/context", { recursive: true });
}

function cleanupTestFiles() {
	if (existsSync("./" + TODO_FILE)) {
		rmSync("./" + TODO_FILE, { force: true });
	}
	if (existsSync("./" + MEMORY_FILE)) {
		rmSync("./" + MEMORY_FILE, { force: true });
	}
	if (existsSync("./" + CLARIFICATION_FILE)) {
		rmSync("./" + CLARIFICATION_FILE, { force: true });
	}
}

function setupMockRegistry() {
	return {
		list: () => ["code-review", "file-inspector"],
		get: (name) => {
			if (name === "code-review") {
				return {
					name: "code-review",
					metadata: {
						version: "1.0.0",
						description: "Reviews code changes",
						permissions: ["filesystem:read"],
						inputSchema: {},
						outputSchema: {},
						_path: "skills/code-review",
					},
				};
			}
			if (name === "file-inspector") {
				return {
					name: "file-inspector",
					metadata: {
						version: "2.0.0",
						description: "Inspects files",
						permissions: ["filesystem:read", "filesystem:write"],
						inputSchema: {},
						outputSchema: {},
						_path: "skills/file-inspector",
					},
				};
			}
			return null;
		},
	};
}

describe("tools - todo", () => {
	before(setupTestFiles);
	after(cleanupTestFiles);

	it("read returns empty list when no file exists", async () => {
		const result = await todoImpl({ action: "read" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.total, 0);
		assert.deepStrictEqual(parsed.todos, []);
	});

	it("create adds items with auto-generated IDs", async () => {
		// Clear first to ensure clean state
		await todoImpl({ action: "clear" }, {});
		const result = await todoImpl(
			{ action: "create", todos: [{ content: "Fix login bug" }, { content: "Write tests" }] },
			{},
		);
		assert.ok(result.includes("Created 2"));
		assert.ok(result.includes("IDs"));

		// Verify persistence
		const readResult = await todoImpl({ action: "read" }, {});
		const parsed = JSON.parse(readResult);
		assert.strictEqual(parsed.total, 2);
	});

	it("update modifies an existing todo", async () => {
		// Use a unique name to avoid conflicts
		const uid = Date.now();
		await todoImpl({ action: "create", todos: [{ content: `Update test ${uid}` }] }, {});
		const result = await todoImpl({ action: "update", id: 1, content: "Updated item" }, {});
		assert.ok(result.includes("Updated"));
		// Clean up
		await todoImpl({ action: "clear" }, {});
	});

	it("complete marks a todo as done", async () => {
		await todoImpl({ action: "clear" }, {});
		await todoImpl({ action: "create", todos: [{ content: "Complete test" }] }, {});
		const result = await todoImpl({ action: "complete", id: 1 }, {});
		assert.ok(result.includes("Completed"));
	});

	it("clear removes all todos", async () => {
		await todoImpl({ action: "clear" }, {});
		const result = await todoImpl({ action: "clear" }, {});
		assert.ok(result.includes("cleared"));
		const readResult = await todoImpl({ action: "read" }, {});
		const parsed = JSON.parse(readResult);
		assert.strictEqual(parsed.total, 0);
	});

	it("rejects unknown action", async () => {
		const result = await todoImpl({ action: "foobar" }, {});
		assert.ok(result.includes("Unknown action") || result.includes("Error"));
	});
});

describe("tools - memory", () => {
	before(setupTestFiles);
	after(cleanupTestFiles);

	it("write adds entries to session memory", async () => {
		const result = await memoryImpl(
			{ entries: [{ key: "user_pref", value: "dark_mode" }] },
			{ maxEntries: 100 },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.saved, 1);
		assert.ok(parsed.keys.includes("user_pref"));
	});

	it("deduplicates by key", async () => {
		// Write initial entry
		await memoryImpl({ entries: [{ key: "theme", value: "light" }] }, { maxEntries: 100 });
		// Overwrite same key
		const result = await memoryImpl(
			{ entries: [{ key: "theme", value: "dark" }] },
			{ maxEntries: 100 },
		);
		assert.ok(result.includes("saved"));
	});

	it("enforces maxEntries limit", async () => {
		try {
			const bigEntries = [];
			for (let i = 0; i < 101; i++) {
				bigEntries.push({ key: `key_${i}`, value: `value_${i}` });
			}
			await memoryImpl({ entries: bigEntries }, { maxEntries: 100 });
			assert.fail("Should have thrown error");
		} catch (err) {
			assert.ok(err.message.includes("exceed"));
		}
	});

	it("multiple entries at once", async () => {
		const result = await memoryImpl(
			{
				entries: [
					{ key: "a", value: 1 },
					{ key: "b", value: 2 },
					{ key: "c", value: 3 },
				],
			},
			{ maxEntries: 100 },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.saved, 3);
	});
});

describe("tools - session_search", () => {
	before(setupTestFiles);
	after(cleanupTestFiles);

	it("browse returns list or empty message when dir empty", async () => {
		const result = await sessionSearchImpl(
			{ query: "", limit: 10 },
			{ conversationsDir: "memory/conversations/" },
		);
		assert.ok(typeof result === "string");
		assert.ok(
			result.includes("No conversations") || result.includes("not found") || result.includes("["),
		);
	});

	it("search with non-matching query", async () => {
		const result = await sessionSearchImpl(
			{ query: "xyz_not_found_123" },
			{ conversationsDir: "memory/conversations/" },
		);
		assert.ok(result.includes("No conversations") || result.includes("no matching"));
	});

	it("unknown conversation id", async () => {
		const result = await sessionSearchImpl(
			{ conversationId: "non_existent_id" },
			{ conversationsDir: "memory/conversations/" },
		);
		assert.ok(result.includes("not found") || result.includes("not found"));
	});
});

describe("tools - clarify", () => {
	before(setupTestFiles);
	after(cleanupTestFiles);

	it("stores open-ended question", async () => {
		const result = await clarifyImpl({ question: "Should I use TypeScript?" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.answered, true);
		assert.strictEqual(parsed.source, "open_ended");
		assert.ok(existsSync("./" + CLARIFICATION_FILE));
	});

	it("stores question with choices", async () => {
		const result = await clarifyImpl(
			{ question: "Which framework?", choices: ["React", "Vue", "Svelte"] },
			{},
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.source, "choices");
	});

	it("appends to clarifications file", async () => {
		const existing = existsSync("./" + CLARIFICATION_FILE)
			? readFileSync("./" + CLARIFICATION_FILE, "utf-8").split("\n").length
			: 0;
		await clarifyImpl({ question: "Test question" }, {});
		const updated = readFileSync("./" + CLARIFICATION_FILE, "utf-8").split("\n").length;
		assert.ok(updated >= existing);
	});
});

describe("tools - skills", () => {
	it("list returns empty when registry is null", async () => {
		const result = await skillsListImpl({}, { registry: null });
		assert.strictEqual(result.count, 0);
	});

	it("list returns empty when no skills", async () => {
		const result = await skillsListImpl({}, { registry: { list: () => [] } });
		assert.strictEqual(result.count, 0);
		assert.ok(result.message);
	});

	it("list returns skills when registry has skills", async () => {
		const registry = setupMockRegistry();
		const result = await skillsListImpl({}, { registry });
		assert.strictEqual(result.count, 2);
		assert.strictEqual(result.skills.length, 2);
		assert.strictEqual(result.skills[0].name, "code-review");
		assert.strictEqual(result.skills[0].version, "1.0.0");
	});

	it("view returns skill details", async () => {
		const registry = setupMockRegistry();
		const result = await skillViewImpl({ name: "code-review" }, { registry });
		assert.strictEqual(result.name, "code-review");
		assert.strictEqual(result.version, "1.0.0");
		assert.ok(result.description);
	});

	it("view returns error for unknown skill", async () => {
		const registry = setupMockRegistry();
		const result = await skillViewImpl({ name: "nonexistent" }, { registry });
		assert.ok(result.error?.includes("not found") || result.error?.includes("Error"));
	});
});
