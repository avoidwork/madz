import { describe, it, after, beforeEach } from "node:test";
import assert from "node:assert";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadContext } from "../../src/memory/context.js";

const TEST_DIR = "memory/__test_context__/";
const CWD = join(process.cwd(), TEST_DIR);

function setup() {
	mkdirSync(CWD, { recursive: true });
}

function teardown() {
	rmSync(CWD, { recursive: true, force: true });
}

function writeContextFile(filename, title, body, timestamp) {
	writeFileSync(
		join(CWD, filename),
		`---\ntitle: "${title}"\ntimestamp: "${timestamp || new Date().toISOString()}"\n---\n\n${body}\n`,
	);
}

describe("loadContext async", () => {
	beforeEach(setup);
	after(teardown);

	it("returns empty string when directory is empty", async () => {
		const result = await loadContext(TEST_DIR, 10);
		assert.strictEqual(result, "");
	});

	it("loads context files and formats them", async () => {
		writeContextFile("test1.md", "Test Note 1", "Body 1", "2026-01-01T00:00:00.000Z");
		writeContextFile("test2.md", "Test Note 2", "Body 2", "2026-01-02T00:00:00.000Z");
		const result = await loadContext(TEST_DIR, 10);
		assert.ok(result.includes("[Context: Test Note 2]"));
		assert.ok(result.includes("Body 2"));
		assert.ok(result.includes("[Context: Test Note 1]"));
		assert.ok(result.includes("Body 1"));
	});

	it("loads context files in sorted order (most recent first)", async () => {
		writeContextFile("old.md", "Old Note", "Old body", "2026-01-01T00:00:00.000Z");
		writeContextFile("new.md", "New Note", "New body", "2026-01-03T00:00:00.000Z");
		writeContextFile("mid.md", "Mid Note", "Mid body", "2026-01-02T00:00:00.000Z");
		const result = await loadContext(TEST_DIR, 10);
		// Most recent should come first
		const newIdx = result.indexOf("New Note");
		const midIdx = result.indexOf("Mid Note");
		const oldIdx = result.indexOf("Old Note");
		assert.ok(newIdx < midIdx, "New note should come before mid note");
		assert.ok(midIdx < oldIdx, "Mid note should come before old note");
	});

	it("respects the limit parameter", async () => {
		writeContextFile("a.md", "Note A", "Body A", "2026-01-01T00:00:00.000Z");
		writeContextFile("b.md", "Note B", "Body B", "2026-01-02T00:00:00.000Z");
		writeContextFile("c.md", "Note C", "Body C", "2026-01-03T00:00:00.000Z");
		const result = await loadContext(TEST_DIR, 2);
		assert.ok(result.includes("Note C"));
		assert.ok(result.includes("Note B"));
		assert.ok(!result.includes("Note A"), "Should not include third note when limit is 2");
	});

	it("handles non-existent directory gracefully", async () => {
		teardown();
		const result = await loadContext(TEST_DIR, 10);
		assert.strictEqual(result, "");
		setup();
	});

	it("skips non-.md files", async () => {
		writeContextFile("test.md", "Markdown Note", "Body", "2026-01-01T00:00:00.000Z");
		writeFileSync(join(CWD, "notes.txt"), "This should be ignored");
		const result = await loadContext(TEST_DIR, 10);
		assert.ok(result.includes("Markdown Note"));
		assert.ok(!result.includes("This should be ignored"));
	});

	it("returns async Promise (not synchronous)", async () => {
		const result = loadContext(TEST_DIR, 10);
		assert.ok(result instanceof Promise, "loadContext should return a Promise");
		await result;
	});
});
