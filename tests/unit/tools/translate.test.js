import { describe, it, expect } from "node:test";
import { translateImpl } from "../../../src/tools/translate.js";

describe("translate tool", () => {
	describe("validation", () => {
		it("rejects empty input", async () => {
			const result = JSON.parse(
				await translateImpl({ action: "translate", input: "", targetLanguage: "fr" }),
			);
			expect(result.ok).toBe(false);
			expect(result.error).toContain("required");
		});

		it("rejects input exceeding 10000 characters", async () => {
			const longText = "a".repeat(10001);
			const result = JSON.parse(
				await translateImpl({ action: "translate", input: longText, targetLanguage: "fr" }),
			);
			expect(result.ok).toBe(false);
			expect(result.error).toContain("10000");
		});

		it("rejects missing input", async () => {
			const result = JSON.parse(await translateImpl({ action: "translate", targetLanguage: "fr" }));
			expect(result.ok).toBe(false);
			expect(result.error).toContain("required");
		});

		it("rejects translate action without targetLanguage", async () => {
			const result = JSON.parse(await translateImpl({ action: "translate", input: "hello" }));
			expect(result.ok).toBe(false);
			expect(result.error).toContain("targetLanguage");
		});
	});

	describe("detect", () => {
		it("returns structured output with language info", async () => {
			const result = JSON.parse(
				await translateImpl(
					{ action: "detect", input: "Hello, how are you?" },
					{ apiKey: "test-key" },
				),
			);
			expect(result.ok).toBe(true);
			expect(result.action).toBe("detect");
			expect(result.result).toBeDefined();
			expect(result.result.language).toBeDefined();
		});
	});

	describe("translate", () => {
		it("returns structured output", async () => {
			const result = JSON.parse(
				await translateImpl(
					{ action: "translate", input: "Hello world", targetLanguage: "fr" },
					{ apiKey: "test-key" },
				),
			);
			expect(result.ok).toBe(true);
			expect(result.action).toBe("translate");
			expect(result.result.translatedText).toBeDefined();
		});

		it("includes metadata with source and target language", async () => {
			const result = JSON.parse(
				await translateImpl(
					{ action: "translate", input: "Hello", targetLanguage: "de", sourceLanguage: "en" },
					{ apiKey: "test-key" },
				),
			);
			expect(result.ok).toBe(true);
			expect(result.metadata.sourceLanguage).toBe("en");
			expect(result.metadata.targetLanguage).toBe("de");
		});
	});

	describe("missing API key", () => {
		it("returns error when no API key is available", async () => {
			const originalKey = process.env.GOOGLE_TRANSLATE_API_KEY;
			delete process.env.GOOGLE_TRANSLATE_API_KEY;
			const result = JSON.parse(
				await translateImpl({ action: "translate", input: "hello", targetLanguage: "fr" }),
			);
			expect(result.ok).toBe(false);
			expect(result.error).toContain("GOOGLE_TRANSLATE_API_KEY");
			if (originalKey) process.env.GOOGLE_TRANSLATE_API_KEY = originalKey;
		});
	});

	describe("caching", () => {
		it("returns cached result for repeated translation", async () => {
			const input = "Hello world";
			const target = "es";

			// First call - not cached
			const result1 = JSON.parse(
				await translateImpl(
					{ action: "translate", input, targetLanguage: target },
					{ apiKey: "test-key" },
				),
			);
			expect(result1.ok).toBe(true);
			expect(result1.metadata.cached).toBe(false);

			// Second call - should be cached
			const result2 = JSON.parse(
				await translateImpl(
					{ action: "translate", input, targetLanguage: target },
					{ apiKey: "test-key" },
				),
			);
			expect(result2.ok).toBe(true);
			expect(result2.metadata.cached).toBe(true);
			expect(result2.result.translatedText).toBe(result1.result.translatedText);
		});
	});
});
