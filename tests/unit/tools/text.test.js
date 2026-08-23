import { describe, it, expect } from "node:test";
import { textImpl } from "../../src/tools/text.js";

describe("text tool", () => {
	describe("validation", () => {
		it("rejects empty input", async () => {
			const result = JSON.parse(await textImpl({ action: "summarize", input: "" }));
			expect(result.ok).toBe(false);
			expect(result.error).toContain("required");
		});

		it("rejects input exceeding 10000 characters", async () => {
			const longText = "a".repeat(10001);
			const result = JSON.parse(await textImpl({ action: "summarize", input: longText }));
			expect(result.ok).toBe(false);
			expect(result.error).toContain("10000");
		});

		it("rejects missing input", async () => {
			const result = JSON.parse(await textImpl({ action: "summarize" }));
			expect(result.ok).toBe(false);
			expect(result.error).toContain("required");
		});

		it("rejects missing action", async () => {
			const result = JSON.parse(await textImpl({ input: "hello" }));
			expect(result.ok).toBe(false);
		});
	});

	describe("summarize", () => {
		it("returns structured output with result, action, metadata", async () => {
			const result = JSON.parse(
				await textImpl(
					{ action: "summarize", input: "The quick brown fox jumps over the lazy dog." },
					{ openaiApiKey: "test-key" },
				),
			);
			expect(result.ok).toBe(true);
			expect(result.action).toBe("summarize");
			expect(result.result).toBeDefined();
			expect(result.metadata).toBeDefined();
		});
	});

	describe("rewrite", () => {
		it("returns structured output with tone option", async () => {
			const result = JSON.parse(
				await textImpl(
					{ action: "rewrite", input: "Hey, what's up?", options: { tone: "professional" } },
					{ openaiApiKey: "test-key" },
				),
			);
			expect(result.ok).toBe(true);
			expect(result.action).toBe("rewrite");
		});
	});

	describe("tone", () => {
		it("returns structured output with tone adjustment", async () => {
			const result = JSON.parse(
				await textImpl(
					{ action: "tone", input: "This is great!", options: { tone: "formal" } },
					{ openaiApiKey: "test-key" },
				),
			);
			expect(result.ok).toBe(true);
			expect(result.action).toBe("tone");
		});
	});

	describe("grammar", () => {
		it("returns structured output with corrections", async () => {
			const result = JSON.parse(
				await textImpl(
					{ action: "grammar", input: "Their going to the store." },
					{ openaiApiKey: "test-key" },
				),
			);
			expect(result.ok).toBe(true);
			expect(result.action).toBe("grammar");
		});
	});

	describe("shorten", () => {
		it("returns structured output with target length", async () => {
			const result = JSON.parse(
				await textImpl(
					{
						action: "shorten",
						input: "This is a very long sentence that should be shortened significantly.",
						options: { targetLength: 20 },
					},
					{ openaiApiKey: "test-key" },
				),
			);
			expect(result.ok).toBe(true);
			expect(result.action).toBe("shorten");
		});
	});

	describe("expand", () => {
		it("returns structured output with target length", async () => {
			const result = JSON.parse(
				await textImpl(
					{ action: "expand", input: "Hello.", options: { targetLength: 200 } },
					{ openaiApiKey: "test-key" },
				),
			);
			expect(result.ok).toBe(true);
			expect(result.action).toBe("expand");
		});
	});

	describe("missing API key", () => {
		it("returns error when no API key is available", async () => {
			const originalKey = process.env.OPENAI_API_KEY;
			delete process.env.OPENAI_API_KEY;
			const result = JSON.parse(await textImpl({ action: "summarize", input: "hello" }));
			expect(result.ok).toBe(false);
			expect(result.error).toContain("OPENAI_API_KEY");
			if (originalKey) process.env.OPENAI_API_KEY = originalKey;
		});
	});
});
