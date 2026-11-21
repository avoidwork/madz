import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { image, imageImpl, imageSchema } from "../../../../src/tools/image/index.js";

let testDir;

before(() => {
	testDir = join(tmpdir(), `image-test-${Date.now()}`);
	mkdirSync(testDir, { recursive: true });
});

after(() => {
	rmSync(testDir, { recursive: true, force: true });
});

const b64 = (r) => r[0].image_url.url.split(",")[1];

describe("image tool", () => {
	it("has correct tool metadata", () => {
		assert.strictEqual(image.name, "image");
		assert.ok(typeof image.description === "string");
		assert.ok(image.description.length > 0);
	});

	it("dispatches on the action enum", async () => {
		const result = await imageImpl({ action: "bogus" });
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /Unknown image action/);
	});
});

describe("image tool - schema validation", () => {
	it("requires path for read", () => {
		const result = imageSchema.safeParse({ action: "read" });
		assert.strictEqual(result.success, false);
		assert.match(result.error.issues[0].message, /path is required/);
	});

	it("requires path for metadata", () => {
		const result = imageSchema.safeParse({ action: "metadata" });
		assert.strictEqual(result.success, false);
		assert.match(result.error.issues[0].message, /path is required/);
	});

	it("requires path, output, and a dimension for resize", () => {
		const result = imageSchema.safeParse({ action: "resize" });
		assert.strictEqual(result.success, false);
		const messages = result.error.issues.map((i) => i.message);
		assert.ok(messages.some((m) => /path is required/.test(m)));
		assert.ok(messages.some((m) => /output is required/.test(m)));
		assert.ok(messages.some((m) => /width, height, or maxDimension/.test(m)));
	});

	it("requires path, output, and format for convert", () => {
		const result = imageSchema.safeParse({ action: "convert" });
		assert.strictEqual(result.success, false);
		const messages = result.error.issues.map((i) => i.message);
		assert.ok(messages.some((m) => /path is required/.test(m)));
		assert.ok(messages.some((m) => /output is required/.test(m)));
		assert.ok(messages.some((m) => /format is required/.test(m)));
	});

	it("rejects an invalid convert format", () => {
		const result = imageSchema.safeParse({
			action: "convert",
			path: "a.png",
			output: "b.png",
			format: "bogus",
		});
		assert.strictEqual(result.success, false);
	});

	it("rejects jpg as a redundant alias of jpeg", () => {
		const result = imageSchema.safeParse({
			action: "convert",
			path: "a.png",
			output: "b.jpg",
			format: "jpg",
		});
		assert.strictEqual(result.success, false);
	});

	it("accepts a valid convert with a known format", () => {
		const result = imageSchema.safeParse({
			action: "convert",
			path: "a.png",
			output: "b.webp",
			format: "webp",
		});
		assert.strictEqual(result.success, true);
	});

	it("rejects width on a read action", () => {
		const result = imageSchema.safeParse({ action: "read", path: "a.png", width: 100 });
		assert.strictEqual(result.success, false);
		assert.match(result.error.issues[0].message, /only valid for the 'resize' action/);
	});

	it("rejects format on a resize action", () => {
		const result = imageSchema.safeParse({
			action: "resize",
			path: "a.png",
			output: "b.png",
			width: 100,
			format: "webp",
		});
		assert.strictEqual(result.success, false);
		assert.match(result.error.issues[0].message, /only valid for the 'convert' action/);
	});

	it("rejects maxDimension combined with width", () => {
		const result = imageSchema.safeParse({
			action: "resize",
			path: "a.png",
			output: "b.png",
			width: 100,
			maxDimension: 200,
		});
		assert.strictEqual(result.success, false);
		assert.match(result.error.issues[0].message, /maxDimension cannot be combined/);
	});

	it("accepts a valid resize with maxDimension only", () => {
		const result = imageSchema.safeParse({
			action: "resize",
			path: "a.png",
			output: "b.png",
			maxDimension: 200,
		});
		assert.strictEqual(result.success, true);
	});

	it("rejects a width above the max dimension cap", () => {
		const result = imageSchema.safeParse({
			action: "resize",
			path: "a.png",
			output: "b.png",
			width: 20000,
		});
		assert.strictEqual(result.success, false);
	});

	it("rejects a generate action (moved to the generateImage tool)", () => {
		const result = imageSchema.safeParse({ action: "generate" });
		assert.strictEqual(result.success, false);
	});
});

