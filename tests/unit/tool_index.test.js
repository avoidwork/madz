import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";

describe("tools - buildToolConfig", () => {
	it("TOOL_PERMISSIONS contains all expected tools", async () => {
		const { TOOL_PERMISSIONS } = await import("../../src/tools/index.js");
		const expectedTools = [
			"read_file",
			"write_file",
			"patch",
			"search_files",
			"terminal",
			"process",
			"todo",
			"memory",
			"session_search",
			"clarify",
			"skill_view",
			"sampling",
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

	it("read_file requires only filesystem:read", async () => {
		const { TOOL_PERMISSIONS } = await import("../../src/tools/index.js");
		assert.deepStrictEqual(TOOL_PERMISSIONS.read_file, ["filesystem:read"]);
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

	it("returns clarify + execute_code + sampling + date with empty permissions", async () => {
		const { buildToolConfig } = await import("../../src/tools/index.js");
		const tools = await buildToolConfig({ permissions: [], maxReadSize: "1mb" });
		const toolNames = tools.map((t) => t.name);
		assert.strictEqual(toolNames.length, 4);
		assert.ok(toolNames.includes("clarify"));
		assert.ok(toolNames.includes("execute_code"));
		assert.ok(toolNames.includes("sampling"));
		assert.ok(toolNames.includes("date"));
	});

	it("returns clarify + filesystem tools when filesystem:read and filesystem:write enabled", async () => {
		const { buildToolConfig } = await import("../../src/tools/index.js");
		const tools = await buildToolConfig({
			permissions: ["filesystem:read", "filesystem:write"],
			maxReadSize: "1mb",
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(toolNames.includes("clarify"), "clarify should always register");
		assert.ok(toolNames.includes("execute_code"), "execute_code should always register");
		assert.ok(toolNames.includes("read_file"), "read_file should register with filesystem:read");
		assert.ok(toolNames.includes("write_file"), "write_file should register with filesystem:write");
		assert.ok(toolNames.includes("patch"), "patch should register with filesystem:write");
		assert.ok(
			toolNames.includes("todo"),
			"todo should register with filesystem:read + filesystem:write",
		);
		assert.ok(toolNames.includes("memory"), "memory should register");
		assert.ok(toolNames.includes("skill_view"), "skill_view should register");
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
		// Tier 1: 12 tools (all register with filesystem+process perms)
		// Tier 2: execute_code (no perms), cronjob (network:outbound)
		// Sampling (no perms) always registers
		// No API keys: web_search/vision_analyze/image_generate won't register
		assert.ok(toolNames.length >= 13, "All tier 1 + tier 2 + sampling tools should register");
		assert.ok(toolNames.includes("terminal"), "terminal should register");
		assert.ok(toolNames.includes("process"), "process should register");
		assert.ok(toolNames.includes("execute_code"), "execute_code should register");
		assert.ok(toolNames.includes("cronjob"), "cronjob should register");
	});

	it("returns only clarify with filesystem:read-only", async () => {
		const { buildToolConfig } = await import("../../src/tools/index.js");
		const tools = await buildToolConfig({
			permissions: ["filesystem:read"],
			maxReadSize: "1mb",
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(toolNames.includes("clarify"));
		assert.ok(toolNames.includes("read_file"));
		assert.ok(toolNames.includes("search_files"));
		assert.ok(toolNames.includes("session_search"));
		assert.ok(toolNames.includes("skill_view"));
		// write-only tools should NOT register
		assert.ok(!toolNames.includes("write_file"), "write_file should NOT register with only read");
	});

	it("handles maxReadSize in config", async () => {
		const { buildToolConfig } = await import("../../src/tools/index.js");
		const tools = await buildToolConfig({
			permissions: [],
			maxReadSize: "2mb",
		});
		const toolNames = tools.map((t) => t.name);
		assert.strictEqual(toolNames.length, 4);
		assert.ok(toolNames.includes("clarify"));
		assert.ok(toolNames.includes("execute_code"));
		assert.ok(toolNames.includes("sampling"));
		assert.ok(toolNames.includes("date"));
	});
});
