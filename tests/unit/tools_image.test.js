import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { imageGenerateImpl } from "../../src/tools/image.js";

describe("image_generate", () => {
	let origFetch;

	before(() => {
		origFetch = globalThis.fetch;
	});

	after(() => {
		globalThis.fetch = origFetch;
	});

	it("requires prompt", async () => {
		const result = await imageGenerateImpl({}, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Prompt is required"));
	});

	it("rejects empty prompt", async () => {
		const result = await imageGenerateImpl({ prompt: "" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Prompt is required"));
	});

	it("rejects long prompts (>1000 chars)", async () => {
		const result = await imageGenerateImpl({ prompt: "a".repeat(1001) }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("1000 characters"));
	});

	it("requires FAL_API_KEY", async () => {
		const result = await imageGenerateImpl({ prompt: "a cat" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("FAL_API_KEY"));
	});

	it("accepts falApiKey parameter as override", async () => {
		globalThis.fetch = async () => ({
			ok: true,
			json: async () => ({
				images: [{ url: "https://fal.ai/generated.png" }],
			}),
		});
		const result = await imageGenerateImpl(
			{ prompt: "a sunset", falApiKey: "sk-fake-fal-key" },
			{},
		);
		const parsed = JSON.parse(result);
		assert.ok(parsed.ok);
		assert.strictEqual(parsed.imageUrl, "https://fal.ai/generated.png");
	});

	it("calls FAL.ai with correct parameters", async () => {
		globalThis.fetch = async (url, opts) => {
			assert.ok(url.includes("fal.run"));
			assert.ok(url.includes("flux"));
			assert.ok(opts.headers.Authorization.startsWith("Key "));
			const body = JSON.parse(opts.body);
			assert.strictEqual(body.sync_mode, true);
			assert.strictEqual(body.image_size, "square_1_1");
			return {
				ok: true,
				json: async () => ({ images: [{ url: "https://fal.ai/result.png" }] }),
			};
		};
		const result = await imageGenerateImpl({ prompt: "a mountain", falApiKey: "sk-test" }, {});
		const parsed = JSON.parse(result);
		assert.ok(parsed.ok);
	});

	it("returns error on FAL.ai failure", async () => {
		globalThis.fetch = async () => ({
			ok: false,
			status: 429,
			text: async () => "Rate limit exceeded",
		});
		const result = await imageGenerateImpl({ prompt: "test", falApiKey: "sk-fake-key" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("FAL.ai"));
	});

	it("returns error when FAL.ai response has no images", async () => {
		globalThis.fetch = async () => ({
			ok: true,
			json: async () => ({ messages: [] }), // no images key
		});
		const result = await imageGenerateImpl({ prompt: "test", falApiKey: "sk-fake-key" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("missing image"));
	});
});
