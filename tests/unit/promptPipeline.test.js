import { describe, it } from "node:test";
import { strictEqual, deepStrictEqual, ok, equal } from "node:assert";

import {
	classifyPrompt,
	rewritePrompt,
	processPrompt,
} from "../../src/agent/promptPipeline/index.js";
import {
	INTENT_CATEGORIES,
	DOMAIN_CATEGORIES,
	COMPLEXITY_CATEGORIES,
	DEFAULT_METADATA,
	isValidIntent,
	isValidDomain,
	isValidComplexity,
	isValidMetadata,
} from "../../src/agent/promptPipeline/categories.js";
import {
	createClassificationPrompt,
	createRewritingPrompt,
} from "../../src/agent/promptPipeline/prompts.js";

// Mock model factory — returns a fixed response on every call
function createMockModel(responseContent) {
	let callCount = 0;
	const invokeMock = async () => {
		callCount++;
		return { content: responseContent };
	};
	invokeMock.mock = { callCount: () => callCount };
	return { invoke: invokeMock };
}

// Mock model factory — returns a fixed rejection on every call
function createMockModelReject() {
	let callCount = 0;
	const invokeMock = async () => {
		callCount++;
		throw new Error("LLM error");
	};
	invokeMock.mock = { callCount: () => callCount };
	return { invoke: invokeMock };
}

// Mock model factory — returns different responses on successive calls
function createMockModelSequence(...responses) {
	let callCount = 0;
	const invokeMock = async () => {
		const idx = callCount % responses.length;
		callCount++;
		return { content: responses[idx] };
	};
	invokeMock.mock = { callCount: () => callCount };
	return { invoke: invokeMock };
}

describe("promptPipeline/categories", () => {
	describe("INTENT_CATEGORIES", () => {
		it("should contain all expected intent categories", () => {
			deepStrictEqual(INTENT_CATEGORIES, ["question", "task", "creative", "analysis", "other"]);
		});

		it("should be frozen (immutable)", () => {
			ok(Object.isFrozen(INTENT_CATEGORIES));
			try {
				INTENT_CATEGORIES.push("new");
			} catch {
				ok(true);
			}
		});
	});

	describe("DOMAIN_CATEGORIES", () => {
		it("should contain all expected domain categories", () => {
			deepStrictEqual(DOMAIN_CATEGORIES, ["coding", "writing", "analysis", "general", "other"]);
		});
	});

	describe("COMPLEXITY_CATEGORIES", () => {
		it("should contain all expected complexity categories", () => {
			deepStrictEqual(COMPLEXITY_CATEGORIES, ["simple", "moderate", "complex"]);
		});
	});

	describe("DEFAULT_METADATA", () => {
		it("should have correct default values", () => {
			deepStrictEqual(DEFAULT_METADATA, {
				intent: "other",
				domain: "general",
				complexity: "moderate",
			});
		});

		it("should be frozen (immutable)", () => {
			ok(Object.isFrozen(DEFAULT_METADATA));
		});
	});

	describe("isValidIntent", () => {
		it("should return true for valid intent categories", () => {
			ok(isValidIntent("question"));
			ok(isValidIntent("task"));
			ok(isValidIntent("creative"));
			ok(isValidIntent("analysis"));
			ok(isValidIntent("other"));
		});

		it("should return false for invalid intent categories", () => {
			equal(isValidIntent("invalid"), false);
			equal(isValidIntent(""), false);
			equal(isValidIntent(null), false);
			equal(isValidIntent(undefined), false);
		});
	});

	describe("isValidDomain", () => {
		it("should return true for valid domain categories", () => {
			ok(isValidDomain("coding"));
			ok(isValidDomain("writing"));
			ok(isValidDomain("analysis"));
			ok(isValidDomain("general"));
			ok(isValidDomain("other"));
		});

		it("should return false for invalid domain categories", () => {
			equal(isValidDomain("invalid"), false);
			equal(isValidDomain(""), false);
		});
	});

	describe("isValidComplexity", () => {
		it("should return true for valid complexity categories", () => {
			ok(isValidComplexity("simple"));
			ok(isValidComplexity("moderate"));
			ok(isValidComplexity("complex"));
		});

		it("should return false for invalid complexity categories", () => {
			equal(isValidComplexity("invalid"), false);
			equal(isValidComplexity(""), false);
		});
	});

	describe("isValidMetadata", () => {
		it("should return true for valid metadata object", () => {
			ok(isValidMetadata({ intent: "task", domain: "coding", complexity: "simple" }));
		});

		it("should return false for metadata with invalid intent", () => {
			equal(isValidMetadata({ intent: "invalid", domain: "coding", complexity: "simple" }), false);
		});

		it("should return false for metadata with invalid domain", () => {
			equal(isValidMetadata({ intent: "task", domain: "invalid", complexity: "simple" }), false);
		});

		it("should return false for metadata with invalid complexity", () => {
			equal(isValidMetadata({ intent: "task", domain: "coding", complexity: "invalid" }), false);
		});

		it("should return false for null metadata", () => {
			equal(isValidMetadata(null), false);
		});

		it("should return false for non-object metadata", () => {
			equal(isValidMetadata("string"), false);
			equal(isValidMetadata([]), false);
		});

		it("should return false for metadata missing fields", () => {
			equal(isValidMetadata({ intent: "task" }), false);
			equal(isValidMetadata({}), false);
		});
	});
});

