import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { readImage, readImageImpl } from "../../../../src/tools/image/readImage.js";

let testDir;

before(() => {
	testDir = join(tmpdir(), `readimage-test-${Date.now()}`);
	mkdirSync(testDir, { recursive: true });
});

after(() => {
	rmSync(testDir, { recursive: true, force: true });
});

const b64 = (r) => r[0].image_url.url.split(",")[1];
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

		assert.ok(Array.isArray(result));
		assert.strictEqual(result[0].type, "image_url");
		assert.ok(result[0].image_url.url.startsWith("data:image/png;base64,"));
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

	it("downscales images exceeding maxDimension preserving aspect ratio", async () => {
		const filePath = join(testDir, "wide.png");
		const src = await sharp({
			create: { width: 6000, height: 3000, channels: 3, background: "#000" },
		})
			.png()
			.toBuffer();
		writeFileSync(filePath, src);

		const result = await readImageImpl({ path: filePath }, { allowedPaths: [testDir] });
		const meta = await sharp(Buffer.from(b64(result), "base64")).metadata();
		assert.strictEqual(meta.width, 5000);
		assert.strictEqual(meta.height, 2500);
	});

	it("leaves images within maxDimension untouched", async () => {
		const filePath = join(testDir, "small.png");
		const src = await sharp({
			create: { width: 100, height: 50, channels: 3, background: "#000" },
		})
			.png()
			.toBuffer();
		writeFileSync(filePath, src);

		const result = await readImageImpl({ path: filePath }, { allowedPaths: [testDir] });

		assert.strictEqual(b64(result), src.toString("base64"));
	});

	it("defaults an unknown extension to image/png", async () => {
		const filePath = join(testDir, "mystery.xyz");
		writeFileSync(filePath, Buffer.alloc(100, 1));

		const result = await readImageImpl({ path: filePath }, { allowedPaths: [testDir] });

		assert.ok(result[0].image_url.url.startsWith("data:image/png;base64,"));
	});
});
