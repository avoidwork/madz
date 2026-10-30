import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { transcribeAudio, transcribeAudioImpl } from "../../../src/tools/audio/index.js";

let testDir;

before(() => {
	testDir = join(tmpdir(), `audio-test-${Date.now()}`);
	mkdirSync(testDir, { recursive: true });
});

after(() => {
	rmSync(testDir, { recursive: true, force: true });
});

describe("transcribeAudio tool", () => {
	it("has correct tool metadata", () => {
		assert.strictEqual(transcribeAudio.name, "transcribeAudio");
		assert.ok(typeof transcribeAudio.description === "string");
		assert.ok(transcribeAudio.description.length > 0);
	});

	it("rejects missing path", async () => {
		const result = await transcribeAudioImpl({}, { allowedPaths: [testDir] });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Path is required"));
	});

	it("rejects empty path", async () => {
		const result = await transcribeAudioImpl({ path: "" }, { allowedPaths: [testDir] });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Path is required"));
	});

	it("rejects path outside sandbox allowlist", async () => {
		const result = await transcribeAudioImpl({ path: "/etc/passwd" }, { allowedPaths: [testDir] });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Access denied"));
	});

	it("rejects non-existent file", async () => {
		const result = await transcribeAudioImpl(
			{ path: join(testDir, "missing.mp3") },
			{ allowedPaths: [testDir] },
		);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("File not found"));
	});

	it("rejects unsupported extension", async () => {
		const filePath = join(testDir, "notes.txt");
		writeFileSync(filePath, "hello world");
		const result = await transcribeAudioImpl({ path: filePath }, { allowedPaths: [testDir] });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Unsupported audio format"));
	});

	it("rejects file exceeding size limit", async () => {
		const filePath = join(testDir, "large.mp3");
		writeFileSync(filePath, Buffer.alloc(30 * 1024 * 1024, 1));
		const result = await transcribeAudioImpl({ path: filePath }, { allowedPaths: [testDir] });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("exceeds max read size"));
	});

	it("calls OpenAI API when apiKey is provided", async () => {
		const filePath = join(testDir, "sample.mp3");
		writeFileSync(filePath, Buffer.alloc(1024, 1));

		const origFetch = globalThis.fetch;
		globalThis.fetch = async (url, opts) => {
			assert.ok(url.includes("openai.com"));
			assert.ok(url.includes("/audio/transcriptions"));
			assert.strictEqual(opts.method, "POST");
			assert.ok(opts.headers.Authorization.includes("Bearer sk-test"));
			return {
				ok: true,
				json: async () => ({ text: "Hello world" }),
			};
		};

		try {
			const result = await transcribeAudioImpl(
				{ path: filePath },
				{ allowedPaths: [testDir], openaiApiKey: "sk-test" },
			);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.text, "Hello world");
			assert.strictEqual(result.model, "whisper-1");
			assert.strictEqual(result.backend, "api");
		} finally {
			globalThis.fetch = origFetch;
		}
	});

	it("returns error when OpenAI API fails", async () => {
		const filePath = join(testDir, "sample.mp3");
		writeFileSync(filePath, Buffer.alloc(1024, 1));

		const origFetch = globalThis.fetch;
		globalThis.fetch = async () => ({
			ok: false,
			status: 500,
			text: async () => "server error",
		});

		try {
			const result = await transcribeAudioImpl(
				{ path: filePath },
				{ allowedPaths: [testDir], openaiApiKey: "sk-test" },
			);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("OpenAI transcription error"));
		} finally {
			globalThis.fetch = origFetch;
		}
	});
});

describe("transcribeAudio local backend", () => {
	it("transcribes via local Whisper when no apiKey is provided", async () => {
		const filePath = join(testDir, "sample.wav");
		writeFileSync(filePath, Buffer.alloc(1024, 1));

		const loadPipeline = async () => async (_path, _opts) => ({ text: "local transcription" });

		const result = await transcribeAudioImpl(
			{ path: filePath },
			{ allowedPaths: [testDir], openaiApiKey: "", loadPipeline },
		);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.backend, "local");
		assert.strictEqual(result.text, "local transcription");
	});

	it("passes language and prompt to the local pipeline", async () => {
		const filePath = join(testDir, "sample.wav");
		writeFileSync(filePath, Buffer.alloc(1024, 1));

		let capturedOpts;
		const loadPipeline = async () => async (_path, opts) => {
			capturedOpts = opts;
			return { text: "transcribed" };
		};

		const result = await transcribeAudioImpl(
			{ path: filePath, language: "en", prompt: "context" },
			{ allowedPaths: [testDir], openaiApiKey: "", loadPipeline },
		);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(capturedOpts.language, "en");
		assert.strictEqual(capturedOpts.prompt, "context");
	});

	it("returns error when local Whisper fails", async () => {
		const filePath = join(testDir, "sample.wav");
		writeFileSync(filePath, Buffer.alloc(1024, 1));

		const loadPipeline = async () => {
			throw new Error("model download failed");
		};

		const result = await transcribeAudioImpl(
			{ path: filePath },
			{ allowedPaths: [testDir], openaiApiKey: "", loadPipeline },
		);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Local transcription failed"));
	});
});
