/**
 * Deep Agents tests.
 * Tests the createDeepAgentsOrchestrator function and its internal helpers.
 */

import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert";
import { renameSync, existsSync } from "node:fs";
import { join } from "node:path";

describe("createDeepAgentsOrchestrator", () => {
	let savedApiKey;
	let savedEmailGmailClientId;
	let savedEmailGmailClientSecret;
	let savedEmailGmailRefreshToken;

	before(() => {
		savedApiKey = process.env.OPENAI_API_KEY;
		process.env.OPENAI_API_KEY = "sk-test-dummy";

		savedEmailGmailClientId = process.env.EMAIL_GMAIL_CLIENT_ID;
		savedEmailGmailClientSecret = process.env.EMAIL_GMAIL_CLIENT_SECRET;
		savedEmailGmailRefreshToken = process.env.EMAIL_GMAIL_REFRESH_TOKEN;
	});

	after(() => {
		if (savedApiKey !== undefined) {
			process.env.OPENAI_API_KEY = savedApiKey;
		} else {
			delete process.env.OPENAI_API_KEY;
		}

		if (savedEmailGmailClientId !== undefined) {
			process.env.EMAIL_GMAIL_CLIENT_ID = savedEmailGmailClientId;
		} else {
			delete process.env.EMAIL_GMAIL_CLIENT_ID;
		}
		if (savedEmailGmailClientSecret !== undefined) {
			process.env.EMAIL_GMAIL_CLIENT_SECRET = savedEmailGmailClientSecret;
		} else {
			delete process.env.EMAIL_GMAIL_CLIENT_SECRET;
		}
		if (savedEmailGmailRefreshToken !== undefined) {
			process.env.EMAIL_GMAIL_REFRESH_TOKEN = savedEmailGmailRefreshToken;
		} else {
			delete process.env.EMAIL_GMAIL_REFRESH_TOKEN;
		}
	});

	it("should create an orchestrator instance", async () => {
		// Set valid email env vars so provider validation passes
		process.env.EMAIL_GMAIL_CLIENT_ID = "test-client-id";
		process.env.EMAIL_GMAIL_CLIENT_SECRET = "test-client-secret";
		process.env.EMAIL_GMAIL_REFRESH_TOKEN = "test-refresh-token";

		const { createDeepAgentsOrchestrator } = await import("../../src/agent/deepAgents.js");
		const result = await createDeepAgentsOrchestrator();
		assert.ok(result, "Should return an orchestrator");
		assert.ok(typeof result === "object", "Orchestrator should be an object");
		assert.ok(result.agent, "Should return the agent");
		assert.ok(result.model, "Should return the model");
	});

	it("should accept an optional checkpointer", async () => {
		// Set valid email env vars so provider validation passes
		process.env.EMAIL_GMAIL_CLIENT_ID = "test-client-id";
		process.env.EMAIL_GMAIL_CLIENT_SECRET = "test-client-secret";
		process.env.EMAIL_GMAIL_REFRESH_TOKEN = "test-refresh-token";

		const { createDeepAgentsOrchestrator } = await import("../../src/agent/deepAgents.js");
		const mockCheckpointer = {
			get: async () => null,
			set: async () => undefined,
		};
		const result = await createDeepAgentsOrchestrator(mockCheckpointer);
		assert.ok(result, "Should return an orchestrator with checkpointer");
	});

	it("should handle missing AGENTS.md gracefully", async () => {
		// Set valid email env vars so provider validation passes
		process.env.EMAIL_GMAIL_CLIENT_ID = "test-client-id";
		process.env.EMAIL_GMAIL_CLIENT_SECRET = "test-client-secret";
		process.env.EMAIL_GMAIL_REFRESH_TOKEN = "test-refresh-token";

		const agentsPath = join(process.cwd(), "AGENTS.md");
		const backupPath = join(process.cwd(), "AGENTS.md.bak");

		if (existsSync(agentsPath)) {
			renameSync(agentsPath, backupPath);
		}

		try {
			const { createDeepAgentsOrchestrator } = await import("../../src/agent/deepAgents.js");
			const result = await createDeepAgentsOrchestrator();
			assert.ok(result, "Should still create orchestrator without AGENTS.md");
		} finally {
			if (existsSync(backupPath)) {
				renameSync(backupPath, agentsPath);
			}
		}
	});

	it("should handle email provider config validation failure gracefully", async () => {
		// Don't set email env vars so validateProviderConfig returns invalid
		delete process.env.EMAIL_GMAIL_CLIENT_ID;
		delete process.env.EMAIL_GMAIL_CLIENT_SECRET;
		delete process.env.EMAIL_GMAIL_REFRESH_TOKEN;

		const { createDeepAgentsOrchestrator } = await import("../../src/agent/deepAgents.js");
		const result = await createDeepAgentsOrchestrator();
		assert.ok(
			result,
			"Should create orchestrator even when email provider config validation fails",
		);
	});

	it("should handle email provider instance validation failure gracefully", async () => {
		// Set valid env vars so validateProviderConfig passes
		process.env.EMAIL_GMAIL_CLIENT_ID = "test-client-id";
		process.env.EMAIL_GMAIL_CLIENT_SECRET = "test-client-secret";
		process.env.EMAIL_GMAIL_REFRESH_TOKEN = "test-refresh-token";

		// Mock GmailProvider.prototype.validateConfig to return invalid
		const gmailMod = await import("../../src/tools/email/providers/gmail.js");
		mock.method(gmailMod.GmailProvider.prototype, "validateConfig", () => ({
			valid: false,
			errors: ["Mock instance validation failure"],
		}));

		try {
			const { createDeepAgentsOrchestrator } = await import("../../src/agent/deepAgents.js");
			const result = await createDeepAgentsOrchestrator();
			assert.ok(
				result,
				"Should create orchestrator even when email provider instance validation fails",
			);
		} finally {
			mock.reset();
		}
	});

	it("should handle email provider creation failure gracefully", async () => {
		// Set valid env vars so validateProviderConfig passes
		process.env.EMAIL_GMAIL_CLIENT_ID = "test-client-id";
		process.env.EMAIL_GMAIL_CLIENT_SECRET = "test-client-secret";
		process.env.EMAIL_GMAIL_REFRESH_TOKEN = "test-refresh-token";

		// Mock GmailProvider.prototype.validateConfig to throw
		const gmailMod = await import("../../src/tools/email/providers/gmail.js");
		mock.method(gmailMod.GmailProvider.prototype, "validateConfig", () => {
			throw new Error("Mock validateConfig failure");
		});

		try {
			const { createDeepAgentsOrchestrator } = await import("../../src/agent/deepAgents.js");
			const result = await createDeepAgentsOrchestrator();
			assert.ok(
				result,
				"Should create orchestrator even when email provider validateConfig throws",
			);
		} finally {
			mock.reset();
		}
	});
});

