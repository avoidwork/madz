import { describe, it, before, after } from "node:test";
import assert from "node:assert";

describe("mixture_of_agents", () => {
	let origFetch;

	before(() => {
		origFetch = globalThis.fetch;
	});

	after(() => {
		globalThis.fetch = origFetch;
	});

	it("requires message", async () => {
		const { mixtureOfAgentsImpl } = await import("../../src/tools/moa.js");
		const result = await mixtureOfAgentsImpl({}, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Message is required"));
	});

	it("rejects empty message", async () => {
		const { mixtureOfAgentsImpl } = await import("../../src/tools/moa.js");
		const result = await mixtureOfAgentsImpl({ message: "" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Message is required"));
	});

	it("requires openrouterApiKey in options", async () => {
		const { mixtureOfAgentsImpl } = await import("../../src/tools/moa.js");
		const result = await mixtureOfAgentsImpl({ message: "What is AI?" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("OPENROUTER_API_KEY"));
	});

	it("calls OpenRouter with default models", async () => {
		const { mixtureOfAgentsImpl } = await import("../../src/tools/moa.js");
		globalThis.fetch = async (url, opts) => {
			assert.ok(url.includes("openrouter.ai"));
			assert.ok(url.includes("/chat/completions"));
			return {
				ok: true,
				json: async () => ({
					choices: [
						{ message: { content: "Response from " + (opts.headers["X-Title"] || "unknown") } },
					],
					model: "openai/gpt-4o",
				}),
			};
		};
		const responsePromise = mixtureOfAgentsImpl(
			{ message: "What is AI?" },
			{ openrouterApiKey: "sk-test-or" },
		);
		const result = JSON.parse(await responsePromise);
		assert.ok(result.ok);
		assert.strictEqual(result.agentsUsed, 4);
		assert.ok(result.aggregation);
		assert.ok(result.agreement);
		globalThis.fetch = origFetch;
	});

	it("aggregates partial results when some calls fail", async () => {
		const { mixtureOfAgentsImpl } = await import("../../src/tools/moa.js");
		let callCount = 0;
		globalThis.fetch = async () => {
			callCount++;
			if (callCount <= 2) {
				return {
					ok: true,
					json: async () => ({
						choices: [{ message: { content: `Agent ${callCount} response` } }],
					}),
				};
			}
			return {
				ok: false,
				status: 500,
				text: async () => "Internal error",
			};
		};
		const result = JSON.parse(
			await mixtureOfAgentsImpl({ message: "test message" }, { openrouterApiKey: "sk-test-or" }),
		);
		assert.ok(result.ok);
		assert.ok(result.agreement === false);
		assert.strictEqual(result.agentsUsed, 2);
		assert.strictEqual(result.agentsFailed, 2);
		assert.ok(result.failedAgents.length > 0);
		globalThis.fetch = origFetch;
	});

	it("returns error when all agent calls fail", async () => {
		const { mixtureOfAgentsImpl } = await import("../../src/tools/moa.js");
		globalThis.fetch = async () => ({
			ok: false,
			status: 503,
			text: async () => "Service unavailable",
		});
		const result = JSON.parse(
			await mixtureOfAgentsImpl({ message: "test" }, { openrouterApiKey: "sk-test-or" }),
		);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("All 4 model calls failed"));
		globalThis.fetch = origFetch;
	});

	it("rejects too few models", async () => {
		const { mixtureOfAgentsImpl } = await import("../../src/tools/moa.js");
		const result = JSON.parse(
			await mixtureOfAgentsImpl(
				{ message: "test", models: ["model1", "model2"] },
				{ openrouterApiKey: "sk-test-or" },
			),
		);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("At least 4 models"));
	});

	it("handles OpenRouter network error", async () => {
		const { mixtureOfAgentsImpl } = await import("../../src/tools/moa.js");
		globalThis.fetch = async () => {
			throw new Error("Network unreachable");
		};
		const result = JSON.parse(
			await mixtureOfAgentsImpl({ message: "test" }, { openrouterApiKey: "sk-test-or" }),
		);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("All 4 model calls failed"));
		globalThis.fetch = origFetch;
	});

	it("handles partial network errors", async () => {
		const { mixtureOfAgentsImpl } = await import("../../src/tools/moa.js");
		let callCount = 0;
		globalThis.fetch = async () => {
			callCount++;
			if (callCount <= 1) {
				return {
					ok: true,
					json: async () => ({
						choices: [{ message: { content: "Agent 1 response" } }],
					}),
				};
			}
			throw new Error("Network error");
		};
		const result = JSON.parse(
			await mixtureOfAgentsImpl({ message: "test" }, { openrouterApiKey: "sk-test-or" }),
		);
		assert.ok(result.ok);
		assert.strictEqual(result.agentsUsed, 1);
		assert.strictEqual(result.agentsFailed, 3);
		globalThis.fetch = origFetch;
	});
});
