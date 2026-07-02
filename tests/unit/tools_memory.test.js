import { describe, it, after } from "node:test";
import assert from "node:assert";
import { memoryImpl, sanitizeKey } from "../../src/tools/memory.js";
import { mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { join } from "node:path";

const TEST_ENTRIES_DIR = "memory/__test_tools_memory__/";
const DIR = join(process.cwd(), TEST_ENTRIES_DIR);
const defaultOpts = { maxEntries: 100, contextDir: TEST_ENTRIES_DIR };

/**
 * Write a memory entry file directly to the entries directory.
 * @param {string} key - Entry key (already sanitized)
 * @param {string} value - Entry body content
 * @param {string} [createdDate] - Override createdDate (optional)
 * @param {string} [updatedDate] - Override updatedDate (optional)
 */
async function writeEntry(key, value, createdDate, updatedDate) {
	const now = createdDate || "2026-05-31T10:00:00.000Z";
	const up = updatedDate || "2026-05-31T10:00:00.000Z";
	await mkdir(DIR, { recursive: true });
	await writeFile(
		join(DIR, key + ".md"),
		`---\ncreatedDate: "${now}"\nupdatedDate: "${up}"\n---\n\n${value}\n`,
	);
}

describe("sanitizeKey", () => {
	it("returns lowercase snake_case", () => {
		assert.strictEqual(sanitizeKey("user_pet"), "user_pet");
	});

	it("converts camelCase to snake_case", () => {
		assert.strictEqual(sanitizeKey("userPet"), "user_pet");
	});

	it("converts spaces to underscores", () => {
		assert.strictEqual(sanitizeKey("my entry"), "my_entry");
	});

	it("converts dashes to underscores", () => {
		assert.strictEqual(sanitizeKey("user-pet"), "user_pet");
	});

	it("handles mixed separators", () => {
		assert.strictEqual(sanitizeKey("My-Entry_test"), "my_entry_test");
	});

	it("strips trailing .md", () => {
		assert.strictEqual(sanitizeKey("user_pet.md"), "user_pet");
	});

	it("converts uppercase", () => {
		assert.strictEqual(sanitizeKey("USER_PET"), "user_pet");
	});

	it("returns default for empty key", () => {
		assert.strictEqual(sanitizeKey(""), "unnamed_entry");
	});

	it("returns default for special chars only", () => {
		assert.strictEqual(sanitizeKey("---!!!---"), "unnamed_entry");
	});

	it("handles leading/trailing underscores", () => {
		assert.strictEqual(sanitizeKey("_test_"), "test");
	});

	it("collapses consecutive separators", () => {
		assert.strictEqual(sanitizeKey("user___pet"), "user_pet");
	});
});

describe("memoryImpl", () => {
	after(async () => {
		try {
			await rm(DIR, { recursive: true, force: true });
		} catch {
			// ignore
		}
	});

	// --- create ---

	it("create requires key and value", async () => {
		const result = JSON.parse(await memoryImpl({ action: "create" }, defaultOpts));
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("requires"));
	});

	it("create stores entry as individual file", async () => {
		const result = JSON.parse(
			await memoryImpl(
				{ action: "create", key: "test_entry_1", value: "Hello world" },
				defaultOpts,
			),
		);
		assert.strictEqual(result.ok, true);
		const content = await readFile(join(DIR, "test_entry_1.md"), "utf-8");
		assert.ok(content.includes("createdDate"));
		assert.ok(content.includes("updatedDate"));
	});

	it("create writes with sanitized key", async () => {
		const result = JSON.parse(
			await memoryImpl({ action: "create", key: "My Pet", value: "Halo" }, defaultOpts),
		);
		assert.strictEqual(result.message.includes("my_pet"), true);
		const f = await import("node:fs/promises");
		const files = await f.readdir(DIR).catch(() => []);
		assert.ok(files.some((f) => f.includes("my_pet")));
	});

	it("create fails when maxEntries exceeded", async () => {
		const opts = { maxEntries: 1 };
		await memoryImpl({ action: "create", key: "cap_first", value: "test" }, opts);
		const failResult = JSON.parse(
			await memoryImpl({ action: "create", key: "overflow", value: "nope" }, opts),
		);
		assert.strictEqual(failResult.ok, false);
		assert.ok(failResult.error.includes("exceed maximum"));
	});

	// --- read ---

	it("read requires key", async () => {
		const result = JSON.parse(await memoryImpl({ action: "read" }, defaultOpts));
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("requires"));
	});

	it("read returns entry data", async () => {
		await writeEntry("read_test", "read value", "2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z");
		const result = JSON.parse(await memoryImpl({ action: "read", key: "read_test" }, defaultOpts));
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.value, "read value");
		assert.strictEqual(result.createdDate, "2026-01-01T00:00:00Z");
		assert.strictEqual(result.updatedDate, "2026-02-01T00:00:00Z");
	});

	it("read rejects non-existent key", async () => {
		const result = JSON.parse(
			await memoryImpl({ action: "read", key: "does_not_exist" }, defaultOpts),
		);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("not found"));
	});

	// --- update ---

	it("update requires key and value", async () => {
		const result = JSON.parse(await memoryImpl({ action: "update" }, defaultOpts));
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("requires"));
	});

	it("update updates existing entry", async () => {
		await writeEntry("update_me", "old", "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z");
		const result = JSON.parse(
			await memoryImpl({ action: "update", key: "update_me", value: "new" }, defaultOpts),
		);
		assert.strictEqual(result.ok, true);
		const readResult = JSON.parse(
			await memoryImpl({ action: "read", key: "update_me" }, defaultOpts),
		);
		assert.strictEqual(readResult.value, "new");
	});

	it("update rejects non-existent key", async () => {
		const result = JSON.parse(
			await memoryImpl({ action: "update", key: "no_such_key", value: "data" }, defaultOpts),
		);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("not found"));
	});

	// --- delete ---

	it("delete requires key", async () => {
		const result = JSON.parse(await memoryImpl({ action: "delete" }, defaultOpts));
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("requires"));
	});

	it("delete removes entry file", async () => {
		await writeEntry("del_test", "to delete", "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z");
		const result = JSON.parse(await memoryImpl({ action: "delete", key: "del_test" }, defaultOpts));
		assert.strictEqual(result.ok, true);
		const f = await import("node:fs/promises");
		assert.rejects(f.readFile(join(DIR, "del_test.md")), "file should be deleted");
	});

	it("delete rejects non-existent key", async () => {
		const result = JSON.parse(await memoryImpl({ action: "delete", key: "not_here" }, defaultOpts));
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("not found"));
	});

	// --- list ---

	it("list returns empty array when directory is empty", async () => {
		// Ensure no leftover files
		try {
			await rm(DIR, { recursive: true, force: true });
		} catch {
			/* ignore */
		}
		await mkdir(DIR, { recursive: true });
		const result = JSON.parse(await memoryImpl({ action: "list" }, defaultOpts));
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.total, 0);
		assert.deepStrictEqual(result.entries, []);
	});

	it("list returns all entries sorted by update date descending", async () => {
		const fs = await import("node:fs/promises");
		// Clean up leftover files from previous tests
		const existingFiles = await fs.readdir(DIR).catch(() => []);
		for (const f of existingFiles) await fs.unlink(join(DIR, f));
		// Now create test entries
		await writeEntry("a_list", "first", "2026-01-01T00:00:00Z", "2026-01-01T10:00:00Z");
		await writeEntry("b_list", "second", "2026-01-01T00:00:00Z", "2026-02-01T10:00:00Z");
		await writeEntry("c_list", "third", "2026-01-01T00:00:00Z", "2026-03-01T10:00:00Z");
		const result = JSON.parse(await memoryImpl({ action: "list" }, defaultOpts));
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.total, 3);
		assert.strictEqual(result.entries[0].key, "c_list");
		assert.strictEqual(result.entries[1].key, "b_list");
		assert.strictEqual(result.entries[2].key, "a_list");
	});

	it("list supports query filter", async () => {
		const fs = await import("node:fs/promises");
		const existingFiles = await fs.readdir(DIR).catch(() => []);
		for (const f of existingFiles) await fs.unlink(join(DIR, f));
		await writeEntry("list_a", "cat", "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z");
		await writeEntry("list_b", "pizza", "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z");
		const result = JSON.parse(await memoryImpl({ action: "list", query: "pizza" }, defaultOpts));
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.total, 1);
		assert.strictEqual(result.entries[0].key, "list_b");
	});

	it("list filter is case-insensitive", async () => {
		const fs = await import("node:fs/promises");
		const existingFiles = await fs.readdir(DIR).catch(() => []);
		for (const f of existingFiles) await fs.unlink(join(DIR, f));
		await writeEntry("list_c", "PIZZA", "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z");
		const result = JSON.parse(await memoryImpl({ action: "list", query: "pizza" }, defaultOpts));
		assert.strictEqual(result.total, 1);
	});

	it("list returns empty for no match", async () => {
		await writeEntry("list_d", "cat", "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z");
		const result = JSON.parse(await memoryImpl({ action: "list", query: "xyz123" }, defaultOpts));
		assert.strictEqual(result.total, 0);
	});

	it("create with value converts non-string", async () => {
		const result = JSON.parse(
			await memoryImpl({ action: "create", key: "num_entry", value: 42 }, defaultOpts),
		);
		assert.strictEqual(result.ok, true);
		const readResult = JSON.parse(
			await memoryImpl({ action: "read", key: "num_entry" }, defaultOpts),
		);
		assert.strictEqual(readResult.value, "42");
	});
});
