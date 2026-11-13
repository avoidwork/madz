import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdtemp, rm, symlink, stat, mkdir, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	resolveInside,
	resolveInsideReal,
	ensureDir,
	resolveContextDir,
	PathContainmentError,
} from "../../../src/memory/paths.js";
import { writeFileAtomic, mapInBatches } from "../../../src/memory/fsUtil.js";

describe("memory/paths", () => {
	let base;
	let outside;

	before(async () => {
		base = await mkdtemp(join(tmpdir(), "madz-paths-"));
		outside = await mkdtemp(join(tmpdir(), "madz-outside-"));
	});
	after(async () => {
		await rm(base, { recursive: true, force: true });
		await rm(outside, { recursive: true, force: true });
	});

	it("resolves relative paths inside base", () => {
		assert.strictEqual(resolveInside(base, "a/b"), join(base, "a", "b"));
		assert.strictEqual(resolveInside(base, "."), base);
	});

	it("rejects .., absolute and NUL paths", () => {
		assert.throws(() => resolveInside(base, "../x"), PathContainmentError);
		assert.throws(() => resolveInside(base, "a/../../x"), PathContainmentError);
		assert.throws(() => resolveInside(base, "/etc"), PathContainmentError);
		assert.throws(() => resolveInside(base, "a\0b"), PathContainmentError);
		assert.throws(() => resolveInside(base, 5), PathContainmentError);
	});

	it("rejects sibling directories sharing a prefix", () => {
		assert.throws(() => resolveInside(base, "../" + base.split("/").pop() + "-evil"));
	});

	it("rejects symlinks that escape the base", async () => {
		await symlink(outside, join(base, "link"));
		await assert.rejects(resolveInsideReal(base, "link/sub"), PathContainmentError);
		await assert.rejects(ensureDir(base, "link/sub"), PathContainmentError);
	});

	it("ensureDir creates directories and accepts absolute inside base", async () => {
		const dir = await ensureDir(base, "x/y");
		assert.ok((await stat(dir)).isDirectory());
		await ensureDir(base, join(base, "abs"));
		assert.ok((await stat(join(base, "abs"))).isDirectory());
		await assert.rejects(ensureDir(base, outside), PathContainmentError);
	});

	it("resolveContextDir handles relative and contained absolute", () => {
		assert.strictEqual(resolveContextDir("ctx/", base), join(base, "ctx"));
		assert.strictEqual(resolveContextDir(join(base, "ctx"), base), join(base, "ctx"));
		assert.throws(() => resolveContextDir(outside, base), PathContainmentError);
	});

	it("writeFileAtomic writes the file and leaves no tmp files", async () => {
		await mkdir(join(base, "w"), { recursive: true });
		const target = join(base, "w", "f.md");
		await writeFileAtomic(target, "hello");
		assert.strictEqual(await readFile(target, "utf-8"), "hello");
		assert.deepStrictEqual(await readdir(join(base, "w")), ["f.md"]);
	});

	it("writeFileAtomic cleans up and rethrows on failure", async () => {
		await mkdir(join(base, "d", "target.md"), { recursive: true });
		await assert.rejects(writeFileAtomic(join(base, "d", "target.md"), "x"));
		assert.deepStrictEqual(await readdir(join(base, "d")), ["target.md"]);
	});

	it("mapInBatches preserves order", async () => {
		const out = await mapInBatches([1, 2, 3, 4, 5], 2, async (n) => n * 2);
		assert.deepStrictEqual(out, [2, 4, 6, 8, 10]);
	});
});
