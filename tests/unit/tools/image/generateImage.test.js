import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { generateImage, generateImageImpl } from "../../../../src/tools/image/index.js";

describe("generateImage tool", () => {
	it("has correct tool metadata", () => {
		assert.strictEqual(generateImage.name, "generateImage");
		assert.ok(typeof generateImage.description === "string");
		assert.ok(generateImage.description.length > 0);
	});

	it("returns a native structured error object when prompt is missing", async () => {
		const result = await generateImageImpl({});
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /Prompt is required/);
		assert.ok(!result.imageUrl);
	});

	it("returns a native structured error object when prompt is empty", async () => {
		const result = await generateImageImpl({ prompt: "   " });
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /Prompt is required/);
	});

	it("returns a native structured error object when prompt is too long", async () => {
		const result = await generateImageImpl({ prompt: "a".repeat(1001) });
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /1000 characters or fewer/);
	});

	it("returns a native structured error object when API key is missing", async () => {
		const result = await generateImageImpl({ prompt: "a cat" });
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /FAL_API_KEY is required/);
	});

	it("returns a native structured success object with imageUrl", async () => {
		const fetchMock = mock.method(globalThis, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => ({ images: [{ url: "https://example.com/image.png" }] }),
		}));
		try {
			const result = await generateImageImpl({ prompt: "a cat" }, { falApiKey: "test-key" });
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.imageUrl, "https://example.com/image.png");
			assert.ok(!result.error);
		} finally {
			fetchMock.mock.restore();
		}
	});

	it("returns a native structured error object when FAL returns an error", async () => {
		const fetchMock = mock.method(globalThis, "fetch", async () => ({
			ok: false,
			status: 500,
			text: async () => "Internal Server Error",
		}));
		try {
			const result = await generateImageImpl({ prompt: "a cat" }, { falApiKey: "test-key" });
			assert.strictEqual(result.ok, false);
			assert.match(result.error, /FAL.ai error/);
			assert.match(result.error, /500/);
		} finally {
			fetchMock.mock.restore();
		}
	});

	it("returns a native structured error object when FAL response is missing image URL", async () => {
		const fetchMock = mock.method(globalThis, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => ({ images: [] }),
		}));
		try {
			const result = await generateImageImpl({ prompt: "a cat" }, { falApiKey: "test-key" });
			assert.strictEqual(result.ok, false);
			assert.match(result.error, /missing image URL/);
		} finally {
			fetchMock.mock.restore();
		}
	});
});
