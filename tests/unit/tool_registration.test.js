import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import { buildToolConfig } from "../../src/tools/index.js";

describe("tool registration - integration", () => {
	let _origEnvVars;

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

	before(() => {
		_origEnvVars = {
			OPENAI_API_KEY: process.env.OPENAI_API_KEY,
			OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
			EXA_API_KEY: process.env.EXA_API_KEY,
			FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
			TAVILY_API_KEY: process.env.TAVILY_API_KEY,
			PARALLEL_API_KEY: process.env.PARALLEL_API_KEY,
			SEARXNG_URL: process.env.SEARXNG_URL,
			BING_API_KEY: process.env.BING_API_KEY,
			CUSTOM_SEARCH_URL: process.env.CUSTOM_SEARCH_URL,
			FAL_API_KEY: process.env.FAL_API_KEY,
		};
	});

	after(() => {
		process.env.OPENAI_API_KEY = _origEnvVars.OPENAI_API_KEY;
		process.env.OPENROUTER_API_KEY = _origEnvVars.OPENROUTER_API_KEY;
		process.env.EXA_API_KEY = _origEnvVars.EXA_API_KEY;
		process.env.FIRECRAWL_API_KEY = _origEnvVars.FIRECRAWL_API_KEY;
		process.env.TAVILY_API_KEY = _origEnvVars.TAVILY_API_KEY;
		process.env.PARALLEL_API_KEY = _origEnvVars.PARALLEL_API_KEY;
		process.env.SEARXNG_URL = _origEnvVars.SEARXNG_URL;
		process.env.BING_API_KEY = _origEnvVars.BING_API_KEY;
		process.env.CUSTOM_SEARCH_URL = _origEnvVars.CUSTOM_SEARCH_URL;
		process.env.FAL_API_KEY = _origEnvVars.FAL_API_KEY;
	});
	it("registers clarifying (no permissions) and tier 1 tools with permissions", async () => {
		const tools = await buildToolConfig({
			permissions: ["filesystem:read", "filesystem:write"],
			config: {
				providers: {},
				search: {},
			},
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(toolNames.includes("clarify")); // Always registered
		assert.ok(toolNames.includes("read_file"));
		assert.ok(!toolNames.includes("web_search")); // needs network:outbound
		assert.ok(!toolNames.includes("vision_analyze")); // no openai config key, env var cleaned up
	});

	it("registers web tools when network:outbound and search key set", async () => {
		const tools = await buildToolConfig({
			permissions: [
				"network:outbound",
				"filesystem:read",
				"filesystem:write",
				"filesystem:exec",
				"process:spawn",
			],
			config: {
				providers: { openai: { credentials: { apiKey: "sk-test-openai" } } },
				search: { exa: { apiKey: "sk-test-exa" } },
			},
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(toolNames.includes("web_search"));
		assert.ok(toolNames.includes("web_extract"));
	});

	it("registers web tools when searxng is configured", async () => {
		const tools = await buildToolConfig({
			permissions: ["network:outbound"],
			config: {
				providers: {},
				search: { searxng: { url: "http://searxng.local" } },
			},
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(toolNames.includes("web_search"));
		assert.ok(toolNames.includes("web_extract"));
	});

	it("registers web tools when bing is configured", async () => {
		const tools = await buildToolConfig({
			permissions: ["network:outbound"],
			config: {
				providers: {},
				search: { bing: { apiKey: "sk-bing" } },
			},
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(toolNames.includes("web_search"));
		assert.ok(toolNames.includes("web_extract"));
	});

	it("registers web tools when custom search is configured", async () => {
		const tools = await buildToolConfig({
			permissions: ["network:outbound"],
			config: {
				providers: {},
				search: { custom: { url: "http://custom.local/search", apiKey: "sk-test-custom" } },
			},
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(toolNames.includes("web_search"));
		assert.ok(toolNames.includes("web_extract"));
	});

	it("does not register web tools without any search key", async () => {
		const tools = await buildToolConfig({
			permissions: ["network:outbound"],
			config: { providers: {}, search: {} },
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

	it("registers vision_analyze with openai (no permission needed)", async () => {
		const tools = await buildToolConfig({
			permissions: [],
			config: {
				providers: { openai: { credentials: { apiKey: "sk-test-openai" } } },
				search: { exa: {} },
			},
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(toolNames.includes("vision_analyze"));
	});

	it("does not register vision_analyze without openai", async () => {
		const tools = await buildToolConfig({
			permissions: [],
			config: {
				providers: { openai: {} },
				search: { exa: {} },
			},
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(!toolNames.includes("vision_analyze"));
	});

	it("registers image_generate with network:outbound and fal", async () => {
		const tools = await buildToolConfig({
			permissions: ["network:outbound"],
			config: {
				providers: { fal: { credentials: { apiKey: "sk-fake-fal" } } },
				search: { exa: {} },
			},
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(toolNames.includes("image_generate"));
	});

	it("does not register image_generate without fal", async () => {
		const tools = await buildToolConfig({
			permissions: ["network:outbound"],
			config: { providers: { fal: {} }, search: { exa: {} } },
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(!toolNames.includes("image_generate"));
	});

	it("registers cronjob with network:outbound", async () => {
		const tools = await buildToolConfig({
			permissions: ["network:outbound"],
			config: { providers: {}, search: { exa: {} } },
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(toolNames.includes("cronjob"));
	});

	it("does not register cronjob without network:outbound", async () => {
		const tools = await buildToolConfig({
			permissions: [],
			config: { providers: {}, search: { exa: {} } },
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(!toolNames.includes("cronjob"));
	});

	it("registers text_to_speech with openai (no permission needed)", async () => {
		const tools = await buildToolConfig({
			permissions: [],
			config: {
				providers: { openai: { credentials: { apiKey: "sk-test-openai" } } },
				search: { exa: {} },
			},
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(toolNames.includes("text_to_speech"));
	});

	it("does not register text_to_speech without openai", async () => {
		const tools = await buildToolConfig({
			permissions: [],
			config: {
				providers: { openai: {} },
				search: { exa: {} },
			},
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(!toolNames.includes("text_to_speech"));
	});

	it("registers mixture_of_agents with openrouter (no permission needed)", async () => {
		const tools = await buildToolConfig({
			permissions: [],
			config: {
				providers: { openrouter: { credentials: { apiKey: "sk-test-or" } } },
				search: { exa: {} },
			},
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(toolNames.includes("mixture_of_agents"));
	});

	it("does not register mixture_of_agents without openrouter", async () => {
		const tools = await buildToolConfig({
			permissions: [],
			config: {
				providers: { openrouter: {} },
				search: { exa: {} },
			},
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(!toolNames.includes("mixture_of_agents"));
	});
});
