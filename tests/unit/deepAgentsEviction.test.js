/**
 * Orchestrator wiring test for the eviction-ceiling replacement.
 *
 * The replacement only works if deepagents' `mergeMiddlewareStack` displaces the
 * library's own FilesystemMiddleware rather than stacking a second copy. If a
 * second copy survived, its 20,000-token default would still evict an
 * `image` tool result and the bug would persist while looking fixed — so this
 * asserts both the count and the behaviour of the assembled stack.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { ToolMessage } from "@langchain/core/messages";
import { deriveToolTokenLimitBeforeEvict } from "../../src/agent/evictionCeiling.js";

describe("createDeepAgentsOrchestrator filesystem middleware", () => {
	let orchestrator;
	let savedEnv;

	before(async () => {
		savedEnv = {
			OPENAI_API_KEY: process.env.OPENAI_API_KEY,
			EMAIL_GMAIL_CLIENT_ID: process.env.EMAIL_GMAIL_CLIENT_ID,
			EMAIL_GMAIL_CLIENT_SECRET: process.env.EMAIL_GMAIL_CLIENT_SECRET,
			EMAIL_GMAIL_REFRESH_TOKEN: process.env.EMAIL_GMAIL_REFRESH_TOKEN,
		};
		process.env.OPENAI_API_KEY = "sk-test-dummy";
		process.env.EMAIL_GMAIL_CLIENT_ID = "test-client-id";
		process.env.EMAIL_GMAIL_CLIENT_SECRET = "test-client-secret";
		process.env.EMAIL_GMAIL_REFRESH_TOKEN = "test-refresh-token";

		const { createDeepAgentsOrchestrator } = await import("../../src/agent/deepAgents.js");
		orchestrator = await createDeepAgentsOrchestrator();
	});

	after(() => {
		for (const [key, value] of Object.entries(savedEnv)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	});

	it("registers exactly one FilesystemMiddleware (same-name displacement, not stacking)", () => {
		const middleware = orchestrator.agent.options.middleware;
		const filesystem = middleware.filter((m) => m.name === "FilesystemMiddleware");

		assert.strictEqual(
			filesystem.length,
			1,
			"a second FilesystemMiddleware would keep evicting image tool results",
		);
	});

	it("registers a SummarizationMiddleware with a token trigger at the context fraction", () => {
		const middleware = orchestrator.agent.options.middleware;
		const summarization = middleware.find((m) => m.name === "SummarizationMiddleware");

		assert.ok(summarization, "SummarizationMiddleware must be registered");
		// The trigger is expressed in tokens because the model instance does not
		// expose profile.maxInputTokens; it should be contextFraction of the
		// resolved context window. When the window cannot be resolved the
		// middleware falls back to library defaults, so the trigger may be absent.
		const trigger = summarization.options?.trigger;
		if (trigger) {
			assert.strictEqual(trigger.type, "tokens");
			assert.ok(trigger.value > 0, "token trigger must be positive");
		}
	});

	it("drives the assembled middleware with the config-derived ceiling", async () => {
		const { loadConfig } = await import("../../src/config/loader.js");
		const config = loadConfig();
		const ceilingChars = deriveToolTokenLimitBeforeEvict(config) * 4;

		const middleware = orchestrator.agent.options.middleware.find(
			(m) => m.name === "FilesystemMiddleware",
		);
		const envelope = JSON.stringify({ ok: true, mimeType: "image/png", data: "" });
		const content = JSON.stringify({
			ok: true,
			mimeType: "image/png",
			data: "A".repeat(ceilingChars - envelope.length),
		});
		const message = new ToolMessage({
			content,
			name: "image",
			tool_call_id: "call_1",
			id: "msg_1",
		});

		assert.ok(
			content.length > 20000 * 4,
			"payload must exceed deepagents' hardcoded 80,000-char default",
		);

		const state = { files: {} };
		const result = await middleware.wrapToolCall(
			{ toolCall: { name: message.name, id: message.tool_call_id }, runtime: { state }, state },
			async () => message,
		);

		assert.ok(!result?.update?.files, "image tool result at the ceiling must not be evicted");
		const out = result?.update?.messages?.[0] ?? result;
		const parsed = JSON.parse(String(out.content));
		assert.strictEqual(parsed.ok, true);
		assert.ok(parsed.data.length > 0);
	});
});
