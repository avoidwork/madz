import { describe, it, after, beforeEach } from "node:test";
import assert from "node:assert";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { parseFrontmatter } from "../../src/memory/reader.js";
import {
	writeEphemeralMemory,
	countEphemeralMemoryFiles,
	calculateExpirationTimestamp,
	samplingImpl,
	SamplingSchema,
} from "../../src/tools/sampling.js";

const TEST_DIR = "memory/__test_sampling__/";
const CWD = join(process.cwd(), TEST_DIR);

function setup() {
	rmSync(CWD, { recursive: true, force: true });
	mkdirSync(CWD, { recursive: true });
}

function teardown() {
	rmSync(CWD, { recursive: true, force: true });
}

function writeFakeEphemeral(filename, content, ephemeral, expiresAt, created) {
	const fmLines = [
		"---",
		`title: "Test"`,
		`timestamp: "${created || new Date().toISOString()}"`,
		ephemeral ? "ephemeral: true" : "",
		expiresAt ? `ephemeral_expiresAt: "${expiresAt}"` : "",
		"---",
		"",
		content || "",
		"",
	];
	writeFileSync(join(CWD, filename), fmLines.join("\n"));
}

describe("calculateExpirationTimestamp", () => {
	it("returns a valid future ISO timestamp", () => {
		const result = calculateExpirationTimestamp(7);
		const date = new Date(result);
		assert.ok(date > new Date(), "should be in the future");
		assert.strictEqual(date.getUTCHours(), 0);
		assert.strictEqual(date.getUTCMinutes(), 0);
		assert.strictEqual(date.getUTCSeconds(), 0);
	});

	it("adds ttlDays to current date approximately", () => {
		const result = calculateExpirationTimestamp(3);
		const now = new Date();
		const expected = new Date(now);
		expected.setDate(expected.getDate() + 3);
		// The result should be within one day of expected
		const diffMs = Math.abs(new Date(result).getTime() - expected.getTime());
		assert.ok(diffMs < 24 * 60 * 60 * 1000, "should be within one day");
	});

	it("has midnight-aligned output", () => {
		const result = calculateExpirationTimestamp(7);
		assert.ok(result.includes("T00:00:00"), "should end at midnight");
	});
});

describe("writeEphemeralMemory", () => {
	after(teardown);

	it("creates a file with correct frontmatter", async () => {
		const filepath = await writeEphemeralMemory(
			TEST_DIR,
			"happy moment",
			"2026-06-09T00:00:00.000Z",
		);
		const content = readFileSync(filepath, "utf-8");
		const { frontmatter } = parseFrontmatter(content);
		assert.strictEqual(frontmatter.ephemeral, true);
		assert.strictEqual(frontmatter.ephemeral_expiresAt, "2026-06-09T00:00:00.000Z");
		assert.ok(frontmatter.timestamp, "should include timestamp");
	});

	it("includes content as body", async () => {
		const filepath = await writeEphemeralMemory(
			TEST_DIR,
			"test content body",
			"2026-06-10T00:00:00.000Z",
		);
		const content = readFileSync(filepath, "utf-8");
		assert.ok(content.includes("test content body"));
	});

	it("creates the directory if not present", async () => {
		await writeEphemeralMemory(TEST_DIR + "sub/", "subdir test", "2026-06-10T00:00:00.000Z");
		teardown();
	});

	it("generates unique filenames per call", async () => {
		await writeEphemeralMemory(TEST_DIR, "a", "2026-06-09T00:00:00.000Z");
		await new Promise((resolve) => setTimeout(resolve, 100));
		await writeEphemeralMemory(TEST_DIR, "b", "2026-06-09T00:00:00.000Z");
		const files = await readdir(TEST_DIR);
		const mdFiles = files.filter((f) => f.endsWith(".md"));
		assert.strictEqual(mdFiles.length, 2, "should create two separate files");
	});
});

