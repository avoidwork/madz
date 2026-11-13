import { describe, it, after } from "node:test";
import assert from "node:assert";
import { readFile, rm, stat, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { writeMemoryFile } from "../../../src/memory/writer.js";
import { parseFrontmatter } from "../../../src/memory/reader.js";
import { loadConfig } from "../../../src/config/loader.js";

// Writer resolves against config.cwd; use a dedicated scratch subdirectory
// (never the real memory/context/) and remove it afterwards.
const SUB = "memory/__test_writer_unit__/";

describe("memory/writer", () => {
	after(() => rm(join(loadConfig().cwd, SUB), { recursive: true, force: true }));

	it("round-trips tricky values through yaml.dump", async () => {
		const title = 'He said "hi"\nline2: x';
		const p = await writeMemoryFile(SUB, title, { note: "a: b\n---\nc", n: 3, ok: true }, "Body");
		const { frontmatter, content } = parseFrontmatter(await readFile(p, "utf-8"));
		assert.strictEqual(frontmatter.title, title);
		assert.strictEqual(frontmatter.note, "a: b\n---\nc");
		assert.strictEqual(frontmatter.n, 3);
		assert.strictEqual(content, "Body");
		assert.ok(frontmatter.timestamp instanceof Date);
		assert.ok(!Number.isNaN(frontmatter.timestamp.getTime()));
	});

	it("writes real ISO timestamp, 0600 mode, random suffix and no tmp leftovers", async () => {
		const p = await writeMemoryFile(SUB, "Same", {}, "x");
		const q = await writeMemoryFile(SUB, "Same", {}, "x");
		assert.notStrictEqual(p, q);
		assert.strictEqual((await stat(p)).mode & 0o777, 0o600);
		const raw = await readFile(p, "utf-8");
		assert.match(raw, /timestamp: ['"]?\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
		const names = await readdir(dirname(p));
		assert.ok(!names.some((n) => n.endsWith(".tmp")));
	});

	it("defaults frontmatter, drops undefined and caps slug length", async () => {
		const p = await writeMemoryFile(SUB, "x".repeat(500));
		assert.ok(p.split("/").pop().length < 140);
		const p2 = await writeMemoryFile(SUB, "u", { a: undefined, b: null }, "");
		const { frontmatter } = parseFrontmatter(await readFile(p2, "utf-8"));
		assert.ok(!("a" in frontmatter));
		assert.strictEqual(frontmatter.b, null);
	});

	it("rejects bad titles, keys, reserved keys and escaping subdirectories", async () => {
		await assert.rejects(writeMemoryFile(SUB, 42, {}), TypeError);
		await assert.rejects(writeMemoryFile(SUB, "t", { "bad key": 1 }), RangeError);
		await assert.rejects(writeMemoryFile(SUB, "t", { "a: b\nc": 1 }), RangeError);
		await assert.rejects(writeMemoryFile(SUB, "t", { title: "x" }), RangeError);
		await assert.rejects(writeMemoryFile(SUB, "t", { timestamp: "x" }), RangeError);
		await assert.rejects(writeMemoryFile(SUB, "t", []), TypeError);
		await assert.rejects(writeMemoryFile("../outside", "t", {}), { code: "EPATHESCAPE" });
		await assert.rejects(writeMemoryFile("/tmp/abs", "t", {}), { code: "EPATHESCAPE" });
	});
});
