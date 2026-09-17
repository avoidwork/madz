import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readImage, readImageImpl } from "../../../../src/tools/image/readImage.js";

// Real, valid image bytes for every format in the MIME_TYPES map.
// Each fixture is a genuine decodable image (verified via sharp for raster
// formats; BMP and ICO verified by header inspection since sharp cannot read
// those). The extension-to-MIME mapping is asserted honestly against these.
const FIXTURES = {
	// PNG — 2x2 solid color, decodes via sharp
	png: "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEklEQVR4nGM4kWJ0IsWIAUIBACiuBXmimEdRAAAAAElFTkSuQmCC",
	// JPEG — 2x2 solid color, decodes via sharp
	jpeg: "/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAACAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAABv/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJAB58//2Q==",
	// JPEG (same bytes, .jpg extension) — decodes via sharp
	jpg: "/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAACAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAABv/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJAB58//2Q==",
	// WebP — 2x2 solid color, decodes via sharp
	webp: "UklGRjoAAABXRUJQVlA4IC4AAADwAQCdASoCAAIAAUAmJaACdLoB+AAEyAAA/q4X/zYEDND6YP/SbPE2eJs+OYAA",
	// GIF — 2x2 solid color, decodes via sharp
	gif: "R0lGODlhAgACAIAAAExpcchkMiH/C05FVFNDQVBFMi4wAwEAAAAh+QQFAAAAACwAAAAAAgACAAACAoxTADs=",
	// AVIF — 2x2 solid color, decodes via sharp (reported as heif)
	avif: "AAAAHGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZgAAAOptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAAA5waXRtAAAAAAABAAAAImlsb2MAAAAAREAAAQABAAAAAAEOAAEAAAAAAAAAFwAAACNpaW5mAAAAAAABAAAAFWluZmUCAAAAAAEAAGF2MDEAAAAAamlwcnAAAABLaXBjbwAAABNjb2xybmNseAACAAIABoAAAAAMYXYxQ4EgAgAAAAAUaXNwZQAAAAAAAAACAAAAAgAAABBwaXhpAAAAAAMICAgAAAAXaXBtYQAAAAAAAAABAAEEgYIDhAAAAB9tZGF0EgAKBDgANgkyDRgAAABAAJ41iLkBHrA=",
	// TIFF — 2x2 solid color, decodes via sharp
	tiff: "SUkqAIAAAAD/2P/AABEIAAIAAgMBIgACEQEDEQH/xABMAAEBAAAAAAAAAAAAAAAAAAAAAxABAAAAAAAAAAAAAAAAAAAAAAEBAQAAAAAAAAAAAAAAAAAABgcRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJAA6kP/2QARAAABAwABAAAAAgAAAAEBAwABAAAAAgAAAAIBAwADAAAAYgEAAAMBAwABAAAABwAAAAYBAwABAAAABgAAABEBBAABAAAACAAAABIBAwABAAAAAQAAABUBAwABAAAAAwAAABYBAwABAAAAAAEAABcBBAABAAAAdwAAABoBBQABAAAAUgEAABsBBQABAAAAWgEAABwBAwABAAAAAQAAACgBAwABAAAAAgAAAFMBAwADAAAAaAEAAFsBBwCOAAAAngEAABQCBQAGAAAAbgEAAAAAAAAzM8sAAAAIADMzywAAAAgACAAIAAgAAQABAAEAAAAAAAEAAAD/AAAAAQAAAIAAAAABAAAA/wAAAAEAAACAAAAAAQAAAP8AAAABAAAA/9j/2wBDAAYGBgYHBgcICAcKCwoLCg8ODAwODxYQERAREBYiFRkVFRkVIh4kHhweJB42KiYmKjY+NDI0PkxERExfWl98fKf/2wBDAQYGBgYHBgcICAcKCwoLCg8ODAwODxYQERAREBYiFRkVFRkVIh4kHhweJB42KiYmKjY+NDI0PkxERExfWl98fKf/2Q==",
	// TIFF (same bytes, .tif extension) — decodes via sharp
	tif: "SUkqAIAAAAD/2P/AABEIAAIAAgMBIgACEQEDEQH/xABMAAEBAAAAAAAAAAAAAAAAAAAAAxABAAAAAAAAAAAAAAAAAAAAAAEBAQAAAAAAAAAAAAAAAAAABgcRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJAA6kP/2QARAAABAwABAAAAAgAAAAEBAwABAAAAAgAAAAIBAwADAAAAYgEAAAMBAwABAAAABwAAAAYBAwABAAAABgAAABEBBAABAAAACAAAABIBAwABAAAAAQAAABUBAwABAAAAAwAAABYBAwABAAAAAAEAABcBBAABAAAAdwAAABoBBQABAAAAUgEAABsBBQABAAAAWgEAABwBAwABAAAAAQAAACgBAwABAAAAAgAAAFMBAwADAAAAaAEAAFsBBwCOAAAAngEAABQCBQAGAAAAbgEAAAAAAAAzM8sAAAAIADMzywAAAAgACAAIAAgAAQABAAEAAAAAAAEAAAD/AAAAAQAAAIAAAAABAAAA/wAAAAEAAACAAAAAAQAAAP8AAAABAAAA/9j/2wBDAAYGBgYHBgcICAcKCwoLCg8ODAwODxYQERAREBYiFRkVFRkVIh4kHhweJB42KiYmKjY+NDI0PkxERExfWl98fKf/2wBDAQYGBgYHBgcICAcKCwoLCg8ODAwODxYQERAREBYiFRkVFRkVIh4kHhweJB42KiYmKjY+NDI0PkxERExfWl98fKf/2Q==",
	// SVG — 2x2 solid color, decodes via sharp
	svg: "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyIiBoZWlnaHQ9IjIiPjxyZWN0IHdpZHRoPSIyIiBoZWlnaHQ9IjIiIGZpbGw9InJnYigyMDAsMTAwLDUwKSIvPjwvc3ZnPg==",
	// BMP — 2x2 24-bit, structurally valid (sharp cannot read BMP)
	bmp: "Qk1GAAAAAAAAADYAAAAoAAAAAgAAAAIAAAABABgAAAAAABAAAAATCwAAEwsAAAAAAAAAAAAAMmTIMmTIAAAyZMgyZMgAAA==",
	// ICO — 1x1 32-bit, structurally valid (sharp cannot read ICO)
	ico: "AAABAAEAAQEAAAEAIAAwAAAAFgAAACgAAAABAAAAAgAAAAEAIAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAyZMj/AAAAAA==",
};

