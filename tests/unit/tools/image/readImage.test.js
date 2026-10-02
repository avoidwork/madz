import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readImage, readImageImpl } from "../../../../src/tools/image/readImage.js";

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

	it("reads a file below the size limit", async () => {
		const filePath = join(testDir, "below.png");
		writeFileSync(filePath, Buffer.alloc(50 * 1024, 1));

		const result = await readImageImpl({ path: filePath }, { allowedPaths: [testDir] });
		const parsed = JSON.parse(result);

		assert.strictEqual(parsed.ok, true);
	});

	it("rejects a file above the size limit", async () => {
		const filePath = join(testDir, "above.png");
		// 200KB raw — over the encoded limit (100000 * 1.33 = 133000)
		writeFileSync(filePath, Buffer.alloc(200 * 1024, 1));

		const result = await readImageImpl({ path: filePath }, { allowedPaths: [testDir] });
		const parsed = JSON.parse(result);

		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("exceeds max read size"));
	});
});
