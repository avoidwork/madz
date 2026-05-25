import { describe, it, before, after } from "node:test";
import assert from "node:assert";

describe("vision_analyze", () => {
	let origFetch, origOpenAI;

	before(() => {
		origFetch = globalThis.fetch;
		origOpenAI = process.env.OPENAI_API_KEY;
	});

	after(() => {
		globalThis.fetch = origFetch;
		globalThis.ChatOpenAI = undefined; // reset any stubs
		process.env.OPENAI_API_KEY = origOpenAI;
	});

	it("requires url or dataUri", async () => {
		const { visionAnalyzeImpl } = await import("../../src/tools/vision.js");
		globalThis.fetch = origFetch; // ensure clean state
		const result = await visionAnalyzeImpl({}, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("url or dataUri"));
	});

	it("returns error for no OPENAI_API_KEY", async () => {
		const { visionAnalyzeImpl } = await import("../../src/tools/vision.js");
		const saved = process.env.OPENAI_API_KEY;
		delete process.env.OPENAI_API_KEY;
		globalThis.fetch = origFetch; // ensure clean state
		const result = await visionAnalyzeImpl({ url: "https://example.com/img.jpg" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("OPENAI_API_KEY"));
		process.env.OPENAI_API_KEY = saved;
	});

	it("rejects invalid dataUri", async () => {
		const { visionAnalyzeImpl } = await import("../../src/tools/vision.js");
		const saved = process.env.OPENAI_API_KEY;
		process.env.OPENAI_API_KEY = "sk-test";
		globalThis.fetch = origFetch;
		const result = await visionAnalyzeImpl({ dataUri: "not-a-valid-uri" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Invalid data URI"));
		process.env.OPENAI_API_KEY = saved;
	});

	it("rejects oversized image from URL", async () => {
		const { visionAnalyzeImpl } = await import("../../src/tools/vision.js");
		const saved = process.env.OPENAI_API_KEY;
		process.env.OPENAI_API_KEY = "sk-test-key";
		globalThis.fetch = async () => ({
			ok: true,
			blob: async () => ({
				size: 5 * 1024 * 1024 + 1, // 5MB, over 4MB limit
				type: "image/png",
				arrayBuffer: async () => new ArrayBuffer(5 * 1024 * 1024),
			}),
		});
		const result = await visionAnalyzeImpl({ url: "https://example.com/large.png" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("exceeds") || parsed.error.includes("limit"));
		globalThis.fetch = origFetch;
		process.env.OPENAI_API_KEY = saved;
	});

	it("estimates size from base64 for dataUri", async () => {
		const { visionAnalyzeImpl } = await import("../../src/tools/vision.js");
		const saved = process.env.OPENAI_API_KEY;
		process.env.OPENAI_API_KEY = "sk-test-key";
		const bigBase64 = "a".repeat(5 * 1024 * 1024 * 2); // ~huge
		globalThis.fetch = async () => ({
			ok: true,
			json: async () => ({
				content: [{ type: "text", text: "done." }],
			}),
		});
		const result = await visionAnalyzeImpl({ dataUri: `data:image/png;base64,${bigBase64}` }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		globalThis.fetch = origFetch;
		process.env.OPENAI_API_KEY = saved;
	});

	it("returns error when image fetch fails", async () => {
		const { visionAnalyzeImpl } = await import("../../src/tools/vision.js");
		const saved = process.env.OPENAI_API_KEY;
		process.env.OPENAI_API_KEY = "sk-test-key";
		globalThis.fetch = async () => ({
			ok: false,
			status: 404,
			statusText: "Not Found",
		});
		const result = await visionAnalyzeImpl({ url: "https://example.com/missing.png" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("HTTP 404"));
		globalThis.fetch = origFetch;
		process.env.OPENAI_API_KEY = saved;
	});
});
