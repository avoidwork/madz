import { describe, it, expect } from "node:test";
import { seoImpl } from "../../../src/tools/seo.js";

describe("seo tool", () => {
	describe("validation", () => {
		it("rejects empty input", async () => {
			const result = JSON.parse(await seoImpl({ action: "keyword-density", input: "" }));
			expect(result.ok).toBe(false);
			expect(result.error).toContain("required");
		});

		it("rejects input exceeding 10000 characters", async () => {
			const longText = "a".repeat(10001);
			const result = JSON.parse(await seoImpl({ action: "keyword-density", input: longText }));
			expect(result.ok).toBe(false);
			expect(result.error).toContain("10000");
		});

		it("rejects missing input", async () => {
			const result = JSON.parse(await seoImpl({ action: "keyword-density" }));
			expect(result.ok).toBe(false);
			expect(result.error).toContain("required");
		});
	});

	describe("keyword-density", () => {
		it("calculates density for a single keyword", async () => {
			const result = JSON.parse(
				await seoImpl(
					{ action: "keyword-density", input: "the cat the dog the bird", keywords: ["the"] },
					{ openaiApiKey: "test-key" },
				),
			);
			expect(result.ok).toBe(true);
			expect(result.action).toBe("keyword-density");
			expect(result.result).toBeDefined();
			expect(result.metadata.totalWords).toBeGreaterThan(0);
		});

		it("calculates density for multiple keywords", async () => {
			const result = JSON.parse(
				await seoImpl(
					{
						action: "keyword-density",
						input: "javascript javascript python java",
						keywords: ["javascript", "python"],
					},
					{ openaiApiKey: "test-key" },
				),
			);
			expect(result.ok).toBe(true);
			expect(result.result["javascript"]).toBeDefined();
			expect(result.result["python"]).toBeDefined();
		});

		it("handles empty keyword list by analyzing frequent words", async () => {
			const result = JSON.parse(
				await seoImpl(
					{ action: "keyword-density", input: "hello hello world hello" },
					{ openaiApiKey: "test-key" },
				),
			);
			expect(result.ok).toBe(true);
			expect(result.result).toBeDefined();
		});

		it("returns zero density for non-existent keyword", async () => {
			const result = JSON.parse(
				await seoImpl(
					{ action: "keyword-density", input: "hello world", keywords: ["xyz"] },
					{ openaiApiKey: "test-key" },
				),
			);
			expect(result.ok).toBe(true);
			expect(result.result["xyz"].density).toBe(0);
			expect(result.result["xyz"].count).toBe(0);
		});
	});

	describe("meta-description", () => {
		it("returns structured output", async () => {
			const result = JSON.parse(
				await seoImpl(
					{
						action: "meta-description",
						input: "A comprehensive guide to Node.js best practices for beginners.",
						options: { targetKeyword: "Node.js" },
					},
					{ openaiApiKey: "test-key" },
				),
			);
			expect(result.ok).toBe(true);
			expect(result.action).toBe("meta-description");
		});
	});

	describe("missing API key", () => {
		it("returns error when no API key is available for LLM actions", async () => {
			const originalKey = process.env.OPENAI_API_KEY;
			delete process.env.OPENAI_API_KEY;
			const result = JSON.parse(await seoImpl({ action: "meta-description", input: "hello" }));
			expect(result.ok).toBe(false);
			expect(result.error).toContain("OPENAI_API_KEY");
			if (originalKey) process.env.OPENAI_API_KEY = originalKey;
		});

		it("works without API key for keyword-density (local computation)", async () => {
			const originalKey = process.env.OPENAI_API_KEY;
			delete process.env.OPENAI_API_KEY;
			const result = JSON.parse(
				await seoImpl({ action: "keyword-density", input: "test test test", keywords: ["test"] }),
			);
			expect(result.ok).toBe(true);
			if (originalKey) process.env.OPENAI_API_KEY = originalKey;
		});
	});
});