describe("promptPipeline/prompts", () => {
	describe("createClassificationPrompt", () => {
		it("should return a prompt template with the user prompt inserted", () => {
			const prompt = createClassificationPrompt("Write a Python function");
			ok(prompt.includes("Write a Python function"));
			ok(prompt.includes("intent"));
			ok(prompt.includes("domain"));
			ok(prompt.includes("complexity"));
		});

		it("should include all category options", () => {
			const prompt = createClassificationPrompt("test");
			for (const intent of INTENT_CATEGORIES) {
				ok(prompt.includes(intent));
			}
			for (const domain of DOMAIN_CATEGORIES) {
				ok(prompt.includes(domain));
			}
			for (const complexity of COMPLEXITY_CATEGORIES) {
				ok(prompt.includes(complexity));
			}
		});

		it("should request JSON output format", () => {
			const prompt = createClassificationPrompt("test");
			ok(prompt.includes('"intent"'));
			ok(prompt.includes('"domain"'));
			ok(prompt.includes('"complexity"'));
		});
	});

	describe("createRewritingPrompt", () => {
		it("should return a prompt template with all parameters inserted", () => {
			const prompt = createRewritingPrompt("Fix the bug", {
				intent: "task",
				domain: "coding",
				complexity: "simple",
			});
			ok(prompt.includes("Fix the bug"));
			ok(prompt.includes("task"));
			ok(prompt.includes("coding"));
			ok(prompt.includes("simple"));
		});

		it("should include rewriting guidelines", () => {
			const prompt = createRewritingPrompt("test", {
				intent: "task",
				domain: "coding",
				complexity: "simple",
			});
			ok(prompt.includes("Preserve the original intent"));
			ok(prompt.includes("Add structure"));
			ok(prompt.includes("Clarify ambiguity"));
		});

		it("should handle empty prompt", () => {
			const prompt = createRewritingPrompt("", {
				intent: "other",
				domain: "general",
				complexity: "simple",
			});
			ok(prompt.includes('""'));
		});

		it("should load intent-specific template for question intent", () => {
			const prompt = createRewritingPrompt("test", {
				intent: "question",
				domain: "general",
				complexity: "simple",
			});
			ok(
				prompt.includes("QUESTION intent") ||
					prompt.includes("question intent") ||
					prompt.includes("What is"),
			);
		});

		it("should load intent-specific template for task intent", () => {
			const prompt = createRewritingPrompt("test", {
				intent: "task",
				domain: "coding",
				complexity: "simple",
			});
			ok(
				prompt.includes("TASK intent") ||
					prompt.includes("task intent") ||
					prompt.includes("Fix the code issue"),
			);
		});

		it("should load intent-specific template for creative intent", () => {
			const prompt = createRewritingPrompt("test", {
				intent: "creative",
				domain: "writing",
				complexity: "moderate",
			});
			ok(
				prompt.includes("CREATIVE intent") ||
					prompt.includes("creative intent") ||
					prompt.includes("creative short story"),
			);
		});

		it("should load intent-specific template for analysis intent", () => {
			const prompt = createRewritingPrompt("test", {
				intent: "analysis",
				domain: "coding",
				complexity: "moderate",
			});
			ok(
				prompt.includes("ANALYSIS intent") ||
					prompt.includes("analysis intent") ||
					prompt.includes("Analyze the provided code"),
			);
		});

		it("should load intent-specific template for other intent", () => {
			const prompt = createRewritingPrompt("test", {
				intent: "other",
				domain: "general",
				complexity: "simple",
			});
			ok(
				prompt.includes("OTHER intent") ||
					prompt.includes("other intent") ||
					prompt.includes("Provide assistance"),
			);
		});

		it("should replace placeholders with metadata values", () => {
			const prompt = createRewritingPrompt("my prompt", {
				intent: "task",
				domain: "coding",
				complexity: "complex",
			});
			ok(prompt.includes("my prompt"));
			ok(prompt.includes("task"));
			ok(prompt.includes("coding"));
			ok(prompt.includes("complex"));
		});

		it("should handle unknown intent by falling back to other template", () => {
			const prompt = createRewritingPrompt("test", {
				intent: "unknown_intent",
				domain: "general",
				complexity: "simple",
			});
			// Should still return a valid prompt (fallback to other template)
			ok(typeof prompt === "string");
			ok(prompt.length > 0);
		});
	});
});

