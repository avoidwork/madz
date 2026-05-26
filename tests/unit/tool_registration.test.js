import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { buildToolConfig } from "../../src/tools/index.js";

describe("tool registration - integration", () => {
	let _origPermissions, origEnvVars;

	before(() => {
		_origPermissions = process.env.SANDBOX_PERMISSIONS;
		origEnvVars = {
			OPENAI_API_KEY: process.env.OPENAI_API_KEY,
			EXA_API_KEY: process.env.EXA_API_KEY,
			FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
			TAVILY_API_KEY: process.env.TAVILY_API_KEY,
			PARALLEL_API_KEY: process.env.PARALLEL_API_KEY,
			FAL_API_KEY: process.env.FAL_API_KEY,
			OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
		};
	});

	after(() => {
		process.env.OPENAI_API_KEY = origEnvVars.OPENAI_API_KEY;
		process.env.EXA_API_KEY = origEnvVars.EXA_API_KEY;
		process.env.FIRECRAWL_API_KEY = origEnvVars.FIRECRAWL_API_KEY;
		process.env.TAVILY_API_KEY = origEnvVars.TAVILY_API_KEY;
		process.env.PARALLEL_API_KEY = origEnvVars.PARALLEL_API_KEY;
		process.env.FAL_API_KEY = origEnvVars.FAL_API_KEY;
		process.env.OPENROUTER_API_KEY = origEnvVars.OPENROUTER_API_KEY;
	});

	it("registers clarifying (no permissions) andTier 1 tools with permissions", async () => {
		const tools = await buildToolConfig({ permissions: ["filesystem:read", "filesystem:write"] });
		const toolNames = tools.map((t) => t.name);
		assert.ok(toolNames.includes("clarify")); // Always registered
		assert.ok(toolNames.includes("read_file"));
		assert.ok(!toolNames.includes("web_search")); // needs network:outbound
		assert.ok(!toolNames.includes("vision_analyze")); // needs OPENAI_API_KEY
	});

	it("registers web tools when network:outbound and search key set", async () => {
		process.env.EXA_API_KEY = "sk-test-exa";
		const tools = await buildToolConfig({
			permissions: [
				"network:outbound",
				"filesystem:read",
				"filesystem:write",
				"filesystem:exec",
				"process:spawn",
			],
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(toolNames.includes("web_search"));
		assert.ok(toolNames.includes("web_extract"));
		delete process.env.EXA_API_KEY;
	});

	it("does not register web tools without search key", async () => {
		delete process.env.EXA_API_KEY;
		delete process.env.FIRECRAWL_API_KEY;
		delete process.env.TAVILY_API_KEY;
		delete process.env.PARALLEL_API_KEY;
		const tools = await buildToolConfig({
			permissions: ["network:outbound"],
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(!toolNames.includes("web_search"));
		assert.ok(!toolNames.includes("web_extract"));
	});

	it("registers execute_code without permissions (sandboxed)", async () => {
		const tools = await buildToolConfig({ permissions: [] });
		const toolNames = tools.map((t) => t.name);
		assert.ok(toolNames.includes("execute_code"));
	});

	it("registers vision_analyze with OPENAI_API_KEY (no permission needed)", async () => {
		process.env.OPENAI_API_KEY = "sk-test-openai";
		delete process.env.EXA_API_KEY;
		delete process.env.FIRECRAWL_API_KEY;
		delete process.env.TAVILY_API_KEY;
		delete process.env.PARALLEL_API_KEY;
		const tools = await buildToolConfig({ permissions: [] });
		const toolNames = tools.map((t) => t.name);
		assert.ok(toolNames.includes("vision_analyze"));
		delete process.env.OPENAI_API_KEY;
	});

	it("does not register vision_analyze without OPENAI_API_KEY", async () => {
		delete process.env.OPENAI_API_KEY;
		const tools = await buildToolConfig({ permissions: [] });
		const toolNames = tools.map((t) => t.name);
		assert.ok(!toolNames.includes("vision_analyze"));
	});

	it("registers image_generate with network:outbound and FAL_API_KEY", async () => {
		process.env.FAL_API_KEY = "sk-fake-fal";
		const tools = await buildToolConfig({
			permissions: ["network:outbound"],
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(toolNames.includes("image_generate"));
		delete process.env.FAL_API_KEY;
	});

	it("does not register image_generate without FAL_API_KEY", async () => {
		delete process.env.FAL_API_KEY;
		const tools = await buildToolConfig({
			permissions: ["network:outbound"],
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(!toolNames.includes("image_generate"));
	});

	it("registers cronjob with network:outbound", async () => {
		const tools = await buildToolConfig({
			permissions: ["network:outbound"],
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(toolNames.includes("cronjob"));
	});

	it("does not register cronjob without network:outbound", async () => {
		const tools = await buildToolConfig({ permissions: [] });
		const toolNames = tools.map((t) => t.name);
		assert.ok(!toolNames.includes("cronjob"));
	});

	it("registers text_to_speech with OPENAI_API_KEY (no permission needed)", async () => {
		process.env.OPENAI_API_KEY = "sk-test-openai";
		delete process.env.EXA_API_KEY;
		delete process.env.FIRECRAWL_API_KEY;
		delete process.env.TAVILY_API_KEY;
		delete process.env.PARALLEL_API_KEY;
		const tools = await buildToolConfig({ permissions: [] });
		const toolNames = tools.map((t) => t.name);
		assert.ok(toolNames.includes("text_to_speech"));
		delete process.env.OPENAI_API_KEY;
	});

	it("does not register text_to_speech without OPENAI_API_KEY", async () => {
		delete process.env.OPENAI_API_KEY;
		const tools = await buildToolConfig({ permissions: [] });
		const toolNames = tools.map((t) => t.name);
		assert.ok(!toolNames.includes("text_to_speech"));
	});

	it("registers mixture_of_agents with OPENROUTER_API_KEY (no permission needed)", async () => {
		process.env.OPENROUTER_API_KEY = "sk-test-or";
		delete process.env.EXA_API_KEY;
		delete process.env.FIRECRAWL_API_KEY;
		delete process.env.TAVILY_API_KEY;
		delete process.env.PARALLEL_API_KEY;
		const tools = await buildToolConfig({ permissions: [] });
		const toolNames = tools.map((t) => t.name);
		assert.ok(toolNames.includes("mixture_of_agents"));
		delete process.env.OPENROUTER_API_KEY;
	});

	it("does not register mixture_of_agents without OPENROUTER_API_KEY", async () => {
		delete process.env.OPENROUTER_API_KEY;
		const tools = await buildToolConfig({ permissions: [] });
		const toolNames = tools.map((t) => t.name);
		assert.ok(!toolNames.includes("mixture_of_agents"));
	});
});
