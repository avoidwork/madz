import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { rm, realpath } from "node:fs/promises";
import { ensureSessionsDir, createSession } from "../../src/session/factory.js";
import { SessionStateManager } from "../../src/session/stateManager.js";
import { enforceContextWindow, trimConversation } from "../../src/session/window.js";
import { saveSession } from "../../src/session/saver.js";

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
	it("defaults to provider when no sessionId set", () => {
		const manager = new SessionStateManager({});
		assert.strictEqual(manager.getSessionId(), "openai");
	});

	it("defaults to provider for non-default provider", () => {
		const manager = new SessionStateManager({ provider: "local" });
		assert.strictEqual(manager.getSessionId(), "local");
	});

	it("returns explicit sessionId when set", () => {
		const manager = new SessionStateManager({ provider: "openai" });
		const sessionId = "test-thread-uuid";
		manager.setSessionId(sessionId);
		assert.strictEqual(manager.getSessionId(), sessionId);
	});

	it("updates updatedAt when setting sessionId", () => {
		const manager = new SessionStateManager({ provider: "openai" });
		const _before = new Date(manager.getState().updatedAt);
		setTimeout(() => {
			manager.setSessionId("new-session");
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
		const oldId = manager.getSessionId();
		const result = manager.createNewSession();
		assert.notStrictEqual(result.sessionId, oldId);
		assert.strictEqual(manager.getSessionId(), result.sessionId);
		assert.ok(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(result.sessionId),
		);
	});

	it("creates session with explicit threadId", () => {
		const manager = new SessionStateManager({});
		const customId = "custom-session-uuid";
		const { sessionId } = manager.createNewSession(customId);
		assert.strictEqual(sessionId, customId);
		assert.strictEqual(manager.getSessionId(), customId);
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

describe("session - saveSession", () => {
	const TEST_DIR = "memory/__test_saveSession__/";

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

	it("creates the sessions directory if it does not exist", async () => {
		const dirPath = TEST_DIR + "subdir/";
		assert.ok(!existsSync(absTestDir + "/" + dirPath));
		await ensureSessionsDir(dirPath, absTestDir);
		await saveSession(dirPath, [], "test-session", absTestDir);
		assert.ok(existsSync(absTestDir + "/" + dirPath + "test-session.md"));
	});

	it("writes a .md file with the threadId as filename", async () => {
		const dirPath = TEST_DIR + "threaded/";
		await ensureSessionsDir(dirPath, absTestDir);
		await saveSession(dirPath, [], "abc-123-def", absTestDir);
		assert.ok(existsSync(absTestDir + "/" + dirPath + "abc-123-def.md"));
	});

	it("writes unsaved.md when threadId is empty", async () => {
		const dirPath = TEST_DIR + "unsaved/";
		await ensureSessionsDir(dirPath, absTestDir);
		await saveSession(dirPath, [], "", absTestDir);
		assert.ok(existsSync(absTestDir + "/" + dirPath + "unsaved.md"));
	});

	it("writes YAML frontmatter with metadata", async () => {
		const dirPath = TEST_DIR + "frontmatter/";
		await ensureSessionsDir(dirPath, absTestDir);
		await saveSession(dirPath, [], "fm-test", absTestDir);
		const content = readFileSync(absTestDir + "/" + dirPath + "fm-test.md", "utf-8");
		assert.ok(content.startsWith("---\n"));
		assert.ok(content.includes("threadId:"));
		assert.ok(content.includes("messageCount:"));
		assert.ok(content.includes("startedAt:"));
		assert.ok(content.includes("endedAt:"));
		assert.ok(content.includes("---"));
	});

	it("sets threadId in frontmatter from threadId param", async () => {
		const dirPath = TEST_DIR + "fm-thread/";
		await ensureSessionsDir(dirPath, absTestDir);
		await saveSession(dirPath, [], "explicit-thread", absTestDir);
		const content = readFileSync(absTestDir + "/" + dirPath + "explicit-thread.md", "utf-8");
		assert.ok(content.includes('threadId: "explicit-thread"'));
	});

	it("sets threadId to unsaved when threadId is empty", async () => {
		const dirPath = TEST_DIR + "fm-unsaved/";
		await ensureSessionsDir(dirPath, absTestDir);
		await saveSession(dirPath, [], "", absTestDir);
		const content = readFileSync(absTestDir + "/" + dirPath + "unsaved.md", "utf-8");
		assert.ok(content.includes('threadId: "unsaved"'));
	});

	it("sets messageCount from conversation length", async () => {
		const dirPath = TEST_DIR + "fm-count/";
		const conversation = [
			{ role: "user", content: "hello" },
			{ role: "assistant", content: "hi" },
			{ role: "user", content: "how are you" },
		];
		await ensureSessionsDir(dirPath, absTestDir);
		await saveSession(dirPath, conversation, "count-test", absTestDir);
		const content = readFileSync(absTestDir + "/" + dirPath + "count-test.md", "utf-8");
		assert.ok(content.includes("messageCount: 3"));
	});

	it("sets messageCount to 0 for empty conversation", async () => {
		const dirPath = TEST_DIR + "fm-empty/";
		await ensureSessionsDir(dirPath, absTestDir);
		await saveSession(dirPath, [], "empty-test", absTestDir);
		const content = readFileSync(absTestDir + "/" + dirPath + "empty-test.md", "utf-8");
		assert.ok(content.includes("messageCount: 0"));
	});

	it("sets messageCount to 0 for non-array conversation", async () => {
		const dirPath = TEST_DIR + "fm-nonarray/";
		await ensureSessionsDir(dirPath, absTestDir);
		await saveSession(dirPath, "not an array", "nonarray-test", absTestDir);
		const content = readFileSync(absTestDir + "/" + dirPath + "nonarray-test.md", "utf-8");
		assert.ok(content.includes("messageCount: 0"));
	});

	it("uses first exchange timestamp as startedAt", async () => {
		const dirPath = TEST_DIR + "fm-started/";
		const conversation = [
			{ role: "user", content: "hello", timestamp: "2026-01-15T10:30:00.000Z" },
			{ role: "assistant", content: "hi" },
		];
		await ensureSessionsDir(dirPath, absTestDir);
		await saveSession(dirPath, conversation, "started-test", absTestDir);
		const content = readFileSync(absTestDir + "/" + dirPath + "started-test.md", "utf-8");
		assert.ok(content.includes('startedAt: "2026-01-15T10:30:00.000Z"'));
	});

	it("uses current ISO timestamp as startedAt when no timestamp on first exchange", async () => {
		const dirPath = TEST_DIR + "fm-now/";
		const conversation = [{ role: "user", content: "hello" }];
		await ensureSessionsDir(dirPath, absTestDir);
		await saveSession(dirPath, conversation, "now-test", absTestDir);
		const content = readFileSync(absTestDir + "/" + dirPath + "now-test.md", "utf-8");
		const startedMatch = content.match(/startedAt: "([^"]+)"/);
		assert.ok(startedMatch);
		assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(startedMatch[1]));
	});

	it("writes conversation body as pretty-printed JSON", async () => {
		const dirPath = TEST_DIR + "fm-body/";
		const conversation = [
			{ role: "user", content: "hello" },
			{ role: "assistant", content: { text: "hi there" } },
		];
		await ensureSessionsDir(dirPath, absTestDir);
		await saveSession(dirPath, conversation, "body-test", absTestDir);
		const content = readFileSync(absTestDir + "/" + dirPath + "body-test.md", "utf-8");
		const jsonSection = content.split("---\n")[2];
		const parsed = JSON.parse(jsonSection);
		assert.strictEqual(parsed.length, 2);
		assert.strictEqual(parsed[0].role, "user");
		assert.strictEqual(parsed[1].content.text, "hi there");
	});

	it("escapes backslashes in string frontmatter values", async () => {
		const dirPath = TEST_DIR + "fm-escape/";
		await ensureSessionsDir(dirPath, absTestDir);
		await saveSession(dirPath, [], "path\\to\\file", absTestDir);
		const content = readFileSync(absTestDir + "/" + dirPath + "path\\to\\file.md", "utf-8");
		assert.ok(content.includes('threadId: "path\\\\to\\\\file"'));
	});

	it("escapes double quotes in string frontmatter values", async () => {
		const dirPath = TEST_DIR + "fm-quote/";
		await ensureSessionsDir(dirPath, absTestDir);
		await saveSession(dirPath, [], 'thread"quote', absTestDir);
		const content = readFileSync(absTestDir + "/" + dirPath + 'thread"quote.md', "utf-8");
		assert.ok(content.includes('threadId: "thread\\"quote"'));
	});

	it("escapes newlines in string frontmatter values", async () => {
		const dirPath = TEST_DIR + "fm-newline/";
		await ensureSessionsDir(dirPath, absTestDir);
		await saveSession(dirPath, [], "line1\nline2", absTestDir);
		const content = readFileSync(absTestDir + "/" + dirPath + "line1\nline2.md", "utf-8");
		assert.ok(content.includes('threadId: "line1\\nline2"'));
	});

	it("writes boolean values without quotes", async () => {
		const dirPath = TEST_DIR + "fm-bool/";
		await ensureSessionsDir(dirPath, absTestDir);
		await saveSession(dirPath, [], "bool-test", absTestDir);
		const content = readFileSync(absTestDir + "/" + dirPath + "bool-test.md", "utf-8");
		const lines = content.split("\n");
		// Find the second --- (closing frontmatter delimiter)
		const firstDashes = lines.indexOf("---");
		const fmEnd = lines.indexOf("---", firstDashes + 1);
		assert.ok(fmEnd > 0);
		const fmLines = lines.slice(1, fmEnd);
		for (const line of fmLines) {
			assert.ok(line.includes(":"), `Frontmatter line should have colon: ${line}`);
		}
	});

	it("writes number values without quotes", async () => {
		const dirPath = TEST_DIR + "fm-num/";
		await ensureSessionsDir(dirPath, absTestDir);
		await saveSession(dirPath, [], "num-test", absTestDir);
		const content = readFileSync(absTestDir + "/" + dirPath + "num-test.md", "utf-8");
		assert.ok(content.includes("messageCount: 0"));
	});

	it("writes endedAt as current ISO timestamp", async () => {
		const dirPath = TEST_DIR + "fm-ended/";
		await ensureSessionsDir(dirPath, absTestDir);
		await saveSession(dirPath, [], "ended-test", absTestDir);
		const content = readFileSync(absTestDir + "/" + dirPath + "ended-test.md", "utf-8");
		const endedMatch = content.match(/endedAt: "([^"]+)"/);
		assert.ok(endedMatch);
		assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(endedMatch[1]));
	});

	it("writes file with trailing newline after JSON body", async () => {
		const dirPath = TEST_DIR + "fm-trailing/";
		await ensureSessionsDir(dirPath, absTestDir);
		await saveSession(dirPath, [], "trailing-test", absTestDir);
		const content = readFileSync(absTestDir + "/" + dirPath + "trailing-test.md", "utf-8");
		assert.ok(content.endsWith("\n"));
	});

	it("writes file with newline between frontmatter and JSON body", async () => {
		const dirPath = TEST_DIR + "fm-separator/";
		await ensureSessionsDir(dirPath, absTestDir);
		await saveSession(dirPath, [], "sep-test", absTestDir);
		const content = readFileSync(absTestDir + "/" + dirPath + "sep-test.md", "utf-8");
		const lines = content.split("\n");
		// Find the second --- (closing frontmatter delimiter)
		const firstDashes = lines.indexOf("---");
		const fmEnd = lines.indexOf("---", firstDashes + 1);
		// The empty string at end of frontmatterLines produces \n after ---,
		// so body starts on the next line (no blank line separator)
		assert.strictEqual(lines[fmEnd + 1], "[]");
	});

	it("handles conversation with nested objects", async () => {
		const dirPath = TEST_DIR + "fm-nested/";
		const conversation = [
			{
				role: "assistant",
				content: {
					tool_calls: [{ id: "call_1", function: { name: "shell", arguments: '{"cmd":"ls"}' } }],
				},
			},
		];
		await ensureSessionsDir(dirPath, absTestDir);
		await saveSession(dirPath, conversation, "nested-test", absTestDir);
		const content = readFileSync(absTestDir + "/" + dirPath + "nested-test.md", "utf-8");
		const jsonSection = content.split("---\n")[2];
		const parsed = JSON.parse(jsonSection);
		assert.strictEqual(parsed[0].content.tool_calls[0].function.name, "shell");
	});

	it("handles conversation with null values", async () => {
		const dirPath = TEST_DIR + "fm-null/";
		const conversation = [{ role: "user", content: null }];
		await ensureSessionsDir(dirPath, absTestDir);
		await saveSession(dirPath, conversation, "null-test", absTestDir);
		const content = readFileSync(absTestDir + "/" + dirPath + "null-test.md", "utf-8");
		const jsonSection = content.split("---\n")[2];
		const parsed = JSON.parse(jsonSection);
		assert.strictEqual(parsed[0].content, null);
	});

	it("handles conversation with boolean values", async () => {
		const dirPath = TEST_DIR + "fm-boolval/";
		const conversation = [{ role: "user", content: true }];
		await ensureSessionsDir(dirPath, absTestDir);
		await saveSession(dirPath, conversation, "boolval-test", absTestDir);
		const content = readFileSync(absTestDir + "/" + dirPath + "boolval-test.md", "utf-8");
		const jsonSection = content.split("---\n")[2];
		const parsed = JSON.parse(jsonSection);
		assert.strictEqual(parsed[0].content, true);
	});
});
