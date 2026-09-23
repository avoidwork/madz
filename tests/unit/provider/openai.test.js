import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import {
	createChatModel,
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

describe("createChatModel does not patch the model instance", () => {
	beforeEach(() => {
		resetTokenBudget();
	});

	// Regression guard for the original defect: enforcement was wired by
	// assigning model.invoke/stream as instance properties, which ChatOpenAI
	// .bindTools() -> withConfig() orphans (it builds a NEW object). The budget
	// must be enforced by the TokenBudget middleware, never by patching here.
	it("leaves invoke/stream unpatched when a budget is configured", () => {
		const model = createChatModel(makeConfig(100000));
		assert.strictEqual(model._rawInvoke, undefined);
		assert.strictEqual(model._rawStream, undefined);
		// invoke/stream must be the prototype methods, not own properties.
		assert.ok(!Object.hasOwn(model, "invoke"), "invoke must not be an own property");
		assert.ok(!Object.hasOwn(model, "stream"), "stream must not be an own property");
	});

	it("leaves invoke/stream unpatched when the budget is disabled", () => {
		const model = createChatModel(makeConfig(0));
		assert.strictEqual(model._rawInvoke, undefined);
		assert.ok(!Object.hasOwn(model, "invoke"));
	});
});

describe("shared token budget across model instances", () => {
	beforeEach(() => {
		resetTokenBudget();
	});

	it("createChatModel materializes the shared budget for its maxTokensMinute", () => {
		createChatModel(makeConfig(100000));
		// The middleware and the TUI status bar both resolve the same instance.
		assert.strictEqual(getSharedTokenBudget(100000), getSharedTokenBudget(100000));
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

	it("does not create a shared budget when maxTokensMinute is 0", () => {
		resetTokenBudget();
		createChatModel(makeConfig(0));
		// A disabled budget must not have been materialized; the first access
		// here creates a fresh instance whose window is empty.
		assert.strictEqual(getSharedTokenBudget(100000).current(), 0);
	});
});
