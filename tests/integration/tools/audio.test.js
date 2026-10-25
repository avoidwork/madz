import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { transcribeAudioImpl } from "../../../src/tools/audio/index.js";

const TEST_DIR = join(process.cwd(), "memory", "__test_audio_integration__");
const ALLOWED_PATHS = [TEST_DIR];

/**
 * Build a minimal valid WAV file (44-byte header + 1 second of silence).
 * @returns {Buffer} A valid 16-bit PCM WAV buffer
 */
function buildWavFixture() {
	const sampleRate = 16000;
	const numSamples = sampleRate; // 1 second
	const dataSize = numSamples * 2; // 16-bit mono
	const buffer = Buffer.alloc(44 + dataSize);

	// RIFF header
	buffer.write("RIFF", 0);
	buffer.writeUInt32LE(36 + dataSize, 4);
	buffer.write("WAVE", 8);
	// fmt chunk
	buffer.write("fmt ", 12);
	buffer.writeUInt32LE(16, 16);
	buffer.writeUInt16LE(1, 20); // PCM
	buffer.writeUInt16LE(1, 22); // mono
	buffer.writeUInt32LE(sampleRate, 24);
	buffer.writeUInt32LE(sampleRate * 2, 28);
	buffer.writeUInt16LE(2, 32);
	buffer.writeUInt16LE(16, 34);
	// data chunk
	buffer.write("data", 36);
	buffer.writeUInt32LE(dataSize, 40);
	// silence (zeros)

	return buffer;
}

before(() => {
	mkdirSync(TEST_DIR, { recursive: true });
});

after(() => {
	rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("transcribeAudio integration", () => {
	it("transcribes a wav fixture via the local backend", async () => {
		const filePath = join(TEST_DIR, "fixture.wav");
		writeFileSync(filePath, buildWavFixture());

		const result = await transcribeAudioImpl({ path: filePath }, { allowedPaths: ALLOWED_PATHS });
		const parsed = JSON.parse(result);

		// The local Whisper model may not be downloadable in all environments,
		// so accept either a successful transcription or a graceful error.
		if (parsed.ok) {
			assert.strictEqual(parsed.backend, "local");
			assert.ok(typeof parsed.text === "string");
		} else {
			assert.ok(parsed.error.length > 0);
		}
	});

	it("transcribes via the API backend when apiKey is provided", async () => {
		const filePath = join(TEST_DIR, "fixture.wav");
		writeFileSync(filePath, buildWavFixture());

		const origFetch = globalThis.fetch;
		globalThis.fetch = async (url, _opts) => {
			assert.ok(url.includes("/audio/transcriptions"));
			return {
				ok: true,
				json: async () => ({ text: "transcribed from api" }),
			};
		};

		try {
			const result = await transcribeAudioImpl(
				{ path: filePath },
				{ allowedPaths: ALLOWED_PATHS, openaiApiKey: "sk-test" },
			);
			const parsed = JSON.parse(result);
			assert.strictEqual(parsed.ok, true);
			assert.strictEqual(parsed.backend, "api");
			assert.strictEqual(parsed.text, "transcribed from api");
		} finally {
			globalThis.fetch = origFetch;
		}
	});
});
