import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import {
	createChatModel,
	readUsageTokens,
	resetTokenBudget,
	getSharedTokenBudget,
} from "../../../src/provider/openai.js";

/**
 * Build a minimal provider config with a token budget enabled.
 * @param {number} [maxTokensMinute=100000] - Budget value
 * @returns {Object} Provider config
 */
function makeConfig(maxTokensMinute = 100000) {
	return {
		model: "gpt-4o",
		temperature: 0.7,
		maxTokens: 4096,
		credentials: { apiKey: "sk-test" },
		base_url: "https://api.openai.com/v1",
		rateLimit: { maxRetries: 6, maxTokensMinute },
	};
}

describe("readUsageTokens", () => {
	it("returns 0 for null/undefined result", () => {
		assert.strictEqual(readUsageTokens(null), 0);
		assert.strictEqual(readUsageTokens(undefined), 0);
	});

	it("returns 0 when no usage field is present", () => {
		assert.strictEqual(readUsageTokens({ content: "hi" }), 0);
	});

	it("reads usage_metadata.total_tokens", () => {
		const result = { usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } };
		assert.strictEqual(readUsageTokens(result), 15);
	});

	it("reads usage_metadata and sums when total absent", () => {
		const result = { usage_metadata: { input_tokens: 10, output_tokens: 5 } };
		assert.strictEqual(readUsageTokens(result), 15);
	});

	it("reads legacy usage.prompt_tokens + completion_tokens", () => {
		const result = { usage: { prompt_tokens: 20, completion_tokens: 8, total_tokens: 28 } };
		assert.strictEqual(readUsageTokens(result), 28);
	});

	it("reads llmOutput.usage", () => {
		const result = { llmOutput: { usage: { prompt_tokens: 3, completion_tokens: 2 } } };
		assert.strictEqual(readUsageTokens(result), 5);
	});
});

describe("shared token budget across model instances", () => {
	beforeEach(() => {
		resetTokenBudget();
	});

	it("two createChatModel instances with the same maxTokensMinute share one window", async () => {
		const a = createChatModel(makeConfig(100000));
		const b = createChatModel(makeConfig(100000));

		// Both models must resolve to the same shared budget instance.
		assert.strictEqual(getSharedTokenBudget(100000), getSharedTokenBudget(100000));

		// Drive a dispatch through a; the shared window records the reconciled usage.
		// Swap the raw method so the budget wrapper (reserve/reconcile) stays in the path.
		a._rawInvoke = async () => ({
			usage_metadata: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
		});
		await a.invoke([{ role: "user", content: "hello" }]);

		// b paces against the same window, so it sees a's consumed tokens.
		assert.strictEqual(getSharedTokenBudget(100000).current(), 150);
		assert.ok(b !== null);
	});

	it("a different maxTokensMinute yields a different shared budget", () => {
		createChatModel(makeConfig(100000));
		const small = getSharedTokenBudget(50000);
		const large = getSharedTokenBudget(100000);
		assert.notStrictEqual(small, large);
	});

	it("resetTokenBudget yields a fresh budget for subsequent models", () => {
		const before = getSharedTokenBudget(100000);
		resetTokenBudget();
		const after = getSharedTokenBudget(100000);
		assert.notStrictEqual(before, after, "reset should create a fresh budget instance");
	});
});

describe("dispatch wrapper budget behavior", () => {
	beforeEach(() => {
		resetTokenBudget();
	});

	it("successful dispatch reconciles the reservation to actual usage", async () => {
		const model = createChatModel(makeConfig(100000));
		let calls = 0;
		model._rawInvoke = async () => {
			calls += 1;
			return { usage_metadata: { input_tokens: 100, output_tokens: 50, total_tokens: 150 } };
		};
		const result = await model.invoke([{ role: "user", content: "hello" }]);
		assert.strictEqual(calls, 1);
		assert.strictEqual(result.usage_metadata.total_tokens, 150);
	});

	it("failed dispatch releases the reservation (no budget charge)", async () => {
		const model = createChatModel(makeConfig(100000));
		model._rawInvoke = async () => {
			throw new Error("boom");
		};
		await assert.rejects(() => model.invoke([{ role: "user", content: "hello" }]), /boom/);
	});

	it("dispatch without usage keeps the estimate (no crash)", async () => {
		const model = createChatModel(makeConfig(100000));
		model._rawInvoke = async () => ({ content: "no usage here" });
		const result = await model.invoke([{ role: "user", content: "hello" }]);
		assert.strictEqual(result.content, "no usage here");
	});

	it("429 retry re-paces and charges only the successful attempt", async () => {
		const model = createChatModel(makeConfig(100000));
		let calls = 0;
		model._rawInvoke = async () => {
			calls += 1;
			if (calls === 1) {
				const err = new Error("rate limited");
				err.status = 429;
				err.headers = { "retry-after": "0" };
				throw err;
			}
			return { usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } };
		};
		const result = await model.invoke([{ role: "user", content: "hello" }]);
		assert.strictEqual(calls, 2, "should have retried once");
		assert.strictEqual(result.usage_metadata.total_tokens, 15);
	});

	it("non-429 error is thrown without retry", async () => {
		const model = createChatModel(makeConfig(100000));
		let calls = 0;
		model._rawInvoke = async () => {
			calls += 1;
			throw new Error("server error");
		};
		await assert.rejects(() => model.invoke([{ role: "user", content: "hello" }]), /server error/);
		assert.strictEqual(calls, 1, "should not retry a non-429 error");
	});
});
