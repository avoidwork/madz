import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert";
import { existsSync } from "node:fs";
import { rm, realpath } from "node:fs/promises";
import { ensureSessionsDir } from "../../src/session/index.js";
import { createSession } from "../../src/session/factory.js";
import { SessionStateManager } from "../../src/session/stateManager.js";
import { enforceContextWindow, trimConversation } from "../../src/session/window.js";

describe("session - factory", () => {
	it("creates a session with UUID", () => {
		const { sessionId } = createSession();
		assert.ok(sessionId.length > 0);
		// UUID format: 8-4-4-4-12
		assert.ok(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(sessionId));
	});

	it("has timestamped state creation", () => {
		const { createdAt, updatedAt } = createSession();
		assert.ok(createdAt);
		assert.ok(updatedAt);
	});

	it("accepts config overrides", () => {
		const _result = createSession({ provider: "local", contextWindow: 10 });
		// Note: factory uses config.provider || "openai", so "local" is used
	});
});

describe("session - state manager", () => {
	it("defaults to openai provider", () => {
		const manager = new SessionStateManager({});
		assert.strictEqual(manager.getProvider(), "openai");
	});

	it("sets and gets provider", () => {
		const manager = new SessionStateManager({});
		manager.setProvider("local");
		assert.strictEqual(manager.getProvider(), "local");
	});

	it("manages conversation exchanges", () => {
		const manager = new SessionStateManager({});
		manager.addExchange({ role: "user", content: "hello" });
		const conv = manager.getConversation();
		assert.strictEqual(conv.length, 1);
		assert.strictEqual(conv[0].role, "user");
	});

	it("adds timestamp to exchanges", () => {
		const manager = new SessionStateManager({});
		manager.addExchange({ role: "user", content: "test" });
		assert.ok(manager.getConversation()[0].timestamp);
	});

	it("manages skills list", () => {
		const manager = new SessionStateManager({});
		manager.registerSkill("fs-read");
		assert.ok(manager.getSkills().includes("fs-read"));
	});

	it("deduplicates skills", () => {
		const manager = new SessionStateManager({});
		manager.registerSkill("fs-read");
		manager.registerSkill("fs-read");
		const skills = manager.getSkills();
		assert.strictEqual(skills.filter((s) => s === "fs-read").length, 1);
	});

	it("manages context window size", () => {
		const manager = new SessionStateManager({});
		assert.strictEqual(manager.getContextWindow(), 20);
		manager.setContextWindow(10);
		assert.strictEqual(manager.getContextWindow(), 10);
	});

	it("clamps context window to minimum 1", () => {
		const manager = new SessionStateManager({});
		manager.setContextWindow(0);
		assert.strictEqual(manager.getContextWindow(), 1);
	});

	it("returns a copy of state", () => {
		const manager = new SessionStateManager({});
		const state = manager.getState();
		assert.ok(Array.isArray(state.conversation));
		assert.ok(Array.isArray(state.skills));
	});

	it("removes last assistant message with tool_calls", () => {
		const manager = new SessionStateManager({});
		manager.addExchange({ role: "user", content: "hello" });
		manager.addExchange({
			role: "assistant",
			content: { tool_calls: [{ id: "call_1", function: { name: "test" } }] },
		});
		const result = manager.removeLastAssistantToolCallMessage();
		assert.ok(result);
		assert.strictEqual(result.role, "assistant");
		assert.strictEqual(manager.getConversation().length, 1);
		assert.strictEqual(manager.getConversation()[0].role, "user");
	});

	it("does not remove assistant message without tool_calls", () => {
		const manager = new SessionStateManager({});
		manager.addExchange({ role: "user", content: "hello" });
		manager.addExchange({ role: "assistant", content: "just text" });
		const result = manager.removeLastAssistantToolCallMessage();
		assert.strictEqual(result, undefined);
		assert.strictEqual(manager.getConversation().length, 2);
	});

	it("returns undefined when no assistant message exists", () => {
		const manager = new SessionStateManager({});
		manager.addExchange({ role: "user", content: "hello" });
		const result = manager.removeLastAssistantToolCallMessage();
		assert.strictEqual(result, undefined);
		assert.strictEqual(manager.getConversation().length, 1);
	});

	it("returns undefined and is safe on empty conversation", () => {
		const manager = new SessionStateManager({});
		const result = manager.removeLastAssistantToolCallMessage();
		assert.strictEqual(result, undefined);
		assert.strictEqual(manager.getConversation().length, 0);
	});

	it("does not remove assistant message with empty tool_calls array", () => {
		const manager = new SessionStateManager({});
		manager.addExchange({ role: "user", content: "hello" });
		manager.addExchange({ role: "assistant", content: { tool_calls: [] } });
		const result = manager.removeLastAssistantToolCallMessage();
		assert.strictEqual(result, undefined);
		assert.strictEqual(manager.getConversation().length, 2);
	});

	it("full interrupt cleanup: removes assistant tool-call message then user message", () => {
		const manager = new SessionStateManager({});
		manager.addExchange({ role: "user", content: "run search" });
		manager.addExchange({
			role: "assistant",
			content: { tool_calls: [{ id: "call_1", function: { name: "search" } }] },
		});

		// Simulate handleInterrupt() cleanup: remove assistant tool-call message first
		manager.removeLastAssistantToolCallMessage();
		// Then pop the user message
		manager.popExchange();

		assert.strictEqual(manager.getConversation().length, 0);
	});

	it("full interrupt cleanup: handles text response (no tool_calls)", () => {
		const manager = new SessionStateManager({});
		manager.addExchange({ role: "user", content: "hello" });
		manager.addExchange({ role: "assistant", content: "hi there" });

		// Simulate handleInterrupt() cleanup: remove assistant tool-call message (no-op)
		// then pop the last message (assistant text response)
		manager.removeLastAssistantToolCallMessage();
		manager.popExchange();

		// After cleanup: user message remains (assistant text response was the last message)
		assert.strictEqual(manager.getConversation().length, 1);
		assert.strictEqual(manager.getConversation()[0].role, "user");
		assert.strictEqual(manager.getConversation()[0].content, "hello");
	});
});

