import { describe, it } from "node:test";
import assert from "node:assert";
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