describe("promptPipeline/index - classifyPrompt", () => {
	it("should return parsed metadata from valid JSON response", async () => {
		const model = createMockModel(
			'{"intent": "task", "domain": "coding", "complexity": "moderate"}',
		);
		const result = await classifyPrompt(model, "Write a function");
		deepStrictEqual(result, { intent: "task", domain: "coding", complexity: "moderate" });
		ok(model.invoke.mock.callCount() > 0);
	});

	it("should return default metadata when LLM call fails", async () => {
		const model = createMockModelReject();
		const result = await classifyPrompt(model, "Write a function");
		deepStrictEqual(result, DEFAULT_METADATA);
	});

	it("should return default metadata when response is not valid JSON", async () => {
		const model = createMockModel("This is not JSON");
		const result = await classifyPrompt(model, "Write a function");
		deepStrictEqual(result, DEFAULT_METADATA);
	});

	it("should return default metadata when JSON has invalid categories", async () => {
		const model = createMockModel(
			'{"intent": "invalid", "domain": "coding", "complexity": "simple"}',
		);
		const result = await classifyPrompt(model, "Write a function");
		deepStrictEqual(result, DEFAULT_METADATA);
	});

	it("should handle markdown code blocks in response", async () => {
		const model = createMockModel(
			'```json\n{"intent": "question", "domain": "general", "complexity": "simple"}\n```',
		);
		const result = await classifyPrompt(model, "What is 2+2?");
		deepStrictEqual(result, { intent: "question", domain: "general", complexity: "simple" });
	});

	it("should handle string content from LLM response", async () => {
		const model = createMockModel(
			'{"intent": "creative", "domain": "writing", "complexity": "moderate"}',
		);
		const result = await classifyPrompt(model, "Write a poem");
		deepStrictEqual(result, { intent: "creative", domain: "writing", complexity: "moderate" });
	});
});

describe("promptPipeline/index - rewritePrompt", () => {
	it("should return rewritten prompt from LLM response", async () => {
		const model = createMockModel("Please write a function that sorts a list in ascending order.");
		const result = await rewritePrompt(model, "sort list", {
			intent: "task",
			domain: "coding",
			complexity: "simple",
		});
		strictEqual(result, "Please write a function that sorts a list in ascending order.");
		ok(model.invoke.mock.callCount() > 0);
	});

	it("should return original prompt when LLM call fails", async () => {
		const model = createMockModelReject();
		const result = await rewritePrompt(model, "original prompt", {
			intent: "task",
			domain: "coding",
			complexity: "simple",
		});
		strictEqual(result, "original prompt");
	});

	it("should extract content from markdown code blocks", async () => {
		const model = createMockModel("```Rewritten prompt here```");
		const result = await rewritePrompt(model, "test", {
			intent: "task",
			domain: "coding",
			complexity: "simple",
		});
		strictEqual(result, "Rewritten prompt here");
	});

	it("should handle string content from LLM response", async () => {
		const model = createMockModel("Rewritten content");
		const result = await rewritePrompt(model, "test", {
			intent: "task",
			domain: "coding",
			complexity: "simple",
		});
		strictEqual(result, "Rewritten content");
	});
});

describe("promptPipeline/index - processPrompt", () => {
	it("should classify and rewrite a prompt successfully", async () => {
		// processPrompt uses the same model for both classify and rewrite
		// First call returns classification JSON, second call returns rewritten prompt
		const model = createMockModelSequence(
			'{"intent": "task", "domain": "coding", "complexity": "moderate"}',
			"Please create a function that handles user input.",
		);
		const result = await processPrompt(model, "make a function");
		deepStrictEqual(result.metadata, { intent: "task", domain: "coding", complexity: "moderate" });
		strictEqual(result.rewrittenPrompt, "Please create a function that handles user input.");
	});

	it("should use default metadata when classification fails but still rewrite", async () => {
		// First call (classify) fails, second call (rewrite) succeeds
		let callNum = 0;
		const model = {
			invoke: async () => {
				callNum++;
				if (callNum === 1) throw new Error("LLM error");
				return { content: "Rewritten using defaults" };
			},
		};
		model.invoke.mock = { callCount: () => callNum };
		const result = await processPrompt(model, "test prompt");
		deepStrictEqual(result.metadata, DEFAULT_METADATA);
		strictEqual(result.rewrittenPrompt, "Rewritten using defaults");
	});

	it("should return original prompt when both classification and rewriting fail", async () => {
		const model = createMockModelReject();
		const result = await processPrompt(model, "original message");
		deepStrictEqual(result.metadata, DEFAULT_METADATA);
		strictEqual(result.rewrittenPrompt, "original message");
	});

	it("should pass classification metadata to rewriting", async () => {
		let callNum = 0;
		const model = {
			invoke: async (prompt) => {
				callNum++;
				if (callNum === 1) {
					// First call: classification
					return {
						content: '{"intent": "creative", "domain": "writing", "complexity": "complex"}',
					};
				}
				// Second call: rewriting — verify prompt contains metadata
				ok(prompt.includes("creative"));
				ok(prompt.includes("writing"));
				ok(prompt.includes("complex"));
				return { content: "Rewritten" };
			},
		};
		model.invoke.mock = { callCount: () => callNum };
		await processPrompt(model, "test");
		equal(callNum, 2);
	});
});
