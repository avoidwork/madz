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

describe("createChatModel maxTokens handling", () => {
	beforeEach(() => {
		resetTokenBudget();
	});

	it("omits maxTokens from ChatOpenAI opts when maxTokens is -1", () => {
		const model = createChatModel({ ...makeConfig(0), maxTokens: -1 });
		// maxTokens must be omitted so the model uses its own output-token default.
		assert.strictEqual(model.maxTokens, undefined);
	});

	it("passes maxTokens through when it is a positive value", () => {
		const model = createChatModel({ ...makeConfig(0), maxTokens: 4096 });
		assert.strictEqual(model.maxTokens, 4096);
	});
});

describe("createChatModel Copilot base URL", () => {
	beforeEach(() => {
		resetTokenBudget();
	});

	it("derives the base URL from enterpriseUrl for GHEC", () => {
		const model = createChatModel({
			type: "github-copilot",
			model: "gpt-4o",
			base_url: "https://api.githubcopilot.com",
			enterpriseUrl: "https://ghe.example.com/",
			temperature: 0.4,
			maxTokens: -1,
			rateLimit: { maxRetries: 6 },
		});
		assert.strictEqual(model.clientConfig.baseURL, "https://ghe.example.com/api/v1");
	});

	it("uses the default Copilot base URL when no enterpriseUrl is set", () => {
		const model = createChatModel({
			type: "github-copilot",
			model: "gpt-4o",
			base_url: "https://api.githubcopilot.com",
			temperature: 0.4,
			maxTokens: -1,
			rateLimit: { maxRetries: 6 },
		});
		assert.strictEqual(model.clientConfig.baseURL, "https://api.githubcopilot.com");
	});
});

describe("createChatModel Copilot credential handling", () => {
	beforeEach(() => {
		resetTokenBudget();
	});

	// Regression guard for issue #1291: the OpenAI SDK v7 client constructor
	// throws `Missing credentials` when no apiKey/workloadIdentity/adminAPIKey is
	// present, even when a custom fetch is supplied. The Copilot path must pass a
	// non-empty placeholder apiKey so the credential check passes.
	it("constructs the Copilot model without throwing when OPENAI_API_KEY is unset", () => {
		const saved = process.env.OPENAI_API_KEY;
		delete process.env.OPENAI_API_KEY;
		try {
			const model = createChatModel({
				type: "github-copilot",
				model: "gpt-4o",
				base_url: "https://api.githubcopilot.com",
				temperature: 0.4,
				maxTokens: -1,
				rateLimit: { maxRetries: 6 },
			});
			assert.ok(model, "model should be constructed");
			assert.strictEqual(model.clientConfig.apiKey, "copilot");
		} finally {
			if (saved === undefined) {
				delete process.env.OPENAI_API_KEY;
			} else {
				process.env.OPENAI_API_KEY = saved;
			}
		}
	});

	it("sets a non-empty placeholder apiKey on the Copilot client config", () => {
		const model = createChatModel({
			type: "github-copilot",
			model: "gpt-4o",
			base_url: "https://api.githubcopilot.com",
			temperature: 0.4,
			maxTokens: -1,
			rateLimit: { maxRetries: 6 },
		});
		assert.strictEqual(model.clientConfig.apiKey, "copilot");
		assert.ok(model.clientConfig.apiKey.length > 0);
	});

	it("wires the custom fetch interceptor on the Copilot client config", () => {
		const model = createChatModel({
			type: "github-copilot",
			model: "gpt-4o",
			base_url: "https://api.githubcopilot.com",
			temperature: 0.4,
			maxTokens: -1,
			rateLimit: { maxRetries: 6 },
		});
		assert.strictEqual(typeof model.clientConfig.fetch, "function");
	});
});
