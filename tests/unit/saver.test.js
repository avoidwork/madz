import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

describe("session - saveSession", () => {
	const SRC_PATH = require.resolve("../../src/session/saver.js");

	it("should produce valid ISO8601 strings from toISOString", () => {
		const iso = new Date().toISOString();
		assert.strictEqual(typeof iso, "string");
		assert.ok(iso.endsWith("Z"), "ISO8601 should end with Z");
		assert.ok(
			iso.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
			"should match ISO8601 format",
		);
	});

	it("should produce filesystem-safe timestamp for filenames", () => {
		const safe = new Date().toISOString().replace(/[:.]/g, "-");
		assert.strictEqual(safe.indexOf(":"), -1, "should have no colons");
		assert.strictEqual(safe.indexOf("."), -1, "should have no dots");
		assert.ok(!/[:.]/.test(safe), "should be filesystem-safe");
	});

	it("saver.js source should use isoTimestamp not mangled timestamp", async () => {
		const src = readFileSync(SRC_PATH, "utf-8");
		assert.ok(src.includes("isoTimestamp"), "saver.js should define isoTimestamp");
		assert.ok(
			!src.includes("const timestamp = new Date()"),
			"saver.js should not have mangled timestamp variable",
		);
	});
});
