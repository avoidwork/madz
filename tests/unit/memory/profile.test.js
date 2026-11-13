import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { mkdtemp, rm, readFile, readdir, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	loadProfile,
	saveProfile,
	hasProfile,
	sanitizeProfileData,
} from "../../../src/memory/profile.js";

describe("memory/profile (hardening)", () => {
	let base;
	let path;
	beforeEach(async () => {
		base = await mkdtemp(join(tmpdir(), "madz-prof-"));
		path = join(base, "sub", "profile.md");
	});
	afterEach(() => rm(base, { recursive: true, force: true }));

	it("collapses newlines, caps length, writes 0600 without tmp leftovers", async () => {
		await saveProfile({ name: "Jo\nnotes: injected", notes: "y".repeat(2000) }, path);
		const raw = await readFile(path, "utf-8");
		const lines = raw.trim().split("\n");
		assert.strictEqual(lines.length, 2);
		assert.strictEqual(lines[0], "name: Jo notes: injected");
		assert.ok(lines[1].length <= "notes: ".length + 500);
		assert.deepStrictEqual(await readdir(join(base, "sub")), ["profile.md"]);
	});

	it("rejects control characters", async () => {
		await assert.rejects(saveProfile({ name: "a\u0007b" }, path), RangeError);
	});

	it("loadProfile returns null only for ENOENT; hasProfile reflects existence", async () => {
		assert.strictEqual(await loadProfile(path), null);
		assert.strictEqual(await hasProfile(path), false);
		await saveProfile({ name: "Jo" }, path);
		assert.strictEqual(await hasProfile(path), true);
		assert.strictEqual((await loadProfile(path)).data.name, "Jo");
	});

	it("loadProfile throws on EACCES", async (t) => {
		if (process.getuid?.() === 0) return t.skip("root bypasses file permissions");
		await saveProfile({ name: "Jo" }, path);
		await chmod(path, 0o000);
		await assert.rejects(loadProfile(path), { code: "EACCES" });
	});

	it("sanitizeProfileData tolerates null/undefined and non-strings", () => {
		assert.deepStrictEqual(sanitizeProfileData(null), {});
		assert.deepStrictEqual(sanitizeProfileData(undefined), {});
		assert.deepStrictEqual(sanitizeProfileData({ name: 5 }), { name: "5" });
	});

	it("saveProfile tolerates null data", async () => {
		await saveProfile(null, path);
		await writeFile(path + ".x", "");
		assert.strictEqual(await loadProfile(path), null);
	});
});