describe("image tool - read action", () => {
	it("reads a file below the size limit", async () => {
		const filePath = join(testDir, "below.png");
		writeFileSync(filePath, Buffer.alloc(50 * 1024, 1));

		const result = await imageImpl({ action: "read", path: filePath }, { allowedPaths: [testDir] });

		assert.ok(Array.isArray(result));
		assert.strictEqual(result[0].type, "image_url");
		assert.ok(result[0].image_url.url.startsWith("data:image/png;base64,"));
	});

	it("downscales images exceeding maxDimension preserving aspect ratio", async () => {
		const filePath = join(testDir, "wide.png");
		const src = await sharp({
			create: { width: 6000, height: 3000, channels: 3, background: "#000" },
		})
			.png()
			.toBuffer();
		writeFileSync(filePath, src);

		const result = await imageImpl({ action: "read", path: filePath }, { allowedPaths: [testDir] });
		const meta = await sharp(Buffer.from(b64(result), "base64")).metadata();
		assert.strictEqual(meta.width, 3000);
		assert.strictEqual(meta.height, 1500);
	});

	it("leaves images within maxDimension untouched", async () => {
		const filePath = join(testDir, "small.png");
		const src = await sharp({
			create: { width: 100, height: 50, channels: 3, background: "#000" },
		})
			.png()
			.toBuffer();
		writeFileSync(filePath, src);

		const result = await imageImpl({ action: "read", path: filePath }, { allowedPaths: [testDir] });

		assert.strictEqual(b64(result), src.toString("base64"));
	});

	it("defaults an unknown extension to image/png", async () => {
		const filePath = join(testDir, "mystery.xyz");
		writeFileSync(filePath, Buffer.alloc(100, 1));

		const result = await imageImpl({ action: "read", path: filePath }, { allowedPaths: [testDir] });

		assert.ok(result[0].image_url.url.startsWith("data:image/png;base64,"));
	});

	it("returns an error for a missing file", async () => {
		const result = await imageImpl(
			{ action: "read", path: join(testDir, "missing.png") },
			{ allowedPaths: [testDir] },
		);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /File not found/);
	});

	it("returns an error for a path outside the sandbox allowlist", async () => {
		const result = await imageImpl(
			{ action: "read", path: join(testDir, "below.png") },
			{ allowedPaths: ["/some/other/dir"] },
		);
		assert.strictEqual(result.ok, false);
	});
});

describe("image tool - resize action", () => {
	it("resizes to a target width preserving aspect ratio", async () => {
		const filePath = join(testDir, "resize-src.png");
		const outPath = join(testDir, "resize-out.png");
		const src = await sharp({
			create: { width: 400, height: 200, channels: 3, background: "#000" },
		})
			.png()
			.toBuffer();
		writeFileSync(filePath, src);

		const result = await imageImpl(
			{ action: "resize", path: filePath, output: outPath, width: 200 },
			{ allowedPaths: [testDir] },
		);
		assert.strictEqual(result.ok, true);
		const meta = await sharp(outPath).metadata();
		assert.strictEqual(meta.width, 200);
		assert.strictEqual(meta.height, 100);
	});

	it("resizes to a max dimension preserving aspect ratio", async () => {
		const filePath = join(testDir, "resize-max-src.png");
		const outPath = join(testDir, "resize-max-out.png");
		const src = await sharp({
			create: { width: 400, height: 200, channels: 3, background: "#000" },
		})
			.png()
			.toBuffer();
		writeFileSync(filePath, src);

		const result = await imageImpl(
			{ action: "resize", path: filePath, output: outPath, maxDimension: 100 },
			{ allowedPaths: [testDir] },
		);
		assert.strictEqual(result.ok, true);
		const meta = await sharp(outPath).metadata();
		assert.strictEqual(meta.width, 100);
		assert.strictEqual(meta.height, 50);
	});

	it("returns an error when no width/height/maxDimension is given", async () => {
		const filePath = join(testDir, "resize-src.png");
		const result = await imageImpl(
			{ action: "resize", path: filePath, output: join(testDir, "x.png") },
			{ allowedPaths: [testDir] },
		);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /width, height, or maxDimension/);
	});
});

describe("image tool - metadata action", () => {
	it("returns image metadata", async () => {
		const filePath = join(testDir, "meta.png");
		const src = await sharp({
			create: { width: 300, height: 150, channels: 3, background: "#000" },
		})
			.png()
			.toBuffer();
		writeFileSync(filePath, src);

		const result = await imageImpl(
			{ action: "metadata", path: filePath },
			{ allowedPaths: [testDir] },
		);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.metadata.width, 300);
		assert.strictEqual(result.metadata.height, 150);
		assert.strictEqual(result.metadata.format, "png");
	});

	it("returns an error for an undecodable image", async () => {
		const filePath = join(testDir, "bad.png");
		writeFileSync(filePath, Buffer.from("not an image"));

		const result = await imageImpl(
			{ action: "metadata", path: filePath },
			{ allowedPaths: [testDir] },
		);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /Failed to read image metadata/);
	});
});

describe("image tool - convert action", () => {
	it("converts an image to webp", async () => {
		const filePath = join(testDir, "convert-src.png");
		const outPath = join(testDir, "convert-out.webp");
		const src = await sharp({
			create: { width: 100, height: 100, channels: 3, background: "#000" },
		})
			.png()
			.toBuffer();
		writeFileSync(filePath, src);

		const result = await imageImpl(
			{ action: "convert", path: filePath, output: outPath, format: "webp" },
			{ allowedPaths: [testDir] },
		);
		assert.strictEqual(result.ok, true);
		const meta = await sharp(outPath).metadata();
		assert.strictEqual(meta.format, "webp");
	});

	it("returns an error for an unsupported format", async () => {
		const filePath = join(testDir, "convert-src.png");
		const result = await imageImpl(
			{ action: "convert", path: filePath, output: join(testDir, "x.bmp"), format: "bogus" },
			{ allowedPaths: [testDir] },
		);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /Unsupported format/);
	});
});
