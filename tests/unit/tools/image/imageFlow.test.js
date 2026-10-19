import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { readImageImpl } from "../../../../src/tools/image/readImage.js";
import { resizeScreenshot } from "../../../../src/tools/web/index.js";
import { loadConfig, _resetConfigCache } from "../../../../src/config/loader.js";

let testDir;

before(() => {
	testDir = join(tmpdir(), `imageflow-test-${Date.now()}`);
	mkdirSync(testDir, { recursive: true });
});

after(() => {
	rmSync(testDir, { recursive: true, force: true });
	// Reset config cache so other tests aren't affected by the env var we set
	delete process.env.IMAGE_MAX_SIZE;
	_resetConfigCache();
});

describe("image screenshot -> read flow", () => {
	it("env var IMAGE_MAX_SIZE resolves into config.image.maxSize", () => {
		process.env.IMAGE_MAX_SIZE = "200000";
		_resetConfigCache();
		const config = loadConfig();
		assert.strictEqual(config.image.maxSize, 200000);
	});

	it("a ~100KB screenshot passes through resizeScreenshot and readImage when IMAGE_MAX_SIZE=200000", async () => {
		process.env.IMAGE_MAX_SIZE = "200000";
		_resetConfigCache();

		// Build a realistic ~100KB screenshot
		const w = 1280;
		const h = 2500;
		const parts = [`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">`];
		parts.push('<rect width="100%" height="100%" fill="#f0f0f0"/>');
		for (let i = 0; i < 120; i++) {
			const x = (i * 41) % w;
			const y = (i * 61) % h;
			const c = "#" + ((i * 2654435761) % 0xffffff).toString(16).padStart(6, "0");
			parts.push(`<rect x="${x}" y="${y}" width="90" height="50" fill="${c}"/>`);
		}
		parts.push("</svg>");
		const raw = await sharp(Buffer.from(parts.join("")))
			.png()
			.toBuffer();

		const config = loadConfig();
		const sizeLimit = config.image?.maxSize || 100000;
		const resized = await resizeScreenshot(raw.toString("base64"), 1024, sizeLimit);
		const resizedBuf = Buffer.from(resized, "base64");

		// The resized screenshot must be under the size limit
		assert.ok(
			resizedBuf.length <= sizeLimit,
			`resized (${resizedBuf.length}) should be <= sizeLimit (${sizeLimit})`,
		);

		// Save and read it back
		const filePath = join(testDir, "screenshot.png");
		writeFileSync(filePath, resizedBuf);

		const result = await readImageImpl({ path: filePath }, { allowedPaths: [testDir] });

		assert.ok(Array.isArray(result), `readImage should succeed: ${result}`);
		assert.strictEqual(result[0].type, "image_url");
	});

	it("readImage rejects a file above the configured limit", async () => {
		process.env.IMAGE_MAX_SIZE = "200000";
		_resetConfigCache();

		// 300KB raw — over the encoded limit (200000 * 1.33 = 266000)
		const filePath = join(testDir, "too-big.png");
		writeFileSync(filePath, Buffer.alloc(300 * 1024, 1));

		const result = await readImageImpl({ path: filePath }, { allowedPaths: [testDir] });
		const parsed = JSON.parse(result);

		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("exceeds max read size"));
	});
});
