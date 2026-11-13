import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { mkdtemp, rm, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	expireEphemeralMemories,
	isExpired,
	isEphemeralFile,
	resolveContextDir,
	readEphemeralFile,
} from "../../../src/memory/expireEphemeralMemories.js";

describe("memory/expireEphemeralMemories (hardening)", () => {
	let base;
	beforeEach(async () => {
		base = await mkdtemp(join(tmpdir(), "madz-exp-"));
	});
	afterEach(() => rm(base, { recursive: true, force: true }));

	it("isExpired fails closed on invalid expiresAt and validates now", () => {
		const now = new Date("2026-06-05T00:00:00Z");
		assert.strictEqual(isExpired("garbage", now), true);
		assert.strictEqual(isExpired("", now), false);
		assert.strictEqual(isExpired(undefined, now), false);
		assert.strictEqual(isExpired("2020-01-01T00:00:00Z", now), true);
		assert.strictEqual(isExpired("2030-01-01T00:00:00Z", now), false);
		assert.throws(() => isExpired("2030-01-01", new Date("nope")), RangeError);
	});

	it("isEphemeralFile uses flag or filename prefix", () => {
		assert.strictEqual(isEphemeralFile("x.md", { ephemeral: true }), true);
		assert.strictEqual(isEphemeralFile("ephemeral-1.md", {}), true);
		assert.strictEqual(isEphemeralFile("x.md", {}), false);
	});

	it("removes flagged files with timestamp-style names and prefix-named files", async () => {
		await writeFile(
			join(base, "2024-x.md"),
			'---\nephemeral: true\nephemeral_expiresAt: "2020-01-01T00:00:00Z"\n---\nx',
		);
		await writeFile(join(base, "ephemeral-y.md"), "---\nephemeral_expiresAt: bogus\n---\nx");
		await writeFile(join(base, "keep.md"), "---\ntitle: k\n---\nx");
		const removed = await expireEphemeralMemories(base, "2026-06-05T00:00:00Z", base);
		assert.strictEqual(removed, 2);
		assert.deepStrictEqual(await readdir(base), ["keep.md"]);
	});

	it("throws RangeError for invalid nowStr", async () => {
		await assert.rejects(expireEphemeralMemories(base, "nope", base), RangeError);
	});

	it("resolveContextDir enforces containment for absolute paths", () => {
		assert.strictEqual(resolveContextDir("c", base), join(base, "c"));
		assert.throws(() => resolveContextDir("/etc", base));
		assert.throws(() => resolveContextDir("../x", base));
	});

	it("readEphemeralFile returns null for missing files", async () => {
		assert.strictEqual(await readEphemeralFile(base, "none.md", base), null);
	});
});
