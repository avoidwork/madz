import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert";

describe("vision_analyze", () => {
	let origFetch, origOpenAI;
	let ChatOpenAI;

	before(async () => {
		origFetch = globalThis.fetch;
		origOpenAI = process.env.OPENAI_API_KEY;
		const openaiMod = await import("@langchain/openai");
		ChatOpenAI = openaiMod.ChatOpenAI;
	});

	after(() => {
		globalThis.fetch = origFetch;
		process.env.OPENAI_API_KEY = origOpenAI;
	});

	it("requires url or dataUri", async () => {
		const { visionAnalyzeImpl } = await import("../../src/tools/vision.js");
		globalThis.fetch = origFetch;
		const result = await visionAnalyzeImpl({}, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("url or dataUri"));
	});

	it("returns error for no OPENAI_API_KEY", async () => {
		const { visionAnalyzeImpl } = await import("../../src/tools/vision.js");
		const saved = process.env.OPENAI_API_KEY;
		delete process.env.OPENAI_API_KEY;
		globalThis.fetch = origFetch;
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
			blob: () =>
				Promise.resolve({
					size: 5 * 1024 * 1024 + 1,
					type: "image/png",
				}),
		});
		const result = await visionAnalyzeImpl({ url: "https://example.com/large.png" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("exceeds") || parsed.error.includes("limit"));
		globalThis.fetch = origFetch;
		process.env.OPENAI_API_KEY = saved;
	});

	it("estimates size from base64 for dataUri and rejects oversized", async () => {
		const { visionAnalyzeImpl } = await import("../../src/tools/vision.js");
		const saved = process.env.OPENAI_API_KEY;
		process.env.OPENAI_API_KEY = "sk-test-key";
		const bigBase64 = "a".repeat(5 * 1024 * 1024 * 2);
		const result = await visionAnalyzeImpl({ dataUri: `data:image/png;base64,${bigBase64}` }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		globalThis.fetch = origFetch;
		process.env.OPENAI_API_KEY = saved;
	});

	it("returns error when image fetch fails with HTTP error", async () => {
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

	it("returns error when image fetch throws network error", async () => {
		const { visionAnalyzeImpl } = await import("../../src/tools/vision.js");
		const saved = process.env.OPENAI_API_KEY;
		process.env.OPENAI_API_KEY = "sk-test-key";
		globalThis.fetch = async () => {
			throw new Error("Network unreachable");
		};
		const result = await visionAnalyzeImpl({ url: "https://example.com/img.jpg" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Image fetch failed"));
		globalThis.fetch = origFetch;
		process.env.OPENAI_API_KEY = saved;
	});

	it("decodes dataUri correctly", async () => {
		const { decodeDataUri } = await import("../../src/tools/vision.js");
		const result = decodeDataUri("data:image/png;base64,aGVsbG8=");
		assert.strictEqual(result, "aGVsbG8=");
	});

	it("returns null for invalid dataUri prefix", async () => {
		const { decodeDataUri } = await import("../../src/tools/vision.js");
		const result = decodeDataUri("data:text/plain,hello");
		assert.strictEqual(result, null);
	});

	it("returns null for non-data URI string", async () => {
		const { decodeDataUri } = await import("../../src/tools/vision.js");
		const result = decodeDataUri("https://example.com/image.png");
		assert.strictEqual(result, null);
	});

	it("converts arrayBuffer to base64", async () => {
		const { arrayBufferToBase64 } = await import("../../src/tools/vision.js");
		const original = "hello world";
		const encoder = new TextEncoder();
		const buffer = encoder.encode(original).buffer;
		const result = arrayBufferToBase64(buffer);
		const decoded = btoa(String.fromCharCode(...new Uint8Array(buffer)));
		assert.strictEqual(result, decoded);
	});

	it("fetches image from URL and returns analysis result", async () => {
		const { visionAnalyzeImpl } = await import("../../src/tools/vision.js");
		const saved = process.env.OPENAI_API_KEY;
		process.env.OPENAI_API_KEY = "sk-test-key";
		const imageBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
		globalThis.fetch = async () => ({
			ok: true,
			blob: () =>
				Promise.resolve({
					size: imageBytes.length,
					type: "image/png",
					arrayBuffer: () => Promise.resolve(imageBytes.buffer),
				}),
		});

		// Stub ChatOpenAI.invoke via module mock on the already-imported class
		const fakeResponse = { content: "A cat sitting on a mat." };
		const originalInvoke = ChatOpenAI.prototype.invoke;
		mock.method(ChatOpenAI.prototype, "invoke", () => Promise.resolve(fakeResponse));

		const result = await visionAnalyzeImpl({ url: "https://example.com/img.png" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.source, "https://example.com/img.png");

		ChatOpenAI.prototype.invoke = originalInvoke;
		globalThis.fetch = origFetch;
		process.env.OPENAI_API_KEY = saved;
	});

	it("uses dataUri and returns analysis result with mocked LLM", async () => {
		const { visionAnalyzeImpl } = await import("../../src/tools/vision.js");
		const saved = process.env.OPENAI_API_KEY;
		process.env.OPENAI_API_KEY = "sk-test-key";
		const smallBase64 = btoa("fake image binary");

		const fakeResponse = {
			content: "A black cat on a windowsill.",
		};
		const originalInvoke = ChatOpenAI.prototype.invoke;
		mock.method(ChatOpenAI.prototype, "invoke", () => Promise.resolve(fakeResponse));

		const result = await visionAnalyzeImpl({ dataUri: `data:image/png;base64,${smallBase64}` }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.analysis, "A black cat on a windowsill.");
		assert.strictEqual(parsed.source, "dataUri");

		ChatOpenAI.prototype.invoke = originalInvoke;
		process.env.OPENAI_API_KEY = saved;
	});

	it("returns error when LLM analysis fails", async () => {
		const { visionAnalyzeImpl } = await import("../../src/tools/vision.js");
		const saved = process.env.OPENAI_API_KEY;
		process.env.OPENAI_API_KEY = "sk-test-key";
		const smallBase64 = btoa("fake image binary");

		mock.method(ChatOpenAI.prototype, "invoke", () =>
			Promise.reject(new Error("API rate limited")),
		);

		const result = await visionAnalyzeImpl({ dataUri: `data:image/png;base64,${smallBase64}` }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("LLM analysis failed"));

		process.env.OPENAI_API_KEY = saved;
	});
});