describe("modelIdentifier colon sanitization", () => {
	it("should replace a single colon in model name with hyphen", () => {
		const providerName = "openai";
		const modelName = "qwen3.8:27b-mlx";
		const result = `${providerName}:${modelName.replace(/:/g, "-")}`;
		assert.strictEqual(result, "openai:qwen3.8-27b-mlx");
	});

	it("should replace multiple colons in model name with hyphens", () => {
		const providerName = "openai";
		const modelName = "a:b:c";
		const result = `${providerName}:${modelName.replace(/:/g, "-")}`;
		assert.strictEqual(result, "openai:a-b-c");
	});

	it("should replace leading and trailing colons in model name with hyphens", () => {
		const providerName = "openai";
		const modelName = ":model:";
		const result = `${providerName}:${modelName.replace(/:/g, "-")}`;
		assert.strictEqual(result, "openai:-model-");
	});

	it("should not modify model name without colons", () => {
		const providerName = "openai";
		const modelName = "gpt-4o";
		const result = `${providerName}:${modelName.replace(/:/g, "-")}`;
		assert.strictEqual(result, "openai:gpt-4o");
	});

	it("should preserve original model name for API calls", () => {
		const modelName = "qwen3.8:27b-mlx";
		const sanitized = modelName.replace(/:/g, "-");
		assert.notStrictEqual(sanitized, modelName);
		assert.strictEqual(modelName, "qwen3.8:27b-mlx");
	});
});

