import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { readImageImpl } from "../../../../src/tools/image/readImage.js";
import { resizeScreenshot } from "../../../../src/tools/web/index.js";

let testDir;

before(() => {
	testDir = join(tmpdir(), `imageflow-test-${Date.now()}`);
	mkdirSync(testDir, { recursive: true });
});

after(() => {
	rmSync(testDir, { recursive: true, force: true });
});

describe("image screenshot -> read flow", () => {
	it("a ~100KB screenshot passes through resizeScreenshot and readImage", async () => {
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

		const resized = await resizeScreenshot(raw.toString("base64"), 1024);
		const resizedBuf = Buffer.from(resized, "base64");

		// Save and read it back
		const filePath = join(testDir, "screenshot.png");
		writeFileSync(filePath, resizedBuf);

		const result = await readImageImpl({ path: filePath }, { allowedPaths: [testDir] });

		assert.ok(Array.isArray(result), `readImage should succeed: ${result}`);
		assert.strictEqual(result[0].type, "image_url");
	});
});
