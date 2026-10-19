/**
 * Subagent inheritance tests for the config-driven eviction ceiling.
 *
 * deepagents merges the orchestrator's custom middleware into the auto-injected
 * `general-purpose` subagent only. The 12 configured subagents receive just each
 * spec's own `middleware` array, so the replacement must be attached to every
 * definition we generate — otherwise they keep the library's 20,000-token
 * eviction default and destroy `readImage` results before ImageDispatch runs.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { ToolMessage } from "@langchain/core/messages";
import { SkillRegistry } from "../../src/skills/registry.js";
import { createSubagentDefinitions } from "../../src/agent/deepAgents.js";
import { deriveToolTokenLimitBeforeEvict } from "../../src/agent/evictionCeiling.js";

const EXPECTED_AGENT_NAMES = [
	"coding",
	"search",
	"debug",
	"code-review",
	"research",
	"testing",
	"documentation",
	"security-audit",
	"performance",
	"textEditor",
	"seoAnalyst",
	"translator",
];

/**
 * Build a `readImage`-shaped ToolMessage of an exact stringified length.
 * @param {number} totalLength - Desired stringified content length
 * @returns {ToolMessage} The tool message
 */
function makeReadImageMessage(totalLength) {
	const envelope = JSON.stringify({ ok: true, mimeType: "image/png", data: "" });
	const content = JSON.stringify({
		ok: true,
		mimeType: "image/png",
		data: "A".repeat(Math.max(0, totalLength - envelope.length)),
	});
	return new ToolMessage({ content, name: "readImage", tool_call_id: "call_1", id: "msg_1" });
}

/**
 * Drive a middleware's `wrapToolCall` around one tool result.
 * @param {Object} middleware - The filesystem middleware
 * @param {ToolMessage} message - The tool result
 * @returns {Promise<{ evicted: boolean, content: string }>} Eviction outcome
 */
async function runWrapToolCall(middleware, message) {
	const state = { files: {} };
	const request = {
		toolCall: { name: message.name, id: message.tool_call_id },
		runtime: { state },
		state,
	};
	const result = await middleware.wrapToolCall(request, async () => message);
	const out = result?.update?.messages?.[0] ?? result;
	return { evicted: Boolean(result?.update?.files), content: String(out.content) };
}

describe("createSubagentDefinitions eviction middleware", () => {
	const config = {
		providers: { openai: {} },
		subAgentsTemperature: {},
	};

	it("attaches a FilesystemMiddleware replacement to every subagent definition", async () => {
		const definitions = await createSubagentDefinitions([], {}, new SkillRegistry(), config);

		assert.deepStrictEqual(
			definitions.map((def) => def.name),
			EXPECTED_AGENT_NAMES,
		);

		for (const def of definitions) {
			assert.ok(Array.isArray(def.middleware), `subagent "${def.name}" needs a middleware array`);
			const fsMiddleware = def.middleware.filter((m) => m.name === "FilesystemMiddleware");
			assert.strictEqual(
				fsMiddleware.length,
				1,
				`subagent "${def.name}" must carry exactly one FilesystemMiddleware replacement`,
			);
		}
	});

	it("builds each subagent's replacement with the fixed ceiling", async () => {
		const definitions = await createSubagentDefinitions([], {}, new SkillRegistry(), config);
		const ceilingChars = deriveToolTokenLimitBeforeEvict() * 4;

		for (const def of definitions) {
			const middleware = def.middleware.find((m) => m.name === "FilesystemMiddleware");
			const state = { files: {} };
			const message = makeReadImageMessage(ceilingChars);
			const request = {
				toolCall: { name: message.name, id: message.tool_call_id },
				runtime: { state },
				state,
			};
			const result = await middleware.wrapToolCall(request, async () => message);

			// Under the library's 20,000 default this payload (100,128 chars) would
			// have been evicted; surviving proves the ceiling is raised.
			assert.ok(
				ceilingChars > 20000 * 4,
				"payload must exceed deepagents' hardcoded default to be meaningful",
			);
			assert.ok(!result?.update?.files, `subagent "${def.name}" must not evict at the ceiling`);
		}
	});

	it("still evicts above the ceiling in a subagent", async () => {
		const definitions = await createSubagentDefinitions([], {}, new SkillRegistry(), config);
		const ceilingChars = deriveToolTokenLimitBeforeEvict() * 4;
		const middleware = definitions[0].middleware.find((m) => m.name === "FilesystemMiddleware");
		const { evicted, content } = await runWrapToolCall(
			middleware,
			makeReadImageMessage(ceilingChars + 1),
		);

		assert.strictEqual(evicted, true);
		assert.ok(content.includes("large_tool_results"));
	});

	it("defaults the backend to the library StateBackend when none is passed", async () => {
		// Existing callers pass four arguments; the fifth must stay optional.
		const definitions = await createSubagentDefinitions([], {}, new SkillRegistry(), config);
		const middleware = definitions[0].middleware.find((m) => m.name === "FilesystemMiddleware");
		const state = { files: {} };
		const message = makeReadImageMessage(deriveToolTokenLimitBeforeEvict() * 4 + 1);
		const request = {
			toolCall: { name: message.name, id: message.tool_call_id },
			runtime: { state },
			state,
		};
		const result = await middleware.wrapToolCall(request, async () => message);

		// Eviction writes land in the StateBackend's `files` state slice.
		assert.ok(result?.update?.files, "StateBackend default must still evict");
	});
});
