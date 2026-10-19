/**
 * Tests for the config-driven tool-result eviction ceiling.
 *
 * Guards three things:
 * 1. The replacement middleware carries the exact name deepagents'
 *    `mergeMiddlewareStack` keys on — otherwise a second FilesystemMiddleware
 *    stacks instead of displacing and the bug survives while looking fixed.
 * 2. The ceiling is derived from `image.maxSize` as base64 characters (never
 *    `maxSize * 1.33`) and can never be 0/undefined.
 * 3. Eviction actually stops at the derived ceiling and still fires above it.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { ToolMessage } from "@langchain/core/messages";
import { StateBackend, registerHarnessProfile, createHarnessProfile } from "deepagents";
import {
	deriveToolTokenLimitBeforeEvict,
	createEvictionAwareFilesystemMiddleware,
	ENVELOPE_HEADROOM,
} from "../../src/agent/evictionCeiling.js";
import {
	DEFAULT_IMAGE_MAX_SIZE,
	MIN_IMAGE_MAX_SIZE,
	MAX_IMAGE_MAX_SIZE,
} from "../../src/config/schemas/image.js";

/**
 * Build a `readImage`-shaped ToolMessage whose stringified content is exactly
 * `totalLength` characters (or the closest achievable length above it).
 * @param {number} totalLength - Desired stringified content length
 * @returns {ToolMessage} The tool message
 */
function makeReadImageMessage(totalLength) {
	const envelope = JSON.stringify({ ok: true, mimeType: "image/png", data: "" });
	const dataLength = Math.max(0, totalLength - envelope.length);
	const content = JSON.stringify({
		ok: true,
		mimeType: "image/png",
		data: "A".repeat(dataLength),
	});
	return new ToolMessage({ content, name: "readImage", tool_call_id: "call_1", id: "msg_1" });
}

/**
 * Drive the middleware's `wrapToolCall` around a single tool result.
 * @param {Object} middleware - The filesystem middleware
 * @param {ToolMessage} message - The tool result to process
 * @param {Object} state - LangGraph state (carries `files` for the StateBackend)
 * @returns {Promise<{ evicted: boolean, content: string }>} Eviction outcome
 */
async function runWrapToolCall(middleware, message, state) {
	const request = {
		toolCall: { name: message.name, id: message.tool_call_id },
		runtime: { state },
		state,
	};
	const result = await middleware.wrapToolCall(request, async () => message);
	const out = result?.update?.messages?.[0] ?? result;
	return {
		evicted: Boolean(result?.update?.files),
		content: String(out.content),
	};
}

describe("deriveToolTokenLimitBeforeEvict", () => {
	it("derives from the default image.maxSize as base64 characters", () => {
		const limit = deriveToolTokenLimitBeforeEvict({});
		assert.strictEqual(limit, Math.ceil((DEFAULT_IMAGE_MAX_SIZE + ENVELOPE_HEADROOM) / 4));
		assert.strictEqual(limit, 25032);
	});

	it("derives from a custom image.maxSize", () => {
		const limit = deriveToolTokenLimitBeforeEvict({ image: { maxSize: 200000 } });
		assert.strictEqual(limit, Math.ceil((200000 + ENVELOPE_HEADROOM) / 4));
		assert.strictEqual(limit, 50032);
	});

	it("falls back to the default when image.maxSize is unset", () => {
		assert.strictEqual(deriveToolTokenLimitBeforeEvict({}), 25032);
		assert.strictEqual(deriveToolTokenLimitBeforeEvict({ image: {} }), 25032);
		assert.strictEqual(deriveToolTokenLimitBeforeEvict(undefined), 25032);
	});

	it("falls back to the default when image.maxSize is zero", () => {
		assert.strictEqual(deriveToolTokenLimitBeforeEvict({ image: { maxSize: 0 } }), 25032);
	});

	it("never returns 0 or undefined for hostile values", () => {
		for (const value of [NaN, -1, "abc", null, Infinity, 0.5]) {
			const limit = deriveToolTokenLimitBeforeEvict({ image: { maxSize: value } });
			assert.ok(Number.isInteger(limit), `expected integer for ${String(value)}`);
			assert.ok(limit > 0, `expected positive for ${String(value)}`);
		}
	});

	it("clamps an oversized value so eviction cannot be disabled", () => {
		const limit = deriveToolTokenLimitBeforeEvict({ image: { maxSize: 999999999 } });
		assert.strictEqual(limit, Math.ceil((MAX_IMAGE_MAX_SIZE + ENVELOPE_HEADROOM) / 4));
	});

	it("clamps an undersized value so eviction stays meaningful", () => {
		const limit = deriveToolTokenLimitBeforeEvict({ image: { maxSize: 1 } });
		assert.strictEqual(limit, Math.ceil((MIN_IMAGE_MAX_SIZE + ENVELOPE_HEADROOM) / 4));
	});

	it("does NOT apply the base64 expansion factor (no * 1.33)", () => {
		const limit = deriveToolTokenLimitBeforeEvict({ image: { maxSize: 100000 } });
		// The inverted derivation would be ceil(ceil(100000 * 1.33) / 4) = 33250.
		assert.notStrictEqual(limit, Math.ceil(Math.ceil(100000 * 1.33) / 4));
		assert.ok(limit < Math.ceil(Math.ceil(100000 * 1.33) / 4));
	});
});

