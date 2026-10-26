import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { AIMessageChunk, ChatMessageChunk } from "@langchain/core/messages";
import {
	createChatModel,
	resetTokenBudget,
	getSharedTokenBudget,
	resolveCopilotModel,
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
		assert.strictEqual(model.clientConfig.baseURL, "https://copilot-api.ghe.example.com");
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

describe("createChatModel roleless delta normalization", () => {
	beforeEach(() => {
		resetTokenBudget();
	});

	// Regression guard for the Copilot "expected AIMessage or Command, got object"
	// error. Copilot's proxy emits a roleless first delta for reasoning models
	// (the first chunk carries reasoning_content but no `role`). The converter
	// maps a roleless delta to a ChatMessageChunk, which fails AgentNode's
	// `isInternalModelResponse` check. The patch must default the role to
	// "assistant" so the chunk becomes an AIMessageChunk.
	it("defaults a roleless delta to assistant so it becomes an AIMessageChunk", () => {
		const model = createChatModel({
			type: "github-copilot",
			model: "gpt-4o",
			base_url: "https://api.githubcopilot.com",
			temperature: 0.4,
			maxTokens: -1,
			rateLimit: { maxRetries: 6 },
		});
		const conv = model.completions._convertCompletionsDeltaToBaseMessageChunk.bind(
			model.completions,
		);
		const chunk = conv(
			{ content: "", reasoning_content: "thinking..." },
			{ id: "x", choices: [{ index: 0 }], usage: {} },
			undefined,
		);
		assert.ok(chunk instanceof AIMessageChunk, "roleless delta must become an AIMessageChunk");
		assert.ok(!(chunk instanceof ChatMessageChunk), "must not fall through to ChatMessageChunk");
	});

	// The agent dispatch path calls model.bindTools(), which constructs a NEW
	// ChatOpenAI (and a new ChatOpenAICompletions) via withConfig(). An
	// instance-level patch is orphaned and never fires. The patch MUST be on the
	// prototype so it survives the rebuild.
	it("survives bindTools so the agent dispatch path sees the fix", () => {
		const model = createChatModel({
			type: "github-copilot",
			model: "gpt-4o",
			base_url: "https://api.githubcopilot.com",
			temperature: 0.4,
			maxTokens: -1,
			rateLimit: { maxRetries: 6 },
		});
		const bound = model.bindTools([
			{ name: "read_file", description: "d", schema: { type: "object", properties: {} } },
		]);
		assert.notStrictEqual(bound, model, "bindTools must return a new model");
		const conv = bound.completions._convertCompletionsDeltaToBaseMessageChunk.bind(
			bound.completions,
		);
		const chunk = conv(
			{ content: "", reasoning_content: "thinking..." },
			{ id: "x", choices: [{ index: 0 }], usage: {} },
			undefined,
		);
		assert.ok(
			chunk instanceof AIMessageChunk,
			"roleless delta must become an AIMessageChunk after bindTools",
		);
	});

	it("defaults a roleless tool-call delta to assistant", () => {
		const model = createChatModel({
			type: "github-copilot",
			model: "gpt-4o",
			base_url: "https://api.githubcopilot.com",
			temperature: 0.4,
			maxTokens: -1,
			rateLimit: { maxRetries: 6 },
		});
		const conv = model.completions._convertCompletionsDeltaToBaseMessageChunk.bind(
			model.completions,
		);
		const chunk = conv(
			{ tool_calls: [{ index: 0, id: "call_1", function: { name: "ls", arguments: "{}" } }] },
			{ id: "x", choices: [{ index: 0 }], usage: {} },
			undefined,
		);
		assert.ok(
			chunk instanceof AIMessageChunk,
			"roleless tool-call delta must become an AIMessageChunk",
		);
	});

	it("preserves an explicit assistant role", () => {
		const model = createChatModel({
			type: "github-copilot",
			model: "gpt-4o",
			base_url: "https://api.githubcopilot.com",
			temperature: 0.4,
			maxTokens: -1,
			rateLimit: { maxRetries: 6 },
		});
		const conv = model.completions._convertCompletionsDeltaToBaseMessageChunk.bind(
			model.completions,
		);
		const chunk = conv(
			{ role: "assistant", content: "hello" },
			{ id: "x", choices: [{ index: 0 }], usage: {} },
			undefined,
		);
		assert.ok(chunk instanceof AIMessageChunk);
	});
});

describe("resolveCopilotModel", () => {
	it("resolves the configured model against the tenant model list", async () => {
		const origFetch = globalThis.fetch;
		globalThis.fetch = async (url) => {
			assert.strictEqual(url, "https://api.githubcopilot.com/models");
			return new Response(
				JSON.stringify({
					data: [
						{ id: "gpt-4o", model_picker_enabled: true },
						{ id: "gpt-4o-mini", model_picker_enabled: true },
					],
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		};
		try {
			const result = await resolveCopilotModel({
				type: "github-copilot",
				model: "gpt-4o",
				base_url: "https://api.githubcopilot.com",
			});
			assert.strictEqual(result, "gpt-4o");
		} finally {
			globalThis.fetch = origFetch;
		}
	});

	it("falls back to the configured model when discovery fails", async () => {
		const origFetch = globalThis.fetch;
		globalThis.fetch = async () => new Response("nope", { status: 500 });
		try {
			const result = await resolveCopilotModel({
				type: "github-copilot",
				model: "gpt-4o",
				base_url: "https://api.githubcopilot.com",
			});
			assert.strictEqual(result, "gpt-4o");
		} finally {
			globalThis.fetch = origFetch;
		}
	});

	it("falls back to the configured model when the model is not in the list", async () => {
		const origFetch = globalThis.fetch;
		globalThis.fetch = async () =>
			new Response(JSON.stringify({ data: [{ id: "other-model", model_picker_enabled: true }] }), {
				status: 200,
			});
		try {
			const result = await resolveCopilotModel({
				type: "github-copilot",
				model: "gpt-4o",
				base_url: "https://api.githubcopilot.com",
			});
			assert.strictEqual(result, "gpt-4o");
		} finally {
			globalThis.fetch = origFetch;
		}
	});

	it("uses the enterprise base URL for discovery", async () => {
		const origFetch = globalThis.fetch;
		globalThis.fetch = async (url) => {
			assert.strictEqual(url, "https://copilot-api.ghe.example.com/models");
			return new Response(
				JSON.stringify({ data: [{ id: "gpt-4o", model_picker_enabled: true }] }),
				{ status: 200 },
			);
		};
		try {
			const result = await resolveCopilotModel({
				type: "github-copilot",
				model: "gpt-4o",
				enterpriseUrl: "https://ghe.example.com/",
				base_url: "https://api.githubcopilot.com",
			});
			assert.strictEqual(result, "gpt-4o");
		} finally {
			globalThis.fetch = origFetch;
		}
	});

	it("falls back to the configured model on a network error", async () => {
		const origFetch = globalThis.fetch;
		globalThis.fetch = async () => {
			throw new Error("network unreachable");
		};
		try {
			const result = await resolveCopilotModel({
				type: "github-copilot",
				model: "gpt-4o",
				base_url: "https://api.githubcopilot.com",
			});
			assert.strictEqual(result, "gpt-4o");
		} finally {
			globalThis.fetch = origFetch;
		}
	});

	it("sends the Authorization Bearer header on the /models discovery request", async () => {
		const origFetch = globalThis.fetch;
		let capturedHeaders;
		// The Copilot fetch interceptor reads the token from memory/auth.json
		// (relative to cwd). Write a token so the real interceptor injects the
		// bearer header, then clean up.
		const fs = await import("node:fs/promises");
		await fs.mkdir("memory", { recursive: true });
		await fs.writeFile("memory/auth.json", JSON.stringify({ access_token: "test-token" }), {
			mode: 0o600,
		});
		globalThis.fetch = async (url, init) => {
			capturedHeaders = init?.headers;
			return new Response(
				JSON.stringify({ data: [{ id: "gpt-4o", model_picker_enabled: true }] }),
				{ status: 200 },
			);
		};
		try {
			const result = await resolveCopilotModel({
				type: "github-copilot",
				model: "gpt-4o",
				base_url: "https://api.githubcopilot.com",
			});
			assert.strictEqual(result, "gpt-4o");
			const headers =
				capturedHeaders instanceof Headers ? capturedHeaders : new Headers(capturedHeaders);
			assert.strictEqual(headers.get("Authorization"), "Bearer test-token");
		} finally {
			globalThis.fetch = origFetch;
			await fs.rm("memory/auth.json", { force: true });
		}
	});
});
