import { describe, it, after, beforeEach } from "node:test";
import assert from "node:assert";
import { mkdirSync, writeFileSync, rmSync, utimesSync } from "node:fs";
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

	it("returns combined context from markdown files sorted by timestamp descending", async () => {
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

		const result = await loadContext(testDir, 3);
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

	it("respects the limit parameter", async () => {
		writeFileSync(join(fullTestDir, "a.md"), "---\ntitle: A\ntimestamp: 2024-01-01\n---\nAAA");
		writeFileSync(join(fullTestDir, "b.md"), "---\ntitle: B\ntimestamp: 2024-01-02\n---\nBBB");
		writeFileSync(join(fullTestDir, "c.md"), "---\ntitle: C\ntimestamp: 2024-01-03\n---\nCCC");

		const result = await loadContext(testDir, 2);
		assert.ok(result.includes("[Context: B]"));
		assert.ok(result.includes("[Context: C]"));
		assert.ok(!result.includes("[Context: A]"), "A should be excluded with limit 2");
	});

	it("filters out non-.md files", async () => {
		writeFileSync(
			join(fullTestDir, "valid.md"),
			"---\ntitle: Valid\ntimestamp: 2024-01-01\n---\nValid content",
		);
		writeFileSync(join(fullTestDir, "invalid.txt"), "this is not markdown");

		const result = await loadContext(testDir, 10);
		assert.ok(result.includes("[Context: Valid]"));
		assert.ok(!result.includes("[Context: invalid.txt]"));
		assert.ok(!result.includes("this is not markdown"));
	});

	it("returns empty string for non-existent directory", async () => {
		const result = await loadContext("__nonexistent_dir_xyz__", 10);
		assert.strictEqual(result, "");
	});

	it("returns empty string for empty directory", async () => {
		const emptyDir = "__empty_ctx_test__";
		mkdirSync(join(process.cwd(), emptyDir), { recursive: true });
		try {
			const result = await loadContext(emptyDir, 10);
			assert.strictEqual(result, "");
		} finally {
			rmSync(join(process.cwd(), emptyDir), { recursive: true, force: true });
		}
	});

	it("trims body content of each context entry", async () => {
		writeFileSync(
			join(fullTestDir, "trimmed.md"),
			"---\ntitle: Trimmed\ntimestamp: 2024-01-01\n---\n  some text with spaces  \n",
		);

		const result = await loadContext(testDir, 10);
		assert.ok(result.includes("some text with spaces"));
	});

	it("handles files without timestamp (falls back to empty string sort)", async () => {
		writeFileSync(
			join(fullTestDir, "no-ts.md"),
			"---\ntitle: No Timestamp\n---\nNo timestamp body",
		);
		writeFileSync(
			join(fullTestDir, "with-ts.md"),
			"---\ntitle: With Timestamp\ntimestamp: 2024-01-01\n---\nHas timestamp body",
		);

		const result = await loadContext(testDir, 10);
		assert.ok(result.includes("No Timestamp"));
		assert.ok(result.includes("With Timestamp"));
	});

	it("filters out ephemeral files from main processing", async () => {
		writeFileSync(
			join(fullTestDir, "persistent.md"),
			"---\ntitle: Persistent\ntimestamp: 2024-01-03\n---\nPersistent content",
		);
		writeFileSync(
			join(fullTestDir, "ephemeral-note.md"),
			"---\ntitle: Ephemeral Note\ntimestamp: 2024-01-04\n---\nEphemeral content",
		);

		const result = await loadContext(testDir, 10);
		assert.ok(result.includes("[Context: Persistent]"));
		assert.ok(result.includes("Persistent content"));
		// Ephemeral files should not appear as [Context:] entries
		assert.ok(!result.includes("[Context: Ephemeral Note]"));
	});

	it("loads ephemeral files last with correct sort order", async () => {
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

		const result = await loadContext(testDir, 10);
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

	it("respects ephemeral limit", async () => {
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

		const result = await loadContext(testDir, 10);
		// Should only include up to 5 ephemeral files (default limit)
		let count = 0;
		for (let i = 1; i <= 7; i++) {
			if (result.includes(`Ephemeral ${i}`)) count++;
		}
		assert.strictEqual(count, 5, "Should only load 5 ephemeral files by default");
	});

	it("reads only ephemeralLimit ephemeral files when more exist", async () => {
		writeFileSync(
			join(fullTestDir, "persistent.md"),
			"---\ntitle: Persistent\ntimestamp: 2024-01-01\n---\nPersistent content",
		);
		// Create more ephemeral files than the default limit (5)
		for (let i = 1; i <= 8; i++) {
			writeFileSync(
				join(fullTestDir, `ephemeral-${i}.md`),
				`---\ntitle: Ephemeral ${i}\ntimestamp: 2024-01-0${i}\nephemeral: true\nephemeral_expiresAt: "2099-01-01T00:00:00.000Z"\n---\nEphemeral ${i} content`,
			);
		}

		const result = await loadContext(testDir, 10);
		let count = 0;
		for (let i = 1; i <= 8; i++) {
			if (result.includes(`Ephemeral ${i}`)) count++;
		}
		assert.strictEqual(count, 5, "Should only read 5 ephemeral files by default");
	});

	it("orders ephemeral files newest-first by mtime", async () => {
		writeFileSync(
			join(fullTestDir, "persistent.md"),
			"---\ntitle: Persistent\ntimestamp: 2024-01-01\n---\nPersistent content",
		);
		// Create ephemeral files with distinct mtimes (oldest first)
		const files = [
			["ephemeral-old.md", "Ephemeral Old"],
			["ephemeral-mid.md", "Ephemeral Mid"],
			["ephemeral-new.md", "Ephemeral New"],
		];
		const baseTime = new Date("2024-01-01T00:00:00Z").getTime();
		files.forEach(([name, title], idx) => {
			const filepath = join(fullTestDir, name);
			writeFileSync(
				filepath,
				`---\ntitle: ${title}\ntimestamp: 2024-01-0${idx + 1}\nephemeral: true\nephemeral_expiresAt: "2099-01-01T00:00:00.000Z"\n---\n${title} content`,
			);
			// Set mtime: old=base, mid=base+1d, new=base+2d
			utimesSync(
				filepath,
				new Date(baseTime + idx * 86400000),
				new Date(baseTime + idx * 86400000),
			);
		});

		const result = await loadContext(testDir, 10);
		const newIdx = result.indexOf("Ephemeral New");
		const midIdx = result.indexOf("Ephemeral Mid");
		const oldIdx = result.indexOf("Ephemeral Old");
		assert.ok(newIdx !== -1, "Newest ephemeral should be present");
		assert.ok(midIdx !== -1, "Middle ephemeral should be present");
		assert.ok(oldIdx !== -1, "Oldest ephemeral should be present");
		assert.ok(newIdx < midIdx, "Newest ephemeral should come before middle");
		assert.ok(midIdx < oldIdx, "Middle ephemeral should come before oldest");
	});

	it("excludes ephemeral files outside the time range (expired)", async () => {
		writeFileSync(
			join(fullTestDir, "persistent.md"),
			"---\ntitle: Persistent\ntimestamp: 2024-01-01\n---\nPersistent content",
		);
		// Expired ephemeral file (expiresAt in the past)
		writeFileSync(
			join(fullTestDir, "ephemeral-expired.md"),
			'---\ntitle: Ephemeral Expired\ntimestamp: 2024-01-01\nephemeral: true\nephemeral_expiresAt: "2020-01-01T00:00:00.000Z"\n---\nExpired ephemeral content',
		);
		// Non-expired ephemeral file (expiresAt in the future)
		writeFileSync(
			join(fullTestDir, "ephemeral-active.md"),
			'---\ntitle: Ephemeral Active\ntimestamp: 2024-01-02\nephemeral: true\nephemeral_expiresAt: "2099-01-01T00:00:00.000Z"\n---\nActive ephemeral content',
		);

		const result = await loadContext(testDir, 10);
		assert.ok(
			result.includes("[Ephemeral: Ephemeral Active]"),
			"Active ephemeral should be present",
		);
		assert.ok(result.includes("Active ephemeral content"));
		assert.ok(
			!result.includes("[Ephemeral: Ephemeral Expired]"),
			"Expired ephemeral should be excluded",
		);
		assert.ok(!result.includes("Expired ephemeral content"));
	});

	it("handles missing profile.md gracefully", async () => {
		writeFileSync(
			join(fullTestDir, "note.md"),
			"---\ntitle: Note\ntimestamp: 2024-01-01\n---\nNote content",
		);

		const result = await loadContext(testDir, 10);
		assert.ok(result.includes("[Context: Note]"));
		assert.ok(result.includes("Note content"));
	});

	it("handles no ephemeral files gracefully", async () => {
		writeFileSync(
			join(fullTestDir, "note.md"),
			"---\ntitle: Note\ntimestamp: 2024-01-01\n---\nNote content",
		);

		const result = await loadContext(testDir, 10);
		assert.ok(result.includes("[Context: Note]"));
		assert.ok(!result.includes("[Ephemeral:"));
	});

	it("does not include clarifications.md from memory/tools", async () => {
		// clarifications.md now lives in memory/tools/ (config.memory.toolsDir),
		// so loadContext() reading from memory/context/ must not pick it up.
		const toolsDir = join(process.cwd(), "memory", "tools");
		mkdirSync(toolsDir, { recursive: true });
		writeFileSync(
			join(toolsDir, "clarifications.md"),
			"## Clarification: Should this be in the system prompt?",
		);

		writeFileSync(
			join(fullTestDir, "note.md"),
			"---\ntitle: Note\ntimestamp: 2024-01-01\n---\nNote content",
		);

		const result = await loadContext(testDir, 10);
		assert.ok(result.includes("[Context: Note]"));
		assert.ok(!result.includes("Should this be in the system prompt?"));
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