describe("createEvictionAwareFilesystemMiddleware", () => {
	it("is named exactly FilesystemMiddleware so the same-name merge displaces the default", () => {
		const middleware = createEvictionAwareFilesystemMiddleware({ config: {} });
		assert.strictEqual(middleware.name, "FilesystemMiddleware");
	});

	it("supplies all eight filesystem tools when the profile excludes none", () => {
		const middleware = createEvictionAwareFilesystemMiddleware({ config: {} });
		assert.deepStrictEqual(
			middleware.tools.map((tool) => tool.name),
			["ls", "read_file", "write_file", "edit_file", "delete", "glob", "grep", "execute"],
		);
	});

	it("mirrors the harness profile's excludedTools for the model", () => {
		// A unique model id keeps the global profile registry uncontaminated.
		registerHarnessProfile(
			"openai:eviction-ceiling-probe",
			createHarnessProfile({ excludedTools: ["execute", "grep", "ls"] }),
		);
		const middleware = createEvictionAwareFilesystemMiddleware({
			model: "openai:eviction-ceiling-probe",
			config: {},
		});
		assert.deepStrictEqual(
			middleware.tools.map((tool) => tool.name),
			["read_file", "write_file", "edit_file", "delete", "glob"],
		);
	});

	it("keeps read_file even when the profile excludes it", () => {
		registerHarnessProfile(
			"openai:eviction-ceiling-readfile-probe",
			createHarnessProfile({ excludedTools: ["read_file", "ls"] }),
		);
		const middleware = createEvictionAwareFilesystemMiddleware({
			model: "openai:eviction-ceiling-readfile-probe",
			config: {},
		});
		assert.ok(middleware.tools.some((tool) => tool.name === "read_file"));
	});

	it("resolves the profile from a model instance's provider and identifier", () => {
		registerHarnessProfile(
			"openai:eviction-ceiling-instance-probe",
			createHarnessProfile({ excludedTools: ["execute", "grep", "ls"] }),
		);
		// Mirrors what deepagents' getModelProvider/getModelIdentifier read off a
		// model instance: `getName()` for the provider hint and `model_name` /
		// `modelName` for the identifier hint.
		const model = { getName: () => "ChatOpenAI", model_name: "eviction-ceiling-instance-probe" };
		const middleware = createEvictionAwareFilesystemMiddleware({ model, config: {} });
		assert.deepStrictEqual(
			middleware.tools.map((tool) => tool.name),
			["read_file", "write_file", "edit_file", "delete", "glob"],
		);
	});

	it("resolves a colon-bearing identifier directly, without the provider prefix", () => {
		registerHarnessProfile(
			"anthropic:eviction-ceiling-colon-probe",
			createHarnessProfile({ excludedTools: ["execute"] }),
		);
		// `identifierHint` already carries a provider, so the lookup uses it as-is
		// rather than prefixing `providerHint` again.
		const model = {
			getName: () => "ChatAnthropic",
			model_name: "anthropic:eviction-ceiling-colon-probe",
		};
		const middleware = createEvictionAwareFilesystemMiddleware({ model, config: {} });
		assert.deepStrictEqual(
			middleware.tools.map((tool) => tool.name),
			["ls", "read_file", "write_file", "edit_file", "delete", "glob", "grep"],
		);
	});

	it("falls back to a provider-only profile when the identifier is absent", () => {
		// Mirrors deepagents' third resolution step: `getHarnessProfile(providerHint)`.
		registerHarnessProfile("google", createHarnessProfile({ excludedTools: ["execute"] }));
		const model = { getName: () => "ChatGoogleGenerativeAI" };
		const middleware = createEvictionAwareFilesystemMiddleware({ model, config: {} });
		assert.deepStrictEqual(
			middleware.tools.map((tool) => tool.name),
			["ls", "read_file", "write_file", "edit_file", "delete", "glob", "grep"],
		);
	});

	it("falls back to all tools when the model yields no profile", () => {
		const model = { getName: () => "SomeUnknownModelWrapper" };
		const middleware = createEvictionAwareFilesystemMiddleware({ model, config: {} });
		assert.strictEqual(middleware.tools.length, 8);
	});
});

