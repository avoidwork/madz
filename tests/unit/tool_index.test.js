import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";

describe("tools - buildToolConfig", () => {
	it("TOOL_PERMISSIONS contains all expected tools", async () => {
		const { TOOL_PERMISSIONS } = await import("../../src/tools/index.js");
		const expectedTools = [
			"terminal",
			"process",
			"todo",
			"sessionSearch",
			"clarify",
			"webSearch",
			"webExtract",
			"visionAnalyze",
			"imageGenerate",
			"executeCode",
			"cronJob",
			"textToSpeech",
			"mixtureOfAgents",
			"sampling",
			"date",
			"scanAgents",
		];
		for (const tool of expectedTools) {
			assert.ok(TOOL_PERMISSIONS[tool], `Expected TOOL_PERMISSIONS to have ${tool}`);
		}
	});

	it("clarify has zero permission requirement", async () => {
		const { TOOL_PERMISSIONS } = await import("../../src/tools/index.js");
		assert.deepStrictEqual(TOOL_PERMISSIONS.clarify, []);
	});

	it("sampling has zero permission requirement", async () => {
		const { TOOL_PERMISSIONS } = await import("../../src/tools/index.js");
		assert.deepStrictEqual(TOOL_PERMISSIONS.sampling, []);
	});

	it("terminal requires both filesystem:exec and process:spawn", async () => {
		const { TOOL_PERMISSIONS } = await import("../../src/tools/index.js");
		assert.deepStrictEqual(TOOL_PERMISSIONS.terminal, ["filesystem:exec", "process:spawn"]);
	});

	it("all tools have permission arrays", async () => {
		const { TOOL_PERMISSIONS } = await import("../../src/tools/index.js");
		for (const [name, perms] of Object.entries(TOOL_PERMISSIONS)) {
			assert.ok(Array.isArray(perms), `${name} permissions should be an array`);
		}
	});
});

describe("tools - buildToolConfig", () => {
	beforeEach(() => {
		delete process.env.OPENAI_API_KEY;
		delete process.env.OPENROUTER_API_KEY;
		delete process.env.FAL_API_KEY;
		delete process.env.EXA_API_KEY;
		delete process.env.FIRECRAWL_API_KEY;
		delete process.env.TAVILY_API_KEY;
		delete process.env.PARALLEL_API_KEY;
		delete process.env.SEARXNG_URL;
		delete process.env.BING_API_KEY;
		delete process.env.CUSTOM_SEARCH_URL;
	});

	afterEach(() => {
		delete process.env.OPENAI_API_KEY;
		delete process.env.OPENROUTER_API_KEY;
		delete process.env.FAL_API_KEY;
		delete process.env.EXA_API_KEY;
		delete process.env.FIRECRAWL_API_KEY;
		delete process.env.TAVILY_API_KEY;
		delete process.env.PARALLEL_API_KEY;
		delete process.env.SEARXNG_URL;
		delete process.env.BING_API_KEY;
		delete process.env.CUSTOM_SEARCH_URL;
	});

	it("returns clarify + executeCode + sampling + date + scanAgents with empty permissions", async () => {
		const { buildToolConfig } = await import("../../src/tools/index.js");
		const tools = await buildToolConfig({ permissions: [], maxReadSize: "1mb" });
		const toolNames = tools.map((t) => t.name);
		assert.strictEqual(toolNames.length, 5);
		assert.ok(toolNames.includes("clarify"));
		assert.ok(toolNames.includes("executeCode"));
		assert.ok(toolNames.includes("sampling"));
		assert.ok(toolNames.includes("date"));
		assert.ok(toolNames.includes("scanAgents"));
	});

	it("returns clarify + filesystem tools when filesystem:read and filesystem:write enabled", async () => {
		const { buildToolConfig } = await import("../../src/tools/index.js");
		const tools = await buildToolConfig({
			permissions: ["filesystem:read", "filesystem:write"],
			maxReadSize: "1mb",
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(toolNames.includes("clarify"), "clarify should always register");
		assert.ok(toolNames.includes("executeCode"), "execute_code should always register");
		assert.ok(
			toolNames.includes("todo"),
			"todo should register with filesystem:read + filesystem:write",
		);
		assert.ok(
			toolNames.includes("sessionSearch"),
			"sessionSearch should register with filesystem:read",
		);
		assert.ok(toolNames.includes("sampling"), "sampling should register (no perms needed)");
		// terminal requires process:spawn which is not enabled
		assert.ok(
			!toolNames.includes("terminal"),
			"terminal should NOT register without process:spawn",
		);
		assert.ok(!toolNames.includes("process"), "process should NOT register without process:spawn");
	});

	it("returns all tier 1 + tier 2 tools when all permissions enabled", async () => {
		const { buildToolConfig } = await import("../../src/tools/index.js");
		const tools = await buildToolConfig({
			permissions: [
				"filesystem:read",
				"filesystem:write",
				"filesystem:exec",
				"process:spawn",
				"network:outbound",
			],
			maxReadSize: "1mb",
		});
		const toolNames = tools.map((t) => t.name);
		// Tier 1: 6 tools (terminal, process, todo, sessionSearch, clarify, scanAgents)
		// Tier 2: executeCode, cronJob, sampling, date (no perms or network:outbound)
		// No API keys: webSearch/webExtract/visionAnalyze/imageGenerate/textToSpeech/mixtureOfAgents won't register
		assert.ok(toolNames.length >= 10, "All tier 1 + tier 2 tools should register");
		assert.ok(toolNames.includes("terminal"), "terminal should register");
		assert.ok(toolNames.includes("process"), "process should register");
		assert.ok(toolNames.includes("executeCode"), "execute_code should register");
		assert.ok(toolNames.includes("cronJob"), "cronJob should register");
	});

	it("returns clarify and sessionSearch with filesystem:read-only", async () => {
		const { buildToolConfig } = await import("../../src/tools/index.js");
		const tools = await buildToolConfig({
			permissions: ["filesystem:read"],
			maxReadSize: "1mb",
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(toolNames.includes("clarify"));
		assert.ok(toolNames.includes("sessionSearch"));
		// tools requiring write permissions should NOT register
		assert.ok(!toolNames.includes("todo"), "todo should NOT register with only read");
	});

	it("handles maxReadSize in config", async () => {
		const { buildToolConfig } = await import("../../src/tools/index.js");
		const tools = await buildToolConfig({
			permissions: [],
			maxReadSize: "2mb",
		});
		const toolNames = tools.map((t) => t.name);
		assert.strictEqual(toolNames.length, 5);
		assert.ok(toolNames.includes("clarify"));
		assert.ok(toolNames.includes("executeCode"));
		assert.ok(toolNames.includes("sampling"));
		assert.ok(toolNames.includes("date"));
		assert.ok(toolNames.includes("scanAgents"));
	});
});