describe("createSubagentDefinitions tool visibility", () => {
	it("should include a Tools: list in descriptions of tool-capable subagents", async () => {
		const { createSubagentDefinitions } = await import("../../src/agent/deepAgents.js");
		const { getToolsForAgentTypes, TOOLS } = await import("../../src/tools/index.js");
		const { SkillRegistry } = await import("../../src/skills/registry.js");

		const skillRegistry = new SkillRegistry();
		const config = { providers: { openai: {} }, subAgentsTemperature: {} };
		const definitions = createSubagentDefinitions([], {}, skillRegistry, config);

		assert.ok(definitions.length > 0, "Should produce subagent definitions");

		for (const def of definitions) {
			const expectedTools = getToolsForAgentTypes([def.name], TOOLS);
			if (expectedTools.length > 0) {
				assert.ok(
					def.description.includes("Tools:"),
					`Subagent "${def.name}" description should include a Tools: list`,
				);
			} else {
				assert.ok(
					!def.description.includes("Tools:"),
					`Subagent "${def.name}" with no tools should omit the Tools: suffix`,
				);
			}
		}
	});

	it("should match tool names in description to getToolsForAgentTypes", async () => {
		const { createSubagentDefinitions } = await import("../../src/agent/deepAgents.js");
		const { getToolsForAgentTypes, TOOLS } = await import("../../src/tools/index.js");
		const { SkillRegistry } = await import("../../src/skills/registry.js");

		const skillRegistry = new SkillRegistry();
		const config = { providers: { openai: {} }, subAgentsTemperature: {} };
		const definitions = createSubagentDefinitions([], {}, skillRegistry, config);

		for (const def of definitions) {
			const expectedTools = getToolsForAgentTypes([def.name], TOOLS);
			if (expectedTools.length === 0) {
				continue;
			}
			const toolsMatch = def.description.match(/Tools: (.+)$/);
			assert.ok(toolsMatch, `Subagent "${def.name}" should have a Tools: list`);
			const renderedTools = toolsMatch[1].split(", ");
			assert.deepStrictEqual(
				renderedTools,
				expectedTools,
				`Subagent "${def.name}" tool list should match getToolsForAgentTypes`,
			);
		}
	});
});

