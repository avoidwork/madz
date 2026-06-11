import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";

import {
	loadMemories,
	formatMemoriesForPrompt,
	parseEntryFile,
} from "../../src/memory/loadMemories.js";

const TEST_DIR = "memory/__test_memories__/";
const FULL_DIR = join(process.cwd(), TEST_DIR);

function setup() {
	return mkdir(FULL_DIR, { recursive: true });
}

function teardown() {
	return rm(join(process.cwd(), "memory", "__test_memories__"), { recursive: true, force: true });
}

describe("parseEntryFile", () => {
	before(setup);
	after(teardown);

	it("returns null for non-existent file", async () => {
		const result = await parseEntryFile(join(process.cwd(), TEST_DIR + "nonexistent.md"));
		assert.strictEqual(result, null);
	});

	it("parses a file with createdDate and updatedDate", async () => {
		const path = join(FULL_DIR, "test_entry.md");
		const content =
			'---\ncreatedDate: "2026-01-01T00:00:00Z"\nupdatedDate: "2026-01-02T00:00:00Z"\n---\n\nBody content here.';
		await writeFile(path, content);
		const result = await parseEntryFile(path);
		assert.ok(result);
		assert.strictEqual(result.metadata.createdDate, "2026-01-01T00:00:00Z");
		assert.strictEqual(result.metadata.updatedDate, "2026-01-02T00:00:00Z");
		assert.strictEqual(result.memory, "Body content here.");
	});

	it("uses current date when createdDate missing", async () => {
		const now = new Date().toISOString();
		const path = join(FULL_DIR, "no_created.md");
		await writeFile(path, '---\nupdatedDate: "2026-02-01T00:00:00Z"\n---\n\nBody.');
		const result = await parseEntryFile(path);
		assert.ok(result);
		assert.strictEqual(result.metadata.createdDate.slice(0, 10), now.slice(0, 10));
		assert.strictEqual(result.metadata.updatedDate, "2026-02-01T00:00:00Z");
	});

	it("omits updatedDate when not present", async () => {
		const path = join(FULL_DIR, "no_updated.md");
		await writeFile(path, '---\ncreatedDate: "2026-01-01T00:00:00Z"\n---\n\nBody.');
		const result = await parseEntryFile(path);
		assert.ok(result);
		assert.strictEqual(result.metadata.createdDate, "2026-01-01T00:00:00Z");
		assert.ok(!result.metadata.updatedDate);
	});

	it("extracts only frontmatter metadata, not value or key fields", async () => {
		const path = join(FULL_DIR, "no_value.md");
		await writeFile(path, '---\ncreatedDate: "2026-01-01T00:00:00Z"\n---\n\nMemory value.');
		const result = await parseEntryFile(path);
		assert.ok(result);
		assert.ok(!("value" in result.metadata));
		assert.ok(!("key" in result.metadata));
	});

	it("lowercases the key from filename", async () => {
		// parseEntryFile does not store key in metadata — key is derived in loadMemories from filename
		const path = join(FULL_DIR, "MixedCase.md");
		await writeFile(path, '---\ncreatedDate: "2026-01-01T00:00:00Z"\n---\n\nBody.');
		const result = await parseEntryFile(path);
		assert.ok(result);
		assert.strictEqual(result.metadata.createdDate, "2026-01-01T00:00:00Z");
	});

	it("handles file with multi-line body", async () => {
		const path = join(FULL_DIR, "multiline.md");
		const body = "Line one\nLine two\nLine three";
		await writeFile(path, `---\ncreatedDate: "2026-01-01T00:00:00Z"\n---\n\n${body}`);
		const result = await parseEntryFile(path);
		assert.strictEqual(result.memory, body);
	});

	it("handles file without frontmatter", async () => {
		const path = join(FULL_DIR, "plain.md");
		await writeFile(path, "Just plain body text.");
		const result = await parseEntryFile(path);
		assert.ok(result);
		assert.strictEqual(result.memory, "Just plain body text.");
	});
});

