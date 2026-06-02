import { describe, it, after, beforeEach } from "node:test";
import assert from "node:assert";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expireEphemeralMemories } from "../../src/memory/expireEphemeral.js";

const TEST_DIR = "memory/__test_expire_ephemeral__/";
const CWD = join(process.cwd(), TEST_DIR);

function setup() {
	mkdirSync(CWD, { recursive: true });
}

function teardown() {
	rmSync(CWD, { recursive: true, force: true });
}

function writeEphemeralFile(filename, expiresAt, created) {
	writeFileSync(
		join(CWD, filename),
		`---\ntitle: "Test"\ntimestamp: "${created || new Date().toISOString()}"\nephemeral: true\nephemeral_expiresAt: "${expiresAt}"\n---\n\ntest content\n`,
	);
}

function writeNonEphemeralFile(filename) {
	writeFileSync(
		join(CWD, filename),
		`---\ntitle: "Test"\ntimestamp: "${new Date().toISOString()}"\n---\n\npersistent content\n`,
	);
}

describe("expireEphemeralMemories", () => {
	beforeEach(setup);
	after(teardown);

	it("deletes expired ephemeral files", async () => {
		writeEphemeralFile("expired.md", "2026-05-01T00:00:00.000Z", "2026-05-01T00:00:00.000Z");
		const removed = await expireEphemeralMemories(TEST_DIR, "2026-06-05T00:00:00.000Z");
		assert.strictEqual(removed, 1);
	});

	it("preserves non-expired ephemeral files", async () => {
		writeEphemeralFile("active.md", "2027-01-01T00:00:00.000Z", "2026-06-01T00:00:00.000Z");
		const removed = await expireEphemeralMemories(TEST_DIR, "2026-06-05T00:00:00.000Z");
		assert.strictEqual(removed, 0);
	});

	it("preserves non-ephemeral files", async () => {
		writeEphemeralFile("expired.md", "2026-05-01T00:00:00.000Z", "2026-05-01T00:00:00.000Z");
		writeNonEphemeralFile("persistent.md");
		const removed = await expireEphemeralMemories(TEST_DIR, "2026-06-05T00:00:00.000Z");
		assert.strictEqual(removed, 1);
	});

	it("handles missing directory gracefully", async () => {
		teardown();
		const removed = await expireEphemeralMemories(TEST_DIR, "2026-06-05T00:00:00.000Z");
		assert.strictEqual(removed, 0);
		setup();
	});

	it("ignores non-.md files", async () => {
		writeEphemeralFile("test.md", "2026-05-01T00:00:00.000Z", "2026-05-01T00:00:00.000Z");
		writeFileSync(join(CWD, "notes.txt"), "some text");
		const removed = await expireEphemeralMemories(TEST_DIR, "2026-06-05T00:00:00.000Z");
		assert.strictEqual(removed, 1);
	});

	it("returns 0 when no files exist", async () => {
		const removed = await expireEphemeralMemories(TEST_DIR, "2026-06-05T00:00:00.000Z");
		assert.strictEqual(removed, 0);
	});

	it("removes multiple expired files", async () => {
		writeEphemeralFile("e1.md", "2026-05-01T00:00:00.000Z", "2026-05-01T00:00:00.000Z");
		writeEphemeralFile("e2.md", "2026-05-02T00:00:00.000Z", "2026-05-02T00:00:00.000Z");
		writeEphemeralFile("e3.md", "2027-01-01T00:00:00.000Z", "2026-06-01T00:00:00.000Z");
		const removed = await expireEphemeralMemories(TEST_DIR, "2026-06-05T00:00:00.000Z");
		assert.strictEqual(removed, 2);
	});

	it("does not remove if expiresAt equals now", async () => {
		writeEphemeralFile("border.md", "2026-06-05T00:00:00.000Z", "2026-06-01T00:00:00.000Z");
		const removed = await expireEphemeralMemories(TEST_DIR, "2026-06-05T00:00:00.000Z");
		assert.strictEqual(removed, 0);
	});

	it("removes if expiresAt is before now", async () => {
		writeEphemeralFile("expired_border.md", "2026-06-04T23:59:59.000Z", "2026-06-01T00:00:00.000Z");
		const removed = await expireEphemeralMemories(TEST_DIR, "2026-06-05T00:00:00.000Z");
		assert.strictEqual(removed, 1);
	});
});