// Extension → expected MIME type, mirroring the MIME_TYPES map in readImage.js.
const EXTENSION_CASES = [
	["png", "image/png"],
	["jpg", "image/jpeg"],
	["jpeg", "image/jpeg"],
	["gif", "image/gif"],
	["webp", "image/webp"],
	["bmp", "image/bmp"],
	["svg", "image/svg+xml"],
	["avif", "image/avif"],
	["tiff", "image/tiff"],
	["tif", "image/tiff"],
	["ico", "image/x-icon"],
];

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
		writeFileSync(filePath, Buffer.from(FIXTURES.png, "base64"));

		const result = await readImageImpl({ path: filePath }, { allowedPaths: [testDir] });
		const parsed = JSON.parse(result);

		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.mimeType, "image/png");
		assert.strictEqual(parsed.data, FIXTURES.png);
	});

	it("returns correct MIME type and base64 for every supported image format", async () => {
		for (const [ext, expectedMime] of EXTENSION_CASES) {
			const fixture = FIXTURES[ext];
			assert.ok(fixture, `missing fixture for extension .${ext}`);
			const filePath = join(testDir, `test.${ext}`);
			writeFileSync(filePath, Buffer.from(fixture, "base64"));

			const result = await readImageImpl({ path: filePath }, { allowedPaths: [testDir] });
			const parsed = JSON.parse(result);

			assert.strictEqual(parsed.ok, true, `.${ext}: expected ok`);
			assert.strictEqual(parsed.mimeType, expectedMime, `.${ext}: MIME mismatch`);
			assert.strictEqual(parsed.data, fixture, `.${ext}: base64 round-trip mismatch`);
		}
	});

	it("detects JPEG MIME type from extension", async () => {
		const filePath = join(testDir, "test.jpg");
		writeFileSync(filePath, Buffer.from(FIXTURES.jpeg, "base64"));

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