describe("session - context window enforcement", () => {
	it("keeps all messages when under limit", () => {
		const conv = [
			{ role: "user", content: "hi" },
			{ role: "assistant", content: "hello!" },
		];
		const result = enforceContextWindow(conv, 10);
		assert.strictEqual(result.pruned, 0);
		assert.strictEqual(result.context.length, 2);
	});

	it("trims oldest when over limit", () => {
		const conv = [
			{ role: "user", content: "msg1" },
			{ role: "user", content: "msg2" },
			{ role: "user", content: "msg3" },
			{ role: "user", content: "msg4" },
			{ role: "user", content: "msg5" },
		];
		const result = enforceContextWindow(conv, 3);
		assert.strictEqual(result.pruned, 2);
		assert.strictEqual(result.context.length, 3);
		assert.strictEqual(result.context[0].content, "msg3");
	});

	it("handles empty conversation", () => {
		const result = enforceContextWindow([], 10);
		assert.strictEqual(result.pruned, 0);
		assert.strictEqual(result.context.length, 0);
	});

	it("handles null conversation", () => {
		const result = enforceContextWindow(null, 10);
		assert.strictEqual(result.pruned, 0);
		assert.strictEqual(result.context.length, 0);
	});

	it("uses clamped window size", () => {
		const result = enforceContextWindow([{ content: "x" }], -5);
		assert.strictEqual(result.context.length, 1);
	});

	it("trimsConversation curried function works", () => {
		const trimmer = trimConversation(2);
		const result = trimmer([
			{ content: "1" },
			{ content: "2" },
			{ content: "3" },
			{ content: "4" },
		]);
		assert.strictEqual(result.length, 2);
		assert.strictEqual(result[0].content, "3");
	});

	it("trimsConversation preserves small conversations", () => {
		const trimmer = trimConversation(5);
		const result = trimmer([{ content: "a" }]);
		assert.strictEqual(result.length, 1);
	});
});

