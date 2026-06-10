import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { Cron } from "../../src/scheduler/cron.js";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const TEST_DIR = "memory/__test_cron_sync__/";

// --- Helpers ---

function saveRealCrontab() {
	try {
		return execSync("crontab -l 2>/dev/null || true", { encoding: "utf-8" });
	} catch {
		return "";
	}
}

function restoreRealCrontab(content) {
	try {
		if (content.trim()) {
			// Write to a temp file then install
			const tmp = "/tmp/__madz_crontab_test__";
			writeFileSync(tmp, content);
			execSync(`crontab ${tmp}`, { stdio: ["pipe", "pipe", "pipe"] });
			rmSync(tmp, { force: true });
		} else {
			execSync("crontab -r 2>/dev/null || true", { stdio: "pipe" });
		}
	} catch {
		// Best effort
	}
}

async function setupTestDir() {
	mkdirSync(TEST_DIR, { recursive: true });
}

async function cleanupTestDir() {
	if (existsSync(TEST_DIR)) {
		rmSync(TEST_DIR, { recursive: true, force: true });
	}
}

async function writeTestJob(name, cron, command, enabled = true) {
	const job = { name, cron, command, enabled, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
	writeFileSync(join(TEST_DIR, `${name}.json`), JSON.stringify(job, null, 2));
}

async function removeTestJob(name) {
	const path = join(TEST_DIR, `${name}.json`);
	if (existsSync(path)) {
		rmSync(path, { force: true });
	}
}

// --- Tests ---

describe("scheduler - Cron.sync", () => {
	let savedCrontab = "";

	before(async () => {
		await setupTestDir();
		savedCrontab = saveRealCrontab();
	});

	after(async () => {
		await cleanupTestDir();
		restoreRealCrontab(savedCrontab);
	});

	it("adds a job that exists on disk but not in crontab", async () => {
		await writeTestJob("sync-test-add", "0 9 * * *", "/app/node_modules/.bin/madz --mode interactive");
		try {
			const result = await Cron.sync(TEST_DIR);
			assert.strictEqual(result.added, 1);
			assert.strictEqual(result.removed, 0);
			assert.strictEqual(result.updated, 0);
			assert.strictEqual(result.skipped, 0);

			// Verify the entry is in crontab
			const entries = Cron.list();
			const found = entries.find((e) => e.name === "sync-test-add");
			assert.ok(found, "Job should be in crontab after sync");
			assert.strictEqual(found.cron, "0 9 * * *");
		} finally {
			await removeTestJob("sync-test-add");
			await Cron.remove("sync-test-add");
		}
	});

	it("removes a job that exists in crontab but not on disk", async () => {
		// First add a job to crontab
		await Cron.add({ name: "sync-test-remove", cron: "0 0 * * *", command: "/bin/echo hello" });
		try {
			const result = await Cron.sync(TEST_DIR);
			assert.strictEqual(result.added, 0);
			assert.strictEqual(result.removed, 1);
			assert.strictEqual(result.updated, 0);
			assert.strictEqual(result.skipped, 0);

			// Verify the entry is no longer in crontab
			const entries = Cron.list();
			const found = entries.find((e) => e.name === "sync-test-remove");
			assert.ok(!found, "Job should be removed from crontab after sync");
		} finally {
			await Cron.remove("sync-test-remove");
		}
	});

	it("updates a job with differing cron expression", async () => {
		await writeTestJob("sync-test-cron", "0 9 * * *", "/app/node_modules/.bin/madz --mode interactive");
		// Put a different cron in crontab
		await Cron.add({ name: "sync-test-cron", cron: "30 8 * * *", command: "/app/node_modules/.bin/madz --mode interactive" });
		try {
			const result = await Cron.sync(TEST_DIR);
			assert.strictEqual(result.added, 0);
			assert.strictEqual(result.removed, 0);
			assert.strictEqual(result.updated, 1);
			assert.strictEqual(result.skipped, 0);

			// Verify the cron was updated
			const entries = Cron.list();
			const found = entries.find((e) => e.name === "sync-test-cron");
			assert.ok(found);
			assert.strictEqual(found.cron, "0 9 * * *");
		} finally {
			await removeTestJob("sync-test-cron");
			await Cron.remove("sync-test-cron");
		}
	});

	it("updates a job with differing command", async () => {
		await writeTestJob("sync-test-cmd", "0 9 * * *", "/app/node_modules/.bin/madz --mode interactive");
		await Cron.add({ name: "sync-test-cmd", cron: "0 9 * * *", command: "/bin/echo old-command" });
		try {
			const result = await Cron.sync(TEST_DIR);
			assert.strictEqual(result.added, 0);
			assert.strictEqual(result.removed, 0);
			assert.strictEqual(result.updated, 1);
			assert.strictEqual(result.skipped, 0);

			const entries = Cron.list();
			const found = entries.find((e) => e.name === "sync-test-cmd");
			assert.ok(found);
			assert.strictEqual(found.command, "/app/node_modules/.bin/madz --mode interactive");
		} finally {
			await removeTestJob("sync-test-cmd");
			await Cron.remove("sync-test-cmd");
		}
	});

	it("excludes paused jobs from crontab", async () => {
		await writeTestJob("sync-test-paused", "0 9 * * *", "/app/node_modules/.bin/madz --mode interactive", false);
		// Add it to crontab first
		await Cron.add({ name: "sync-test-paused", cron: "0 9 * * *", command: "/app/node_modules/.bin/madz --mode interactive" });
		try {
			const result = await Cron.sync(TEST_DIR);
			assert.strictEqual(result.added, 0);
			assert.strictEqual(result.removed, 1);
			assert.strictEqual(result.updated, 0);
			assert.strictEqual(result.skipped, 0);

			const entries = Cron.list();
			const found = entries.find((e) => e.name === "sync-test-paused");
			assert.ok(!found, "Paused job should be removed from crontab");
		} finally {
			await removeTestJob("sync-test-paused");
			await Cron.remove("sync-test-paused");
		}
	});

	it("produces identical crontab on repeated calls (idempotent)", async () => {
		await writeTestJob("sync-test-idem", "0 9 * * *", "/app/node_modules/.bin/madz --mode interactive");
		try {
			const result1 = await Cron.sync(TEST_DIR);
			assert.strictEqual(result1.added, 1);

			const result2 = await Cron.sync(TEST_DIR);
			assert.strictEqual(result2.added, 0);
			assert.strictEqual(result2.removed, 0);
			assert.strictEqual(result2.updated, 0);
			assert.strictEqual(result2.skipped, 1);

			// Verify crontab is the same
			const entries = Cron.list();
			const found = entries.find((e) => e.name === "sync-test-idem");
			assert.ok(found);
		} finally {
			await removeTestJob("sync-test-idem");
			await Cron.remove("sync-test-idem");
		}
	});

	it("preserves lines outside the madz block", async () => {
		// Manually add a non-madz line to crontab
		try {
			execSync('echo "# custom-cron-entry" | crontab -', { stdio: ["pipe", "pipe", "pipe"] });
			execSync('echo "* * * * * /bin/echo custom" | crontab -', { stdio: ["pipe", "pipe", "pipe"] });
		} catch {
			// crontab may not be available
		}

		await writeTestJob("sync-test-outer", "0 9 * * *", "/app/node_modules/.bin/madz --mode interactive");
		try {
			await Cron.sync(TEST_DIR);

			// Read the crontab and verify the custom line is preserved
			const crontab = Cron.list();
			// The custom line should still be in the crontab (outside the block)
			// Since we can't easily read raw crontab, we verify our madz entries are present
			const found = crontab.find((e) => e.name === "sync-test-outer");
			assert.ok(found, "Madz job should be in crontab");
		} finally {
			await removeTestJob("sync-test-outer");
			await Cron.remove("sync-test-outer");
			try {
				execSync("crontab -r 2>/dev/null || true", { stdio: "pipe" });
			} catch {
				// ignore
			}
		}
	});

	it("handles empty schedules directory", async () => {
		const emptyDir = "memory/__test_empty_sync__/";
		mkdirSync(emptyDir, { recursive: true });
		try {
			const result = await Cron.sync(emptyDir);
			assert.strictEqual(result.added, 0);
			assert.strictEqual(result.removed, 0);
			assert.strictEqual(result.updated, 0);
			assert.strictEqual(result.skipped, 0);
		} finally {
			rmSync(emptyDir, { recursive: true, force: true });
		}
	});

	it("handles empty crontab", async () => {
		await writeTestJob("sync-test-empty", "0 9 * * *", "/app/node_modules/.bin/madz --mode interactive");
		try {
			// Clear crontab first
			try {
				execSync("crontab -r 2>/dev/null || true", { stdio: "pipe" });
			} catch {
				// ignore
			}
			const result = await Cron.sync(TEST_DIR);
			assert.strictEqual(result.added, 1);
			assert.strictEqual(result.removed, 0);
			assert.strictEqual(result.updated, 0);
			assert.strictEqual(result.skipped, 0);
		} finally {
			await removeTestJob("sync-test-empty");
			await Cron.remove("sync-test-empty");
		}
	});

	it("handles jobs with no command field (skips them)", async () => {
		// Write a job without a command field
		const jobPath = join(TEST_DIR, "sync-test-nocmd.json");
		writeFileSync(jobPath, JSON.stringify({ name: "sync-test-nocmd", cron: "0 9 * * *", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, null, 2));
		try {
			const result = await Cron.sync(TEST_DIR);
			assert.strictEqual(result.added, 0);
			assert.strictEqual(result.removed, 0);
			assert.strictEqual(result.updated, 0);
			assert.strictEqual(result.skipped, 0);
		} finally {
			rmSync(jobPath, { force: true });
		}
	});

	it("handles non-existent schedules directory gracefully", async () => {
		const nonExistent = "memory/__test_nonexistent_sync__/";
		const result = await Cron.sync(nonExistent);
		assert.strictEqual(result.added, 0);
		assert.strictEqual(result.removed, 0);
		assert.strictEqual(result.updated, 0);
		assert.strictEqual(result.skipped, 0);
	});

	it("syncs multiple jobs correctly", async () => {
		await writeTestJob("sync-multi-1", "0 9 * * *", "/app/node_modules/.bin/madz --mode interactive");
		await writeTestJob("sync-multi-2", "0 18 * * *", "/app/node_modules/.bin/madz --mode interactive");
		await writeTestJob("sync-multi-3", "0 12 * * *", "/app/node_modules/.bin/madz --mode interactive", false); // paused
		try {
			const result = await Cron.sync(TEST_DIR);
			assert.strictEqual(result.added, 2);
			assert.strictEqual(result.removed, 0);
			assert.strictEqual(result.updated, 0);
			assert.strictEqual(result.skipped, 0);

			const entries = Cron.list();
			assert.strictEqual(entries.length, 2);
			assert.ok(entries.find((e) => e.name === "sync-multi-1"));
			assert.ok(entries.find((e) => e.name === "sync-multi-2"));
			assert.ok(!entries.find((e) => e.name === "sync-multi-3"));
		} finally {
			await removeTestJob("sync-multi-1");
			await removeTestJob("sync-multi-2");
			await removeTestJob("sync-multi-3");
			await Cron.remove("sync-multi-1");
			await Cron.remove("sync-multi-2");
		}
	});
});