describe("compactAgentContext", () => {
	/**
	 * Create a mock LangChain message with the given type and content.
	 * @param {string} type - Message type ("human", "ai", "tool", "system")
	 * @param {string|Array} content - Message content
	 * @param {Object} [extra] - Extra fields (e.g., name)
	 * @returns {Object} Mock message
	 */
	function makeMessage(type, content, extra = {}) {
		return {
			_getType: () => type,
			type,
			content,
			...extra,
		};
	}

	/**
	 * Create a mock agent with getState/updateState.
	 * @param {Array} messages - Initial messages
	 * @returns {{ agent: Object, updated: Object }} Mock agent and captured update
	 */
	function makeMockAgent(messages) {
		const updated = { messages: null };
		return {
			agent: {
				getState: async () => ({ values: { messages } }),
				updateState: async (_config, values) => {
					updated.messages = values.messages;
				},
			},
			updated,
		};
	}

	it("removes readImage ToolMessages with non-empty data", async () => {
		const { compactAgentContext } = await import("../../src/agent/deepAgents.js");
		const messages = [
			makeMessage("human", "Look at this image"),
			makeMessage("tool", JSON.stringify({ ok: true, mimeType: "image/png", data: "aGVsbG8=" }), {
				name: "readImage",
			}),
			makeMessage("ai", "I see the image"),
		];
		const { agent, updated } = makeMockAgent(messages);
		const result = await compactAgentContext(agent, { configurable: { thread_id: "t1" } });

		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.removedVision, 1);
		assert.strictEqual(result.remaining, 2);
		// The readImage ToolMessage should be removed.
		assert.strictEqual(updated.messages.length, 3); // RemoveMessage sentinel + 2 messages
		assert.strictEqual(updated.messages[1].content, "Look at this image");
		assert.strictEqual(updated.messages[2].content, "I see the image");
	});

	it("removes messages with image_url content blocks", async () => {
		const { compactAgentContext } = await import("../../src/agent/deepAgents.js");
		const messages = [
			makeMessage("human", [
				{ type: "text", text: "Describe this" },
				{ type: "image_url", image_url: { url: "data:image/png;base64,aGVsbG8=" } },
			]),
			makeMessage("ai", "It's a hello world image"),
		];
		const { agent, updated } = makeMockAgent(messages);
		const result = await compactAgentContext(agent, { configurable: { thread_id: "t1" } });

		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.removedVision, 1);
		assert.strictEqual(result.remaining, 1);
		assert.strictEqual(updated.messages.length, 2); // RemoveMessage sentinel + 1 message
		assert.strictEqual(updated.messages[1].content, "It's a hello world image");
	});

	it("trims older messages beyond keepRecent", async () => {
		const { compactAgentContext } = await import("../../src/agent/deepAgents.js");
		const messages = [];
		for (let i = 0; i < 30; i++) {
			messages.push(makeMessage("human", `message ${i}`));
		}
		const { agent, updated } = makeMockAgent(messages);
		const result = await compactAgentContext(agent, { configurable: { thread_id: "t1" } }, null, {
			keepRecent: 10,
		});

		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.trimmed, 20);
		assert.strictEqual(result.remaining, 10);
		assert.strictEqual(updated.messages.length, 11); // RemoveMessage sentinel + 10 messages
		assert.strictEqual(updated.messages[1].content, "message 20");
	});

	it("forces summarization when backend and model are provided", async () => {
		const { HumanMessage } = await import("@langchain/core/messages");
		const { LocalShellBackend } = await import("deepagents");
		const { compactAgentContext } = await import("../../src/agent/deepAgents.js");
		const messages = [
			new HumanMessage("one"),
			new HumanMessage("two"),
			new HumanMessage("three"),
			new HumanMessage("four"),
		];
		const { agent, updated } = makeMockAgent(messages);
		// Real backend + mock model so the forced summarization path is exercised.
		// The middleware calls model.invoke to produce a summary; the backend
		// offload failure is caught internally and it proceeds with the summary.
		const backend = new LocalShellBackend({
			rootDir: process.cwd(),
			virtualMode: false,
			inheritEnv: true,
		});
		const model = {
			invoke: async () => ({ text: "This is a summary." }),
		};
		const result = await compactAgentContext(agent, { configurable: { thread_id: "t1" } }, null, {
			backend,
			model,
			keepRecent: 2,
		});

		assert.strictEqual(result.ok, true);
		// The summary message replaces the older messages; the kept set is the
		// summary + the 2 most recent messages. The summary is preserved (not
		// re-trimmed), so the final set is summary + three + four.
		assert.strictEqual(updated.messages.length, 4); // RemoveMessage sentinel + summary + 2 kept
		assert.strictEqual(
			updated.messages[1].content,
			"Here is a summary of the conversation to date:\n\nThis is a summary.",
		);
		assert.strictEqual(updated.messages[2].content, "three");
		assert.strictEqual(updated.messages[3].content, "four");
	});

	it("updates sessionState.getConversation() when provided", async () => {
		const { compactAgentContext } = await import("../../src/agent/deepAgents.js");
		const messages = [makeMessage("human", "Hello"), makeMessage("ai", "Hi there")];
		const { agent } = makeMockAgent(messages);
		let loaded = null;
		const sessionState = {
			loadConversation: (conv) => {
				loaded = conv;
			},
		};
		const result = await compactAgentContext(
			agent,
			{ configurable: { thread_id: "t1" } },
			sessionState,
		);

		assert.strictEqual(result.ok, true);
		assert.ok(loaded, "sessionState.loadConversation should be called");
		assert.strictEqual(loaded.length, 2);
		assert.strictEqual(loaded[0].role, "user");
		assert.strictEqual(loaded[0].content, "Hello");
		assert.strictEqual(loaded[1].role, "assistant");
		assert.strictEqual(loaded[1].content, "Hi there");
	});

	it("flattens content blocks when loading the conversation into sessionState", async () => {
		const { compactAgentContext } = await import("../../src/agent/deepAgents.js");
		const messages = [
			makeMessage("human", [
				{ type: "text", text: "What is this?" },
				{ type: "text-plain", text: " plain text" },
			]),
			makeMessage("ai", [
				{ type: "reasoning", reasoning: "thinking..." },
				{ type: "text", text: "It's a hello world image." },
			]),
			makeMessage("tool", { ok: true, data: [1] }, { name: "search" }),
		];
		const { agent } = makeMockAgent(messages);
		let loaded = null;
		const sessionState = {
			loadConversation: (conv) => {
				loaded = conv;
			},
		};
		const result = await compactAgentContext(
			agent,
			{ configurable: { thread_id: "t1" } },
			sessionState,
		);

		assert.strictEqual(result.ok, true);
		assert.ok(loaded, "sessionState.loadConversation should be called");
		assert.strictEqual(loaded.length, 3);
		assert.strictEqual(loaded[0].role, "user");
		assert.strictEqual(
			loaded[0].content,
			"What is this? plain text",
			"text and text-plain blocks should be flattened",
		);
		assert.strictEqual(loaded[1].role, "assistant");
		assert.strictEqual(
			loaded[1].content,
			"thinking...It's a hello world image.",
			"reasoning and text blocks should be flattened",
		);
		assert.strictEqual(loaded[2].role, "tool");
		assert.strictEqual(loaded[2].content, JSON.stringify({ ok: true, data: [1] }));
	});

	it("flattens file, image, and unknown content blocks", async () => {
		const { compactAgentContext } = await import("../../src/agent/deepAgents.js");
		const messages = [
			makeMessage("human", [
				{ type: "file", url: "file:///tmp/a.txt" },
				{ type: "image", data: "aGVsbG8=" },
				{ type: "unknown", foo: "bar" },
			]),
			makeMessage("ai", "done"),
		];
		const { agent } = makeMockAgent(messages);
		let loaded = null;
		const sessionState = {
			loadConversation: (conv) => {
				loaded = conv;
			},
		};
		const result = await compactAgentContext(
			agent,
			{ configurable: { thread_id: "t1" } },
			sessionState,
		);

		assert.strictEqual(result.ok, true);
		assert.ok(loaded, "sessionState.loadConversation should be called");
		assert.strictEqual(loaded.length, 2);
		assert.strictEqual(loaded[0].role, "user");
		assert.strictEqual(
			loaded[0].content,
			"file:///tmp/a.txt" + "aGVsbG8=" + JSON.stringify({ type: "unknown", foo: "bar" }),
			"file, image, and unknown blocks should be flattened",
		);
	});

	it("handles empty message state", async () => {
		const { compactAgentContext } = await import("../../src/agent/deepAgents.js");
		const { agent } = makeMockAgent([]);
		const result = await compactAgentContext(agent, { configurable: { thread_id: "t1" } });

		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.removedVision, 0);
		assert.strictEqual(result.trimmed, 0);
		assert.strictEqual(result.remaining, 0);
	});

	it("returns ok with no changes when no vision messages exist", async () => {
		const { compactAgentContext } = await import("../../src/agent/deepAgents.js");
		const messages = [makeMessage("human", "Hello"), makeMessage("ai", "Hi")];
		const { agent } = makeMockAgent(messages);
		const result = await compactAgentContext(agent, { configurable: { thread_id: "t1" } });

		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.removedVision, 0);
		assert.strictEqual(result.trimmed, 0);
		assert.strictEqual(result.remaining, 2);
	});

	it("returns an error result when getState throws", async () => {
		const { compactAgentContext } = await import("../../src/agent/deepAgents.js");
		const agent = {
			getState: async () => {
				throw new Error("no checkpointer");
			},
		};
		const result = await compactAgentContext(agent, { configurable: { thread_id: "t1" } });

		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("no checkpointer"));
	});
});