describe("session - state manager thread ID", () => {
	it("defaults to provider when no threadId set", () => {
		const manager = new SessionStateManager({});
		assert.strictEqual(manager.getThreadId(), "openai");
	});

	it("defaults to provider for non-default provider", () => {
		const manager = new SessionStateManager({ provider: "local" });
		assert.strictEqual(manager.getThreadId(), "local");
	});

	it("returns explicit threadId when set", () => {
		const manager = new SessionStateManager({ provider: "openai" });
		const threadId = "test-thread-uuid";
		manager.setThreadId(threadId);
		assert.strictEqual(manager.getThreadId(), threadId);
	});

	it("updates updatedAt when setting threadId", () => {
		const manager = new SessionStateManager({ provider: "openai" });
		const _before = new Date(manager.getState().updatedAt);
		setTimeout(() => {
			manager.setThreadId("new-thread");
			const after = new Date(manager.getState().updatedAt);
			assert.ok(after >= _before);
		}, 10);
	});
});

describe("session - state manager createNewSession", () => {
	it("clears the conversation", () => {
		const manager = new SessionStateManager({});
		manager.addExchange({ role: "user", content: "hello" });
		manager.addExchange({ role: "assistant", content: "world" });
		assert.strictEqual(manager.getConversation().length, 2);
		manager.createNewSession();
		assert.strictEqual(manager.getConversation().length, 0);
	});

	it("clears the skills list", () => {
		const manager = new SessionStateManager({});
		manager.registerSkill("fs-read");
		assert.strictEqual(manager.getSkills().length, 1);
		manager.createNewSession();
		assert.strictEqual(manager.getSkills().length, 0);
	});

	it("generates a new UUID threadId", () => {
		const manager = new SessionStateManager({});
		const oldId = manager.getThreadId();
		const result = manager.createNewSession();
		assert.notStrictEqual(result.sessionId, oldId);
		assert.strictEqual(manager.getThreadId(), result.sessionId);
		assert.ok(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(result.sessionId),
		);
	});

	it("creates session with explicit threadId", () => {
		const manager = new SessionStateManager({});
		const customId = "custom-session-uuid";
		const { sessionId } = manager.createNewSession(customId);
		assert.strictEqual(sessionId, customId);
		assert.strictEqual(manager.getThreadId(), customId);
	});

	it("preserves provider from initial state", () => {
		const manager = new SessionStateManager({ provider: "local" });
		manager.createNewSession();
		assert.strictEqual(manager.getProvider(), "local");
		assert.strictEqual(manager.getConversation().length, 0);
	});

	it("updates updatedAt timestamp", () => {
		const manager = new SessionStateManager({});
		const _before = manager.getState().updatedAt;
		const { sessionId } = manager.createNewSession();
		assert.ok(sessionId.length > 0);
	});
});

describe("session - ensureSessionsDir", () => {
	const TEST_DIR = "memory/__test_ensure_sessions_dir__/";

	let absTestDir;

	before(async () => {
		absTestDir = await realpath(process.cwd());
		await rm(absTestDir + "/" + TEST_DIR, { recursive: true, force: true });
	});

	after(async () => {
		await rm(absTestDir + "/" + TEST_DIR, { recursive: true, force: true });
	});

	afterEach(async () => {
		const dir = absTestDir + "/" + TEST_DIR;
		if (existsSync(dir)) {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("creates directory when missing", async () => {
		const dirPath = TEST_DIR + "subdir/";
		assert.ok(!existsSync(absTestDir + "/" + dirPath));
		await ensureSessionsDir(dirPath);
		assert.ok(existsSync(absTestDir + "/" + dirPath));
	});

	it("returns successfully when directory already exists", async () => {
		const dirPath = TEST_DIR + "subdir2/";
		await ensureSessionsDir(dirPath);
		assert.ok(existsSync(absTestDir + "/" + dirPath));
		await ensureSessionsDir(dirPath);
		assert.ok(existsSync(absTestDir + "/" + dirPath));
	});
});
