import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { textToSpeechImpl } from "../../src/tools/tts.js";

describe("textToSpeech", () => {
	let origFetch;
	let savedOpenAiKey;

	before(() => {
		origFetch = globalThis.fetch;
		savedOpenAiKey = process.env.OPENAI_API_KEY;
		delete process.env.OPENAI_API_KEY;
	});

	after(() => {
		globalThis.fetch = origFetch;
		if (savedOpenAiKey !== undefined) {
			process.env.OPENAI_API_KEY = savedOpenAiKey;
		} else {
			delete process.env.OPENAI_API_KEY;
		}
	});

	it("requires text", async () => {
		const result = await textToSpeechImpl({});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Text is required"));
	});

	it("rejects empty text", async () => {
		const result = await textToSpeechImpl({ text: "" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Text is required"));
	});

	it("rejects long text (>4096 chars)", async () => {
		const result = await textToSpeechImpl({ text: "a".repeat(4097) });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("4096 characters"));
	});

	it("requires openaiApiKey in options", async () => {
		const result = await textToSpeechImpl({ text: "Hello" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("OPENAI_API_KEY"));
	});

	it("rejects invalid model", async () => {
		const result = await textToSpeechImpl(
			{ text: "Hello", model: "tts-99" },
			{ openaiApiKey: "sk-test" },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Invalid model"));
	});

	it("rejects invalid voice", async () => {
		const result = await textToSpeechImpl(
			{ text: "Hello", voice: "invalid-voice" },
			{ openaiApiKey: "sk-test" },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Invalid voice"));
	});

	it("calls OpenAI TTS API with correct parameters", async () => {
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
		const result = await textToSpeechImpl(
			{ text: "test speech text", voice: "nova", model: "tts-1" },
			{ openaiApiKey: "sk-test" },
		);
		const parsed = JSON.parse(result);
		assert.ok(parsed.ok);
		assert.ok(parsed.path.startsWith("MEDIA:"));
		globalThis.fetch = origFetch;
	});

	it("returns error on API failure", async () => {
		globalThis.fetch = async () => ({
			ok: false,
			status: 429,
			text: async () => "Rate limit exceeded",
		});
		const result = await textToSpeechImpl({ text: "Hello" }, { openaiApiKey: "sk-test" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("429") || parsed.error.includes("Rate"));
		globalThis.fetch = origFetch;
	});

	it("handles fetch network error", async () => {
		globalThis.fetch = async () => {
			throw new Error("ENOTFOUND");
		};
		const result = await textToSpeechImpl({ text: "Hello" }, { openaiApiKey: "sk-test" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("TTS request failed"));
		globalThis.fetch = origFetch;
	});
});
