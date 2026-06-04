import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

describe("session - saveSession error propagation", () => {
	it("propagates writeFile errors unhandled", async () => {
		const { saveSession } = await import("../../src/session/saver.js");

		const testDir = "memory/__test_save_error/";
		const fullDir = join(process.cwd(), testDir);

		try {
			// Create the directory so saveSession's writeFile path works
			mkdirSync(fullDir, { recursive: true });

			// Save a session file first to verify the dir exists
			await saveSession(testDir, [{ role: "user", content: "hi" }], "existing");

			// Remove the directory — now writeFile will fail
			rmSync(fullDir, { recursive: true, force: true });
			assert.ok(!existsSync(fullDir), "directory should be deleted");

			// This should throw because writeFile cannot write to a missing directory
			await assert.rejects(
				saveSession(testDir, [{ role: "user", content: "test" }], "err-thread"),
				/ENOENT|EACCES|EIO/,
				"saveSession should propagate unhandled writeFile errors",
			);
		} finally {
			// Cleanup
			if (existsSync(fullDir)) {
				rmSync(fullDir, { recursive: true, force: true });
			}
		}
	});
});