describe("loadMemories", () => {
	before(setup);
	after(teardown);

	afterEach(async () => {
		const files = await import("node:fs/promises");
		const allFiles = (await files.readdir(FULL_DIR)).filter((f) => f.endsWith(".md"));
		for (const file of allFiles) {
			await files.unlink(join(FULL_DIR, file));
		}
	});

	it("returns empty array when directory does not exist", async () => {
		await rm(FULL_DIR, { recursive: true, force: true });
		const result = await loadMemories(TEST_DIR);
		assert.deepStrictEqual(result, []);
		await setup();
	});

	it("returns empty array when directory is empty", async () => {
		const result = await loadMemories(TEST_DIR);
		assert.deepStrictEqual(result, []);
	});

	it("loads all entry files from the directory", async () => {
		await writeFile(
			join(FULL_DIR, "a.md"),
			'---\ncreatedDate: "2026-01-01T00:00:00Z"\n---\n\nBody A.',
		);
		await writeFile(
			join(FULL_DIR, "b.md"),
			'---\ncreatedDate: "2026-01-02T00:00:00Z"\n---\n\nBody B.',
		);
		await writeFile(
			join(FULL_DIR, "c.md"),
			'---\ncreatedDate: "2026-01-03T00:00:00Z"\n---\n\nBody C.',
		);
		const result = await loadMemories(TEST_DIR);
		assert.strictEqual(result.length, 3);
	});

	it("sorts entries by updatedDate descending", async () => {
		await writeFile(
			join(FULL_DIR, "c.md"),
			'---\ncreatedDate: "2026-01-01T00:00:00Z"\nupdatedDate: "2026-03-01T00:00:00Z"\n---\n\nC.',
		);
		await writeFile(
			join(FULL_DIR, "b.md"),
			'---\ncreatedDate: "2026-01-01T00:00:00Z"\nupdatedDate: "2026-02-01T00:00:00Z"\n---\n\nB.',
		);
		await writeFile(
			join(FULL_DIR, "a.md"),
			'---\ncreatedDate: "2026-01-01T00:00:00Z"\nupdatedDate: "2026-01-01T00:00:00Z"\n---\n\nA.',
		);
		const result = await loadMemories(TEST_DIR);
		assert.strictEqual(result[0].key, "c");
		assert.strictEqual(result[1].key, "b");
		assert.strictEqual(result[2].key, "a");
	});

	it("falls back to createdDate when updatedDate is missing", async () => {
		await writeFile(join(FULL_DIR, "a.md"), '---\ncreatedDate: "2026-03-01T00:00:00Z"\n---\n\nA.');
		await writeFile(join(FULL_DIR, "b.md"), '---\ncreatedDate: "2026-01-01T00:00:00Z"\n---\n\nB.');
		const result = await loadMemories(TEST_DIR);
		assert.strictEqual(result[0].key, "a");
		assert.strictEqual(result[1].key, "b");
	});

	it("skips non-.md files", async () => {
		const fs = await import("node:fs/promises");
		await writeFile(join(FULL_DIR, "data.json"), '{"key":"value"}');
		await writeFile(join(FULL_DIR, "a.md"), '---\ncreatedDate: "2026-01-01T00:00:00Z"\n---\n\nA.');
		const result = await loadMemories(TEST_DIR);
		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].key, "a");
		await fs.unlink(join(FULL_DIR, "data.json"));
	});

	it("returns structured objects with metadata and memory", async () => {
		await writeFile(
			join(FULL_DIR, "test.md"),
			'---\ncreatedDate: "2026-01-01T00:00:00Z"\n---\n\nTest value.',
		);
		const result = await loadMemories(TEST_DIR);
		assert.strictEqual(result[0].key, "test");
		assert.strictEqual(result[0].memory, "Test value.");
	});
});

describe("formatMemoriesForPrompt", () => {
	it("returns empty string for empty array", () => {
		const result = formatMemoriesForPrompt([]);
		assert.strictEqual(result, "");
	});

	it("formats single entry with header", () => {
		const entries = [
			{ key: "test", metadata: { createdDate: "2026-01-01T00:00:00Z" }, memory: "Test value" },
		];
		const result = formatMemoriesForPrompt(entries);
		assert.ok(result.includes("The following memories are loaded into your context"));
		assert.ok(result.includes("---"));
		assert.ok(result.includes("[TEST (created: 2026-01-01)]"));
		assert.ok(result.includes("Test value"));
	});

	it("formats multiple entries", () => {
		const entries = [
			{ key: "pets", metadata: { createdDate: "2026-01-01T00:00:00Z" }, memory: "Cat: Halo" },
			{ key: "goals", metadata: { createdDate: "2026-01-01T00:00:00Z" }, memory: "Save for house" },
		];
		const result = formatMemoriesForPrompt(entries);
		assert.ok(result.includes("[PETS (created: 2026-01-01)]"));
		assert.ok(result.includes("Cat: Halo"));
		assert.ok(result.includes("[GOALS (created: 2026-01-01)]"));
		assert.ok(result.includes("Save for house"));
	});

	it("separates entries with double newlines", () => {
		const entries = [
			{ key: "a", metadata: { createdDate: "2026-01-01T00:00:00Z" }, memory: "A" },
			{ key: "b", metadata: { createdDate: "2026-01-01T00:00:00Z" }, memory: "B" },
		];
		const result = formatMemoriesForPrompt(entries);
		assert.ok(result.includes("---\n\n---"));
	});
});
