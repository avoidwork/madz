import { describe, it, before, after } from "node:test";
import assert from "node:assert";

describe("text_to_speech", () => {
	let origFetch, origOpenAI;

	before(() => {
		origFetch = globalThis.fetch;
		origOpenAI = process.env.OPENAI_API_KEY;
	});

	after(() => {
		globalThis.fetch = origFetch;
		process.env.OPENAI_API_KEY = origOpenAI;
	});

	it("requires text", async () => {
		const { textToSpeechImpl } = await import("../../src/tools/tts.js");
		const result = await textToSpeechImpl({}, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Text is required"));
	});

	it("rejects empty text", async () => {
		const { textToSpeechImpl } = await import("../../src/tools/tts.js");
		const result = await textToSpeechImpl({ text: "" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Text is required"));
	});

	it("rejects long text (>4096 chars)", async () => {
		const { textToSpeechImpl } = await import("../../src/tools/tts.js");
		const result = await textToSpeechImpl({ text: "a".repeat(4097) }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("4096 characters"));
	});

	it("requires OPENAI_API_KEY", async () => {
		const { textToSpeechImpl } = await import("../../src/tools/tts.js");
		const saved = process.env.OPENAI_API_KEY;
		delete process.env.OPENAI_API_KEY;
		const result = await textToSpeechImpl({ text: "Hello" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("OPENAI_API_KEY"));
		process.env.OPENAI_API_KEY = saved;
	});

	it("rejects invalid model", async () => {
		const { textToSpeechImpl } = await import("../../src/tools/tts.js");
		const saved = process.env.OPENAI_API_KEY;
		process.env.OPENAI_API_KEY = "sk-test";
		const result = await textToSpeechImpl({ text: "Hello", model: "tts-99" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Invalid model"));
		process.env.OPENAI_API_KEY = saved;
	});

	it("rejects invalid voice", async () => {
		const { textToSpeechImpl } = await import("../../src/tools/tts.js");
		const saved = process.env.OPENAI_API_KEY;
		process.env.OPENAI_API_KEY = "sk-test";
		const result = await textToSpeechImpl({ text: "Hello", voice: "invalid-voice" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Invalid voice"));
		process.env.OPENAI_API_KEY = saved;
	});

	it("calls OpenAI TTS API with correct parameters", async () => {
		const { textToSpeechImpl } = await import("../../src/tools/tts.js");
		globalThis.fetch = async (url, opts) => {
			assert.ok(url.includes("openai.com"));
			assert.ok(url.includes("/audio/speech"));
			const body = JSON.parse(opts.body);
			assert.strictEqual(body.model, "tts-1");
			assert.strictEqual(body.voice, "nova");
			assert.strictEqual(body.speed, 1);
			assert.strictEqual(body.input, "test speech text");
			return {
				ok: true,
				arrayBuffer: async () => new Uint8Array([0x00]).buffer,
			};
		};
		const saved = process.env.OPENAI_API_KEY;
		process.env.OPENAI_API_KEY = "sk-test";
		const result = await textToSpeechImpl(
			{ text: "test speech text", voice: "nova", model: "tts-1" },
			{},
		);
		const parsed = JSON.parse(result);
		assert.ok(parsed.ok);
		assert.ok(parsed.path.startsWith("MEDIA:"));
		process.env.OPENAI_API_KEY = saved;
		globalThis.fetch = origFetch;
	});

	it("returns error on API failure", async () => {
		const { textToSpeechImpl } = await import("../../src/tools/tts.js");
		const saved = process.env.OPENAI_API_KEY;
		process.env.OPENAI_API_KEY = "sk-test";
		globalThis.fetch = async () => ({
			ok: false,
			status: 429,
			text: async () => "Rate limit exceeded",
		});
		const result = await textToSpeechImpl({ text: "Hello" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("429") || parsed.error.includes("Rate"));
		process.env.OPENAI_API_KEY = saved;
		globalThis.fetch = origFetch;
	});

	it("handles fetch network error", async () => {
		const { textToSpeechImpl } = await import("../../src/tools/tts.js");
		const saved = process.env.OPENAI_API_KEY;
		process.env.OPENAI_API_KEY = "sk-test";
		globalThis.fetch = async () => {
			throw new Error("ENOTFOUND");
		};
		const result = await textToSpeechImpl({ text: "Hello" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("TTS request failed"));
		globalThis.fetch = origFetch;
		process.env.OPENAI_API_KEY = saved;
	});
});
