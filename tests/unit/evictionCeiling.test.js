/**
 * Tests for the tool-result eviction ceiling.
 *
 * Guards three things:
 * 1. The replacement middleware carries the exact name deepagents'
 *    `mergeMiddlewareStack` keys on — otherwise a second FilesystemMiddleware
 *    stacks instead of displacing and the bug survives while looking fixed.
 * 2. The ceiling is a fixed image budget plus envelope headroom and can never
 *    be 0/undefined.
 * 3. Eviction actually stops at the ceiling and still fires above it.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { ToolMessage } from "@langchain/core/messages";
import { StateBackend, registerHarnessProfile, createHarnessProfile } from "deepagents";
import {
	deriveToolTokenLimitBeforeEvict,
	createEvictionAwareFilesystemMiddleware,
	ENVELOPE_HEADROOM,
	IMAGE_EVICTION_BUDGET_CHARS,
} from "../../src/agent/evictionCeiling.js";

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
	it("derives from the fixed image budget as characters", () => {
		const limit = deriveToolTokenLimitBeforeEvict();
		assert.strictEqual(limit, Math.ceil((IMAGE_EVICTION_BUDGET_CHARS + ENVELOPE_HEADROOM) / 4));
	});

	it("is a positive integer well above deepagents' 20,000-token default", () => {
		const limit = deriveToolTokenLimitBeforeEvict();
		assert.ok(Number.isInteger(limit));
		assert.ok(limit > 20000);
	});
});

describe("createEvictionAwareFilesystemMiddleware", () => {
	it("is named exactly FilesystemMiddleware so the same-name merge displaces the default", () => {
		const middleware = createEvictionAwareFilesystemMiddleware({});
		assert.strictEqual(middleware.name, "FilesystemMiddleware");
	});

	it("supplies no filesystem tools — madz owns file I/O via the file tool", () => {
		const middleware = createEvictionAwareFilesystemMiddleware({});
		assert.deepStrictEqual(middleware.tools, []);
	});

	it("does not expose the library's eight filesystem tools", () => {
		const middleware = createEvictionAwareFilesystemMiddleware({});
		const names = middleware.tools.map((tool) => tool.name);
		assert.ok(!names.includes("ls"));
		assert.ok(!names.includes("read_file"));
		assert.ok(!names.includes("write_file"));
		assert.ok(!names.includes("edit_file"));
		assert.ok(!names.includes("delete"));
		assert.ok(!names.includes("glob"));
		assert.ok(!names.includes("grep"));
		assert.ok(!names.includes("execute"));
	});

	it("keeps the name FilesystemMiddleware regardless of model profile", () => {
		registerHarnessProfile(
			"openai:eviction-ceiling-probe",
			createHarnessProfile({ excludedTools: ["execute", "grep", "ls"] }),
		);
		const middleware = createEvictionAwareFilesystemMiddleware({
			model: "openai:eviction-ceiling-probe",
		});
		assert.strictEqual(middleware.name, "FilesystemMiddleware");
		assert.deepStrictEqual(middleware.tools, []);
	});

	it("supplies no filesystem tools for a model instance", () => {
		registerHarnessProfile(
			"openai:eviction-ceiling-instance-probe",
			createHarnessProfile({ excludedTools: ["execute", "grep", "ls"] }),
		);
		const model = { getName: () => "ChatOpenAI", model_name: "eviction-ceiling-instance-probe" };
		const middleware = createEvictionAwareFilesystemMiddleware({ model });
		assert.strictEqual(middleware.name, "FilesystemMiddleware");
		assert.deepStrictEqual(middleware.tools, []);
	});

	it("supplies no filesystem tools for a colon-bearing identifier", () => {
		registerHarnessProfile(
			"anthropic:eviction-ceiling-colon-probe",
			createHarnessProfile({ excludedTools: ["execute"] }),
		);
		const model = {
			getName: () => "ChatAnthropic",
			model_name: "anthropic:eviction-ceiling-colon-probe",
		};
		const middleware = createEvictionAwareFilesystemMiddleware({ model });
		assert.strictEqual(middleware.name, "FilesystemMiddleware");
		assert.deepStrictEqual(middleware.tools, []);
	});

	it("supplies no filesystem tools for a provider-only profile", () => {
		registerHarnessProfile("google", createHarnessProfile({ excludedTools: ["execute"] }));
		const model = { getName: () => "ChatGoogleGenerativeAI" };
		const middleware = createEvictionAwareFilesystemMiddleware({ model });
		assert.strictEqual(middleware.name, "FilesystemMiddleware");
		assert.deepStrictEqual(middleware.tools, []);
	});

	it("supplies no filesystem tools when the model yields no profile", () => {
		const model = { getName: () => "SomeUnknownModelWrapper" };
		const middleware = createEvictionAwareFilesystemMiddleware({ model });
		assert.strictEqual(middleware.name, "FilesystemMiddleware");
		assert.deepStrictEqual(middleware.tools, []);
	});
});

describe("eviction at the ceiling", () => {
	const ceilingChars = deriveToolTokenLimitBeforeEvict() * 4;
	const makeMiddleware = () =>
		createEvictionAwareFilesystemMiddleware({
			backend: () => new StateBackend({ state: { files: {} } }),
		});

	it("does not evict a readImage result just under the ceiling", async () => {
		const state = { files: {} };
		const message = makeReadImageMessage(ceilingChars - 1);
		const { evicted, content } = await runWrapToolCall(makeMiddleware(), message, state);

		assert.strictEqual(evicted, false);
		const parsed = JSON.parse(content);
		assert.strictEqual(parsed.ok, true);
		assert.ok(parsed.data.length > 0);
	});

	it("does not evict at exactly the ceiling", async () => {
		const state = { files: {} };
		const message = makeReadImageMessage(ceilingChars);
		assert.strictEqual(String(message.content).length, ceilingChars);
		const { evicted, content } = await runWrapToolCall(makeMiddleware(), message, state);

		assert.strictEqual(evicted, false);
		assert.strictEqual(JSON.parse(content).ok, true);
	});

	it("still evicts above the ceiling rather than blowing the context window", async () => {
		const state = { files: {} };
		const message = makeReadImageMessage(ceilingChars + 1);
		const { evicted, content } = await runWrapToolCall(makeMiddleware(), message, state);

		assert.strictEqual(evicted, true);
		assert.ok(content.includes("large_tool_results"), "should point at the eviction path");
	});

	it("does not evict a payload above deepagents' 80,000-char default", async () => {
		const state = { files: {} };
		const message = makeReadImageMessage(100000);
		assert.ok(100000 > 20000 * 4, "payload must exceed deepagents' hardcoded 80,000-char default");
		const { evicted } = await runWrapToolCall(makeMiddleware(), message, state);

		assert.strictEqual(evicted, false);
	});
});