describe("eviction at the derived ceiling", () => {
	const maxSize = 100000;
	const limit = deriveToolTokenLimitBeforeEvict({ image: { maxSize } });
	const ceilingChars = limit * 4;

	it("does not evict a readImage result just under image.maxSize", async () => {
		const middleware = createEvictionAwareFilesystemMiddleware({
			backend: () => new StateBackend({ state: { files: {} } }),
			config: { image: { maxSize } },
		});
		const state = { files: {} };
		const message = makeReadImageMessage(ceilingChars - 1);
		const { evicted, content } = await runWrapToolCall(middleware, message, state);

		assert.strictEqual(evicted, false);
		const parsed = JSON.parse(content);
		assert.strictEqual(parsed.ok, true);
		assert.ok(parsed.data.length > 0);
	});

	it("does not evict at exactly the ceiling", async () => {
		const middleware = createEvictionAwareFilesystemMiddleware({
			backend: () => new StateBackend({ state: { files: {} } }),
			config: { image: { maxSize } },
		});
		const state = { files: {} };
		const message = makeReadImageMessage(ceilingChars);
		assert.strictEqual(String(message.content).length, ceilingChars);
		const { evicted, content } = await runWrapToolCall(middleware, message, state);

		assert.strictEqual(evicted, false);
		assert.strictEqual(JSON.parse(content).ok, true);
	});

	it("still evicts above the ceiling rather than blowing the context window", async () => {
		const middleware = createEvictionAwareFilesystemMiddleware({
			backend: () => new StateBackend({ state: { files: {} } }),
			config: { image: { maxSize } },
		});
		const state = { files: {} };
		const message = makeReadImageMessage(ceilingChars + 1);
		const { evicted, content } = await runWrapToolCall(middleware, message, state);

		assert.strictEqual(evicted, true);
		assert.ok(content.includes("large_tool_results"), "should point at the eviction path");
		// The eviction prose is what broke ImageDispatch: it is not JSON.
		assert.throws(() => JSON.parse(content));
	});

	it("evicts at the old 80,000-char default when the ceiling is raised", async () => {
		// Regression guard for the original bug: 100,000 chars survived eviction
		// only after the ceiling became config-derived.
		const middleware = createEvictionAwareFilesystemMiddleware({
			backend: () => new StateBackend({ state: { files: {} } }),
			config: { image: { maxSize } },
		});
		const state = { files: {} };
		const message = makeReadImageMessage(100000);
		assert.ok(100000 > 20000 * 4, "payload must exceed deepagents' hardcoded 80,000-char default");
		const { evicted, content } = await runWrapToolCall(middleware, message, state);

		assert.strictEqual(evicted, false);
		assert.strictEqual(JSON.parse(content).ok, true);
	});

	it("honours a custom image.maxSize ceiling", async () => {
		const customMaxSize = 200000;
		const customLimit = deriveToolTokenLimitBeforeEvict({ image: { maxSize: customMaxSize } });
		const middleware = createEvictionAwareFilesystemMiddleware({
			backend: () => new StateBackend({ state: { files: {} } }),
			config: { image: { maxSize: customMaxSize } },
		});
		const state = { files: {} };
		// Above the default ceiling, below the custom one.
		const message = makeReadImageMessage(customLimit * 4);
		const { evicted, content } = await runWrapToolCall(middleware, message, state);

		assert.strictEqual(evicted, false);
		assert.strictEqual(JSON.parse(content).ok, true);
	});
});
