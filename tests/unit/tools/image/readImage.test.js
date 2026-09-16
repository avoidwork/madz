import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readImage, readImageImpl } from "../../../../src/tools/image/readImage.js";

// A minimal valid PNG (1x1 transparent pixel) as a Buffer.
const PNG_BYTES = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
	"base64",
);

let testDir;

before(() => {
	testDir = join(tmpdir(), `readimage-test-${Date.now()}`);
	mkdirSync(testDir, { recursive: true });
});

after(() => {
	rmSync(testDir, { recursive: true, force: true });
});

describe("readImage tool", () => {
	it("has correct tool metadata", () => {
		assert.strictEqual(readImage.name, "readImage");
		assert.ok(typeof readImage.description === "string");
		assert.ok(readImage.description.length > 0);
	});

	it("returns base64 and MIME type for a valid PNG", async () => {
		const filePath = join(testDir, "test.png");
		writeFileSync(filePath, PNG_BYTES);

		const result = await readImageImpl({ path: filePath }, { allowedPaths: [testDir] });
		const parsed = JSON.parse(result);

		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.mimeType, "image/png");
		assert.strictEqual(parsed.data, PNG_BYTES.toString("base64"));
	});

	it("detects JPEG MIME type from extension", async () => {
		const filePath = join(testDir, "test.jpg");
		writeFileSync(filePath, PNG_BYTES);

		const result = await readImageImpl({ path: filePath }, { allowedPaths: [testDir] });
		const parsed = JSON.parse(result);

		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.mimeType, "image/jpeg");
	});

	it("rejects a file over the size limit", async () => {
		const filePath = join(testDir, "large.png");
		// ~200KB of data
		writeFileSync(filePath, Buffer.alloc(200 * 1024, 1));

		const result = await readImageImpl(
			{ path: filePath, maxSize: "100kb" },
			{ allowedPaths: [testDir] },
		);
		const parsed = JSON.parse(result);

		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("exceeds max read size"));
	});

	it("rejects a path outside the sandbox allowlist", async () => {
		const result = await readImageImpl({ path: "/etc/passwd" }, { allowedPaths: [testDir] });
		const parsed = JSON.parse(result);

		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Access denied"));
	});

	it("rejects a missing file", async () => {
		const result = await readImageImpl(
			{ path: join(testDir, "does-not-exist.png") },
			{ allowedPaths: [testDir] },
		);
		const parsed = JSON.parse(result);

		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("File not found"));
	});

	it("rejects empty or missing path via schema validation", async () => {
		await assert.rejects(async () => readImage.invoke({}), /path/i);
		await assert.rejects(async () => readImage.invoke({ path: "" }), /path/i);
	});

	it("uses config.image.maxSize when no override is provided", async () => {
		const filePath = join(testDir, "config-size.png");
		writeFileSync(filePath, Buffer.alloc(50 * 1024, 1));

		// No maxSize override — should use config default (100kb) which allows this file
		const result = await readImageImpl({ path: filePath }, { allowedPaths: [testDir] });
		const parsed = JSON.parse(result);

		assert.strictEqual(parsed.ok, true);
	});
});
