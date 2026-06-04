import { describe, it, after, before } from "node:test";
import assert from "node:assert";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
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
		const src = await readFile(SRC_PATH, "utf-8");
		assert.ok(src.includes("isoTimestamp"), "saver.js should define isoTimestamp");
		assert.ok(
			!src.includes("const timestamp = new Date()"),
			"saver.js should not have mangled timestamp variable",
		);
	});

	describe("saveSession functional tests", () => {
		const TEST_DIR = "memory/__test_save_session/";

		before(() => {
			mkdirSync(join(process.cwd(), TEST_DIR), { recursive: true });
		});

		after(() => {
			rmSync(join(process.cwd(), TEST_DIR), { recursive: true, force: true });
		});

		it("should write session file with correct content", async () => {
			const { saveSession } = await import("../../src/session/saver.js");
			const conv = [
				{ role: "user", content: "hello", timestamp: "2026-01-01T00:00:00.000Z" },
				{ role: "assistant", content: "hi back!", timestamp: "2026-01-01T00:00:01.000Z" },
			];

			await saveSession(TEST_DIR, conv, "test-thread-id");

			const fullPath = join(process.cwd(), TEST_DIR, "test-thread-id.md");
			assert.ok(existsSync(fullPath), "session file should exist");

			const content = await readFile(fullPath, "utf-8");
			assert.ok(content.includes("threadId"), "should include threadId in frontmatter");
			assert.ok(content.includes("test-thread-id"), "should include thread-id value");
			assert.ok(
				content.includes(JSON.stringify(conv, null, 2)),
				"should include conversation body",
			);
		});

		it("should default filename to unsaved.md when threadId is empty", async () => {
			const { saveSession } = await import("../../src/session/saver.js");
			const conv = [{ role: "user", content: "test" }];

			await saveSession(TEST_DIR, conv, "");

			const fullPath = join(process.cwd(), TEST_DIR, "unsaved.md");
			assert.ok(existsSync(fullPath), "unsaved.md should exist");
		});
	});
});
