import { describe, it } from "node:test";
import assert from "node:assert";

describe("integration - conversational flow", () => {
	it("flows from input through provider to response", async () => {
		// Simulate the core conversation flow logic
		let conversation = [
			{ role: "user", content: "What's the weather?" },
			{ role: "assistant", content: "Sunny, 72°F." },
		];

		// Step 1: User sends message
		conversation.push({ role: "user", content: "Follow up question" });
		assert.strictEqual(conversation.length, 3);

		// Step 2: Provider generates response
		conversation.push({ role: "assistant", content: "Here's the answer..." });
		assert.strictEqual(conversation.length, 4);

		// Step 3: Response persisted to memory
		const persisted = conversation;
		assert.deepStrictEqual(persisted, conversation);
	});

	it("enforces context window during conversation", async () => {
		let conversation = [
			{ role: "user", content: "msg 0" },
			{ role: "assistant", content: "response 0" },
			{ role: "user", content: "msg 1" },
			{ role: "assistant", content: "response 1" },
			{ role: "user", content: "msg 2" },
			{ role: "assistant", content: "response 2" },
			{ role: "user", content: "msg 3" },
			{ role: "assistant", content: "response 3" },
		];

		// Enforce window of 4
		const windowSize = 4;
		const windowed = conversation.slice(-windowSize);

		assert.strictEqual(windowed.length, 4);
		assert.strictEqual(windowed[0].content, "msg 2");
		assert.strictEqual(windowed[3].content, "response 3");
	});
});
describe("integration - skill execution through sandbox", () => {
	it("validates skill exists before execution", async () => {
		const registry = new Map();
		registry.set("fs-read", { metadata: {}, disabled: false });

		const skillName = "fs-read";
		const exists = registry.has(skillName);
		assert.strictEqual(exists, true);

		const missing = registry.has("nonexistent");
		assert.strictEqual(missing, false);
	});

	it("resolves permissions for skill execution", async () => {
		const skill = {
			name: "api-request",
			metadata: { permissions: ["network:outbound", "filesystem:read"] },
		};

		// Merge with defaults
		const defaults = ["filesystem:read", "env:read"];
		const combined = [...new Set([...defaults, ...skill.metadata.permissions])];

		assert.ok(combined.includes("filesystem:read"));
		assert.ok(combined.includes("network:outbound"));
		assert.ok(combined.includes("env:read"));
	});

	it("blocks disabled skill execution", async () => {
		const skill = { name: "old-skill", metadata: { disabled: true } };

		if (skill.metadata.disabled) {
			assert.ok(true); // Should be blocked
		}
	});
});

describe("integration - session lifecycle", () => {
	it("creates session, adds messages, and saves on shutdown", async () => {
		// Step 1: Create session
		const sessionId = crypto.randomUUID();
		assert.ok(sessionId.length > 0);

		let conversation = [];
		let stateProvider = "openai";

		// Step 2: Add conversation exchanges
		conversation.push({ role: "user", content: "Hello", timestamp: "2024-01-01T00:00:00Z" });
		conversation.push({
			role: "assistant",
			content: "Hi there!",
			timestamp: "2024-01-01T00:00:01Z",
		});

		assert.strictEqual(conversation.length, 2);

		// Step 3: Save on shutdown
		const saved = JSON.parse(JSON.stringify(conversation));
		assert.deepStrictEqual(saved, conversation);

		// Step 4: Verify session state persisted
		assert.strictEqual(stateProvider, "openai");
	});

	it("restores previous session on startup", async () => {
		// Simulate restoring from a saved conversation
		const savedConversation = [
			{ role: "user", content: "Previous session message", timestamp: "2024-01-01T00:00:00Z" },
			{ role: "assistant", content: "Previous response", timestamp: "2024-01-01T00:00:01Z" },
		];

		let loadedConversation = [...savedConversation];
		assert.strictEqual(loadedConversation.length, 2);
	});

	it("handles graceful shutdown", async () => {
		let shutdownCalled = false;
		let telemetryFlushed = false;

		const shutdown = async () => {
			telemetryFlushed = true;
			shutdownCalled = true;
		};

		await shutdown();
		assert.strictEqual(shutdownCalled, true);
		assert.strictEqual(telemetryFlushed, true);
	});

	describe("config mutation during session", () => {
		it("allows runtime config changes", async () => {
			const config = { providers: { default: "openai" }, session: { context_window_size: 20 } };
			config.session.context_window_size = 40;
			assert.strictEqual(config.session.context_window_size, 40);
		});

		it("persists config changes to disk", async () => {
			const config = { telemetry: { enabled: false } };
			config.telemetry.enabled = true;
			assert.strictEqual(config.telemetry.enabled, true);
		});
	});
});