describe("countEphemeralMemoryFiles", () => {
	beforeEach(setup);
	after(teardown);

	it("returns 0 for empty directory", async () => {
		const count = await countEphemeralMemoryFiles(TEST_DIR);
		assert.strictEqual(count, 0);
	});

	it("returns 0 when directory is missing", async () => {
		teardown();
		const count = await countEphemeralMemoryFiles("nonexistent_dir/");
		assert.strictEqual(count, 0);
		setup();
	});

	it("counts non-expired ephemeral files", async () => {
		writeFakeEphemeral(
			"a.md",
			"content",
			true,
			"2027-01-01T00:00:00.000Z",
			"2026-06-01T00:00:00.000Z",
		);
		writeFakeEphemeral(
			"b.md",
			"content",
			true,
			"2027-01-01T00:00:00.000Z",
			"2026-06-02T00:00:00.000Z",
		);
		const count = await countEphemeralMemoryFiles(TEST_DIR, "2026-06-05T00:00:00.000Z");
		assert.strictEqual(count, 2);
	});

	it("excludes expired ephemeral files", async () => {
		writeFakeEphemeral(
			"x.md",
			"content",
			true,
			"2026-06-01T00:00:00.000Z",
			"2026-05-20T00:00:00.000Z",
		);
		writeFakeEphemeral(
			"y.md",
			"content",
			true,
			"2027-01-01T00:00:00.000Z",
			"2026-06-01T00:00:00.000Z",
		);
		// Only y.md should be counted (x.md expired before 06-05)
		const count = await countEphemeralMemoryFiles(TEST_DIR, "2026-06-05T12:00:00.000Z");
		assert.strictEqual(count, 1);
	});

	it("excludes non-ephemeral files", async () => {
		writeFakeEphemeral(
			"persist.md",
			"content",
			false,
			"2027-01-01T00:00:00.000Z",
			"2026-06-01T00:00:00.000Z",
		);
		writeFakeEphemeral(
			"active.md",
			"content",
			true,
			"2027-01-01T00:00:00.000Z",
			"2026-06-01T00:00:00.000Z",
		);
		const count = await countEphemeralMemoryFiles(TEST_DIR, "2026-06-05T00:00:00.000Z");
		assert.strictEqual(count, 1);
	});

	it("ignores non-.md files", async () => {
		writeFakeEphemeral(
			"test.md",
			"content",
			true,
			"2027-01-01T00:00:00.000Z",
			"2026-06-01T00:00:00.000Z",
		);
		writeFileSync(join(process.cwd(), TEST_DIR, "ignore.txt"), "not a memory");
		const count = await countEphemeralMemoryFiles(TEST_DIR);
		assert.strictEqual(count, 1);
	});
});

describe("samplingImpl", () => {
	beforeEach(setup);
	after(teardown);

	it("rejects empty content", async () => {
		const result = JSON.parse(await samplingImpl({ content: "" }, { contextDir: TEST_DIR }));
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.toLowerCase().includes("content"));
	});

	it("rejects missing content", async () => {
		const result = JSON.parse(await samplingImpl({}, { contextDir: TEST_DIR }));
		assert.strictEqual(result.ok, false);
	});

	it("writes an ephemeral file on success", async () => {
		const result = JSON.parse(
			await samplingImpl({ content: "joy" }, { contextDir: TEST_DIR, ttlDays: 7, maxEntries: 10 }),
		);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.message, "Ephemeral memory captured");
		assert.ok(result.expiresAt, "should include expiresAt");
		const files = await readdir(TEST_DIR);
		assert.ok(
			files.some((f) => f.endsWith(".md")),
			"should create a file",
		);
	});

	it("rejects within cooldown period", async () => {
		const result = JSON.parse(
			await samplingImpl(
				{ content: "test" },
				{
					contextDir: TEST_DIR,
					cooldownMs: 3600000,
					lastWritten: new Date().toISOString(),
					maxEntries: 10,
				},
			),
		);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Cooldown active"));
	});

	it("succeeds after cooldown expires", async () => {
		const past = new Date(Date.now() - 4200 * 1000).toISOString();
		const result = JSON.parse(
			await samplingImpl(
				{ content: "test" },
				{ contextDir: TEST_DIR, cooldownMs: 3600000, lastWritten: past, maxEntries: 10 },
			),
		);
		assert.strictEqual(result.ok, true);
	});

	it("rejects when at capacity", async () => {
		const max = 3;
		for (let i = 0; i < max; i++) {
			writeFakeEphemeral(
				`e_${i}.md`,
				"content",
				true,
				"2027-01-01T00:00:00.000Z",
				"2026-06-01T00:00:00.000Z",
			);
		}
		const result = JSON.parse(
			await samplingImpl({ content: "test" }, { contextDir: TEST_DIR, maxEntries: max }),
		);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Capacity limit"));
	});

	it("allows write when expired frees capacity", async () => {
		// Write an expired ephemeral file so capacity check counts it as 0 non-expired
		const expiredPath = join(process.cwd(), TEST_DIR, "e_expired.md");
		writeFileSync(
			expiredPath,
			'---\ntitle: "Expired"\ntimestamp: "2026-05-01T00:00:00.000Z"\nephemeral: true\nephemeral_expiresAt: "2026-05-01T00:00:00.000Z"\n---\n\nold content\n',
		);
		const result = JSON.parse(
			await samplingImpl({ content: "test" }, { contextDir: TEST_DIR, maxEntries: 1 }),
		);
		assert.strictEqual(result.ok, true);
	});
});

describe("SamplingSchema", () => {
	it("validates content is a string", () => {
		const result = SamplingSchema.safeParse({ content: "hello" });
		assert.strictEqual(result.success, true);
	});

	it("rejects missing content", () => {
		const result = SamplingSchema.safeParse({});
		assert.strictEqual(result.success, false);
	});

	it("rejects non-string content", () => {
		const result = SamplingSchema.safeParse({ content: 42 });
		assert.strictEqual(result.success, false);
	});
});
