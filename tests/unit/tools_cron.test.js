import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { cronjobImpl } from "../../src/tools/cron.js";
import { rm } from "node:fs/promises";

const SCHEDULES_DIR = "memory/schedules/";

describe("cronjob", () => {
	let origFetch;

	before(async () => {
		origFetch = globalThis.fetch;
		// Clean up any stale test jobs
		const cleanupNames = ["daily-report", "to-remove", "t1", "t2", "t3"];
		for (const name of cleanupNames) {
			const _r = await cronjobImpl({ action: "remove", name }, {});
			// ignore not-found errors
		}
	});

	after(async () => {
		globalThis.fetch = origFetch;
		// Cleanup test schedules
		const cleanupNames = ["daily-report", "to-remove", "t1", "t2", "t3"];
		for (const name of cleanupNames) {
			try {
				const _r = await cronjobImpl({ action: "remove", name }, {});
			} catch {
				// ignore
			}
		}
		try {
			await rm(SCHEDULES_DIR, { recursive: true, force: true });
		} catch {
			// ignore
		}
	});

	it("requires action", async () => {
		const result = await cronjobImpl({}, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Unknown action"));
	});

	it("rejects unknown action", async () => {
		const result = await cronjobImpl({ action: "delete" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Unknown action"));
	});

	it("create requires name, cron, skill", async () => {
		const result = await cronjobImpl({ action: "create", name: "test" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("requires"));
	});

	it("create validates cron expression", async () => {
		const result = await cronjobImpl(
			{ action: "create", name: "test", cron: "not-valid", skill: "test-skill" },
			{},
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Invalid cron"));
	});

	it("creates a job and persists it", async () => {
		const result = await cronjobImpl(
			{ action: "create", name: "daily-report", cron: "0 9 * * *", skill: "report-gen" },
			{},
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.ok(parsed.job);
		assert.strictEqual(parsed.job.name, "daily-report");
		assert.strictEqual(parsed.job.enabled, true);
		assert.ok(parsed.job.createdAt);
	});

	it("list returns created jobs", async () => {
		const result = await cronjobImpl({ action: "list" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.ok(parsed.jobs);
		assert.ok(Array.isArray(parsed.jobs));
		assert.ok(parsed.jobs.find((j) => j.name === "daily-report"));
	});

	it("updates an existing job", async () => {
		const result = await cronjobImpl(
			{ action: "update", name: "daily-report", skill: "weekly-report" },
			{},
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.job.skill, "weekly-report");
	});

	it("pauses a job", async () => {
		const result = await cronjobImpl({ action: "pause", name: "daily-report" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.job.enabled, false);
	});

	it("resumes a paused job", async () => {
		const result = await cronjobImpl({ action: "resume", name: "daily-report" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.job.enabled, true);
	});

	it("removes a job", async () => {
		const result = await cronjobImpl(
			{ action: "create", name: "to-remove", cron: "0 0 * * *", skill: "test" },
			{},
		);
		assert.strictEqual(JSON.parse(result).ok, true);
		const removeResult = await cronjobImpl({ action: "remove", name: "to-remove" }, {});
		const parsed = JSON.parse(removeResult);
		assert.strictEqual(parsed.ok, true);
	});

	it("rejects update for non-existent job", async () => {
		const result = await cronjobImpl({ action: "update", name: "nonexistent" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("not found"));
	});

	it("rejects remove for non-existent job", async () => {
		const result = await cronjobImpl({ action: "remove", name: "nonexistent" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
	});

	it("rejects pause for non-existent job", async () => {
		const result = await cronjobImpl({ action: "pause", name: "nonexistent" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
	});

	it("rejects resume for non-existent job", async () => {
		const result = await cronjobImpl({ action: "resume", name: "nonexistent" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
	});

	it("rejects run for non-existent job", async () => {
		const result = await cronjobImpl({ action: "run", name: "nonexistent" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
	});

	it("validates various cron expressions", async () => {
		assert.strictEqual(
			JSON.parse(
				await cronjobImpl({ action: "create", name: "t1", cron: "*/15 * * * *", skill: "s" }, {}),
			).ok,
			true,
		);
		// Step expressions
		assert.strictEqual(
			JSON.parse(
				await cronjobImpl({ action: "create", name: "t2", cron: "0-30/5 * * * *", skill: "s" }, {}),
			).ok,
			true,
		);
		// Comma-separated
		assert.strictEqual(
			JSON.parse(
				await cronjobImpl({ action: "create", name: "t3", cron: "0,30 * * * *", skill: "s" }, {}),
			).ok,
			true,
		);
	});
});
