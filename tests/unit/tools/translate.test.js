import { describe, it, expect } from "node:test";
import { translateImpl } from "../../../src/tools/translate.js";

describe("translate tool", () => {
	describe("validation", () => {
		it("rejects empty input", async () => {
			const result = JSON.parse(await translateImpl({ action: "translate", input: "", targetLanguage: "fr" }));
			expect(result.ok).toBe(false);
			expect(result.error).toContain("required");
		});

		it("rejects input exceeding 10000 characters", async () => {
			const longText = "a".repeat(10001);
			const result = JSON.parse(await translateImpl({ action: "translate", input: longText, targetLanguage: "fr" }));
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
			const result = JSON.parse(await translateImpl(
				{ action: "detect", input: "Hello, how are you?" },
				{ openaiApiKey: "test-key" }
			));
			expect(result.ok).toBe(true);
			expect(result.action).toBe("detect");
			expect(result.result).toBeDefined();
		});
	});

	describe("translate", () => {
		it("returns structured output", async () => {
			const result = JSON.parse(await translateImpl(
				{ action: "translate", input: "Hello world", targetLanguage: "fr" },
				{ openaiApiKey: "test-key" }
			));
			expect(result.ok).toBe(true);
			expect(result.action).toBe("translate");
			expect(result.result).toBeDefined();
		});

		it("includes metadata with source and target language", async () => {
			const result = JSON.parse(await translateImpl(
				{ action: "translate", input: "Hello", targetLanguage: "de", sourceLanguage: "en" },
				{ openaiApiKey: "test-key" }
			));
			expect(result.ok).toBe(true);
			expect(result.metadata).toBeDefined();
		});
	});

	describe("missing API key", () => {
		it("returns error when no API key is available", async () => {
			const originalKey = process.env.OPENAI_API_KEY;
			delete process.env.OPENAI_API_KEY;
			const result = JSON.parse(await translateImpl({ action: "translate", input: "hello", targetLanguage: "fr" }));
			expect(result.ok).toBe(false);
			expect(result.error).toContain("OPENAI_API_KEY");
			if (originalKey) process.env.OPENAI_API_KEY = originalKey;
		});
	});
});