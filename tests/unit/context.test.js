import { describe, it, after, beforeEach } from "node:test";
import assert from "node:assert";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { loadContext } from "../../src/memory/context.js";
import { parseFrontmatter } from "../../src/memory/reader.js";

const testDir = "memory/__test_context__";
const fullTestDir = join(process.cwd(), testDir);

function setup() {
	mkdirSync(fullTestDir, { recursive: true });
}

function teardown() {
	try {
		rmSync(fullTestDir, { recursive: true, force: true });
	} catch {
		// ignore cleanup errors
	}
}

function clearTestDir() {
	try {
		rmSync(fullTestDir, { recursive: true, force: true });
	} catch {
		// ignore cleanup errors
	}
}

describe("loadContext", () => {
	beforeEach(() => {
		clearTestDir();
		setup();
	});
	after(teardown);

	it("returns combined context from markdown files sorted by timestamp descending", () => {
		writeFileSync(
			join(fullTestDir, "note1.md"),
			"---\ntitle: First Note\ntimestamp: 2024-01-01\n---\nContent of first note",
		);
		writeFileSync(
			join(fullTestDir, "note2.md"),
			"---\ntitle: Second Note\ntimestamp: 2024-01-03\n---\nContent of second note",
		);
		writeFileSync(
			join(fullTestDir, "note3.md"),
			"---\ntitle: Third Note\ntimestamp: 2024-01-02\n---\nContent of third note",
		);

		const result = loadContext(testDir, 3);
		assert.ok(result.includes("[Context: Second Note]"));
		assert.ok(result.includes("Content of second note"));
		assert.ok(result.includes("[Context: Third Note]"));
		assert.ok(result.includes("Content of third note"));
		assert.ok(result.includes("[Context: First Note]"));
		assert.ok(result.includes("Content of first note"));
		const secondIdx = result.indexOf("Second Note");
		const thirdIdx = result.indexOf("Third Note");
		const firstIdx = result.indexOf("First Note");
		assert.ok(secondIdx < thirdIdx, "Second Note should come before Third Note");
		assert.ok(thirdIdx < firstIdx, "Third Note should come before First Note");
	});

	it("respects the limit parameter", () => {
		writeFileSync(join(fullTestDir, "a.md"), "---\ntitle: A\ntimestamp: 2024-01-01\n---\nAAA");
		writeFileSync(join(fullTestDir, "b.md"), "---\ntitle: B\ntimestamp: 2024-01-02\n---\nBBB");
		writeFileSync(join(fullTestDir, "c.md"), "---\ntitle: C\ntimestamp: 2024-01-03\n---\nCCC");

		const result = loadContext(testDir, 2);
		assert.ok(result.includes("[Context: B]"));
		assert.ok(result.includes("[Context: C]"));
		assert.ok(!result.includes("[Context: A]"), "A should be excluded with limit 2");
	});

	it("filters out non-.md files", () => {
		writeFileSync(
			join(fullTestDir, "valid.md"),
			"---\ntitle: Valid\ntimestamp: 2024-01-01\n---\nValid content",
		);
		writeFileSync(join(fullTestDir, "invalid.txt"), "this is not markdown");

		const result = loadContext(testDir, 10);
		assert.ok(result.includes("[Context: Valid]"));
		assert.ok(!result.includes("[Context: invalid.txt]"));
		assert.ok(!result.includes("this is not markdown"));
	});

	it("returns empty string for non-existent directory", () => {
		const result = loadContext("__nonexistent_dir_xyz__", 10);
		assert.strictEqual(result, "");
	});

	it("returns empty string for empty directory", () => {
		const emptyDir = "__empty_ctx_test__";
		mkdirSync(join(process.cwd(), emptyDir), { recursive: true });
		try {
			const result = loadContext(emptyDir, 10);
			assert.strictEqual(result, "");
		} finally {
			rmSync(join(process.cwd(), emptyDir), { recursive: true, force: true });
		}
	});

	it("trims body content of each context entry", () => {
		writeFileSync(
			join(fullTestDir, "trimmed.md"),
			"---\ntitle: Trimmed\ntimestamp: 2024-01-01\n---\n  some text with spaces  \n",
		);

		const result = loadContext(testDir, 10);
		assert.ok(result.includes("some text with spaces"));
	});

	it("handles files without timestamp (falls back to empty string sort)", () => {
		writeFileSync(
			join(fullTestDir, "no-ts.md"),
			"---\ntitle: No Timestamp\n---\nNo timestamp body",
		);
		writeFileSync(
			join(fullTestDir, "with-ts.md"),
			"---\ntitle: With Timestamp\ntimestamp: 2024-01-01\n---\nHas timestamp body",
		);

		const result = loadContext(testDir, 10);
		assert.ok(result.includes("No Timestamp"));
		assert.ok(result.includes("With Timestamp"));
	});

	it("filters out ephemeral files from main processing", () => {
		writeFileSync(
			join(fullTestDir, "persistent.md"),
			"---\ntitle: Persistent\ntimestamp: 2024-01-03\n---\nPersistent content",
		);
		writeFileSync(
			join(fullTestDir, "ephemeral-note.md"),
			"---\ntitle: Ephemeral Note\ntimestamp: 2024-01-04\n---\nEphemeral content",
		);

		const result = loadContext(testDir, 10);
		assert.ok(result.includes("[Context: Persistent]"));
		assert.ok(result.includes("Persistent content"));
		// Ephemeral files should not appear as [Context:] entries
		assert.ok(!result.includes("[Context: Ephemeral Note]"));
	});

	it("loads ephemeral files last with correct sort order", () => {
		writeFileSync(
			join(fullTestDir, "persistent.md"),
			"---\ntitle: Persistent\ntimestamp: 2024-01-01\n---\nPersistent content",
		);
		writeFileSync(
			join(fullTestDir, "ephemeral-old.md"),
			"---\ntitle: Ephemeral Old\ntimestamp: 2024-01-01\n---\nOld ephemeral",
		);
		writeFileSync(
			join(fullTestDir, "ephemeral-new.md"),
			"---\ntitle: Ephemeral New\ntimestamp: 2024-01-03\n---\nNew ephemeral",
		);

		const result = loadContext(testDir, 10);
		// Persistent should appear as [Context:]
		assert.ok(result.includes("[Context: Persistent]"));
		// Ephemeral should appear as [Ephemeral:]
		assert.ok(result.includes("[Ephemeral: Ephemeral New]"));
		assert.ok(result.includes("[Ephemeral: Ephemeral Old]"));
		// Ephemeral New (newer) should come before Ephemeral Old
		const newIdx = result.indexOf("Ephemeral New");
		const oldIdx = result.indexOf("Ephemeral Old");
		assert.ok(newIdx < oldIdx, "Newer ephemeral should come before older ephemeral");
		// Persistent should come before ephemeral
		const persistentIdx = result.indexOf("Persistent");
		assert.ok(persistentIdx < newIdx, "Persistent context should come before ephemeral");
	});

	it("respects ephemeral limit", () => {
		writeFileSync(
			join(fullTestDir, "persistent.md"),
			"---\ntitle: Persistent\ntimestamp: 2024-01-01\n---\nPersistent content",
		);
		// Create more ephemeral files than the default limit (5)
		for (let i = 1; i <= 7; i++) {
			writeFileSync(
				join(fullTestDir, `ephemeral-${i}.md`),
				`---\ntitle: Ephemeral ${i}\ntimestamp: 2024-01-0${i}\n---\nEphemeral ${i} content`,
			);
		}

		const result = loadContext(testDir, 10);
		// Should only include up to 5 ephemeral files (default limit)
		let count = 0;
		for (let i = 1; i <= 7; i++) {
			if (result.includes(`Ephemeral ${i}`)) count++;
		}
		assert.strictEqual(count, 5, "Should only load 5 ephemeral files by default");
	});

	it("handles missing profile.md gracefully", () => {
		writeFileSync(
			join(fullTestDir, "note.md"),
			"---\ntitle: Note\ntimestamp: 2024-01-01\n---\nNote content",
		);

		const result = loadContext(testDir, 10);
		assert.ok(result.includes("[Context: Note]"));
		assert.ok(result.includes("Note content"));
	});

	it("handles no ephemeral files gracefully", () => {
		writeFileSync(
			join(fullTestDir, "note.md"),
			"---\ntitle: Note\ntimestamp: 2024-01-01\n---\nNote content",
		);

		const result = loadContext(testDir, 10);
		assert.ok(result.includes("[Context: Note]"));
		assert.ok(!result.includes("[Ephemeral:"));
	});
});

describe("parseFrontmatter in context", () => {
	it("returns valid frontmatter object with title and timestamp as Date", () => {
		const content = "---\ntitle: Test Title\ntimestamp: 2024-01-15\n---\nTest body content";
		const result = parseFrontmatter(content);
		assert.strictEqual(result.frontmatter.title, "Test Title");
		// parseFrontmatter converts timestamps to Date objects
		assert.ok(result.frontmatter.timestamp instanceof Date);
		assert.strictEqual(result.content, "Test body content");
	});

	it("handles frontmatter without timestamp (timestamp is undefined)", () => {
		const content = "---\ntitle: No Timestamp\n---\nSome body";
		const result = parseFrontmatter(content);
		assert.strictEqual(result.frontmatter.title, "No Timestamp");
		assert.strictEqual(result.frontmatter.timestamp, undefined);
	});
});