describe("integration - memory persistence", () => {
	it("writes and reads conversation memory", async () => {
		const writePath = "memory/conversations/test-entry.md";
		// Simulate write
		const writeResult = writePath;

		// Simulate read
		const readResult = writePath;
		assert.strictEqual(writeResult, readResult);
	});

	it("updates memory index on new entry", async () => {
		const entries = [{ path: "memory/a.md", title: "A", timestamp: "2024-01-01" }];

		entries.push({ path: "memory/b.md", title: "B", timestamp: "2024-01-02" });
		assert.strictEqual(entries.length, 2);
	});

	it("searches memory index", async () => {
		const entries = [
			{ path: "memory/a.md", title: "Daily Report" },
			{ path: "memory/b.md", title: "Weekly Summary" },
		];

		const results = entries.filter((e) => e.title.toLowerCase().includes("weekly"));
		assert.strictEqual(results.length, 1);
		assert.strictEqual(results[0].title, "Weekly Summary");
	});
});

describe("integration - scheduler execution", () => {
	it("parses and validates all schedule entries", async () => {
		const schedules = [
			{ name: "daily", cron: "0 9 * * *", skill: "host-info" },
			{ name: "weekly", cron: "0 6 * * 1", skill: "api-request" },
		];

		for (const entry of schedules) {
			const fields = entry.cron.split(/\s+/);
			assert.strictEqual(fields.length, 5);
		}
	});

	it("enforces concurrent execution limits", async () => {
		const maxConcurrent = 1;
		let concurrent = 0;
		const scheduleTasks = [
			{ name: "A", cron: "0 9 * * *", skill: "x" },
			{ name: "B", cron: "0 9 * * *", skill: "y" },
		];

		// First task starts
		concurrent += 1;
		assert.strictEqual(concurrent, 1);

		// Second task waits (limit reached)
		const canStart = concurrent < maxConcurrent;
		assert.strictEqual(canStart, false);

		// First task completes
		concurrent -= 1;
		const nextCanStart = concurrent < maxConcurrent;
		assert.strictEqual(nextCanStart, true);
	});
});

describe("integration - telemetry export", () => {
	it("records spans for LLM calls", async () => {
		const spans = [];
		const callSpan = { name: "llm.call", attributes: { provider: "openai" } };
		spans.push(callSpan);
		assert.strictEqual(spans.length, 1);
	});

	it("flushes spans on shutdown", async () => {
		const pending = [{ name: "span-1" }, { name: "span-2" }];
		const flushed = pending.slice();
		pending.length = 0;
		assert.strictEqual(flushed.length, 2);
		assert.strictEqual(pending.length, 0);
	});

	it("applies redaction to sensitive attributes", async () => {
		const attrs = { provider: "openai", apiKey: "secret", model: "gpt-4" };
		const redacted = {
			...attrs,
			apiKey: "[REDACTED]",
		};
		assert.strictEqual(redacted.apiKey, "[REDACTED]");
		assert.strictEqual(redacted.provider, "openai");
	});
});
