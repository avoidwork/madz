import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { mkdtemp, rm, writeFile, utimes, readdir, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanRetainedMemory, enforceMaxEntries } from "../../../src/memory/retention.js";

describe("memory/retention", () => {
	let base;
	const dir = join("ctx");

	async function put(name, ageDays) {
		const p = join(base, dir, name);
		await writeFile(p, "x");
		const t = new Date(Date.now() - ageDays * 86400000);
		await utimes(p, t, t);
	}

	beforeEach(async () => {
		base = await mkdtemp(join(tmpdir(), "madz-ret-"));
		await mkdir(join(base, dir));
	});
	afterEach(() => rm(base, { recursive: true, force: true }));

	it("cleanRetainedMemory preserves profile.md and reflection.md", async () => {
		await put("profile.md", 400);
		await put("reflection.md", 400);
		await put("old.md", 400);
		await put("new.md", 1);
		const removed = await cleanRetainedMemory(dir, 90, base);
		assert.strictEqual(removed, 1);
		assert.deepStrictEqual((await readdir(join(base, dir))).sort(), [
			"new.md",
			"profile.md",
			"reflection.md",
		]);
	});

	it("enforceMaxEntries does not delete or count protected files", async () => {
		await put("profile.md", 500);
		await put("reflection.md", 500);
		await put("a.md", 3);
		await put("b.md", 2);
		await put("c.md", 1);
		const removed = await enforceMaxEntries(dir, 2, base);
		assert.strictEqual(removed, 1);
		const left = (await readdir(join(base, dir))).sort();
		assert.deepStrictEqual(left, ["b.md", "c.md", "profile.md", "reflection.md"]);
	});

	it("skips directories named *.md without aborting", async () => {
		await mkdir(join(base, dir, "weird.md"));
		await put("old.md", 400);
		assert.strictEqual(await cleanRetainedMemory(dir, 90, base), 1);
	});

	it("validates arguments", async () => {
		await assert.rejects(cleanRetainedMemory(dir, -1, base), RangeError);
		await assert.rejects(cleanRetainedMemory(dir, NaN, base), RangeError);
		await assert.rejects(enforceMaxEntries(dir, 1.5, base), RangeError);
		await assert.rejects(enforceMaxEntries(dir, -1, base), RangeError);
	});

	it("returns 0 for missing directory and rejects escapes", async () => {
		assert.strictEqual(await cleanRetainedMemory("nope", 1, base), 0);
		assert.strictEqual(await cleanRetainedMemory("../escape", 1, base), 0);
	});
});
