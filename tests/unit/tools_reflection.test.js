import { describe, it, after, beforeEach } from "node:test";
import assert from "node:assert";
import { reflectionImpl } from "../../src/tools/reflection.js";
import { mkdir, writeFile, rm, readdir } from "node:fs/promises";
import { join } from "node:path";

const TEST_SESSIONS_DIR = "memory/__test_reflection__/";

/**
 * Write a session file directly to the test sessions directory.
 * @param {string} filename - Session filename (without .md)
 * @param {object} sessionData - Session data with startedAt, threadId, messages
 */
async function writeSession(filename, sessionData) {
	const frontmatter = `---\nstartedAt: "${sessionData.startedAt}"\nendedAt: "${sessionData.endedAt || ""}"\nthreadId: "${sessionData.threadId || ""}"\nmessageCount: ${sessionData.messages.length}\n---\n`;
	const body = JSON.stringify(sessionData.messages);
	await writeFile(join(TEST_SESSIONS_DIR, filename + ".md"), frontmatter + body);
}

/**
 * Write a session file with malformed YAML frontmatter.
 * @param {string} filename - Session filename
 * @param {string} badYaml - Malformed YAML content
 * @param {string} body - JSON body
 */
async function writeMalformedYamlSession(filename, badYaml, body) {
	const frontmatter = `---\n${badYaml}\n---\n`;
	await writeFile(join(TEST_SESSIONS_DIR, filename + ".md"), frontmatter + body);
}

/**
 * Write a session file with malformed JSON body.
 * @param {string} filename - Session filename
 * @param {string} frontmatter - YAML frontmatter
 * @param {string} badJson - Malformed JSON
 */
async function writeMalformedJsonSession(filename, frontmatter, badJson) {
	await writeFile(join(TEST_SESSIONS_DIR, filename + ".md"), frontmatter + badJson);
}

const defaultOpts = { sessionsDir: TEST_SESSIONS_DIR };

describe("reflection tool", () => {
	beforeEach(async () => {
		// Clean slate before each test
		try {
			await rm(TEST_SESSIONS_DIR, { recursive: true, force: true });
		} catch {
			// ignore
		}
		await mkdir(TEST_SESSIONS_DIR, { recursive: true });
	});

	after(async () => {
		try {
			await rm(TEST_SESSIONS_DIR, { recursive: true, force: true });
		} catch {
			// ignore
		}
	});

	// --- 3.2: read sessions from memory directory ---

	it("reads sessions from memory directory", async () => {
		await writeSession("session-001", {
			startedAt: "2026-08-10T10:00:00.000Z",
			endedAt: "2026-08-10T11:00:00.000Z",
			threadId: "thread-001",
			messages: [
				{ role: "user", content: "Hello", timestamp: "2026-08-10T10:00:00.000Z" },
				{ role: "assistant", content: "Hi there!", timestamp: "2026-08-10T10:00:01.000Z" },
			],
		});

		const result = JSON.parse(await reflectionImpl({}, defaultOpts));
		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].sessionId, "thread-001");
		assert.strictEqual(result[0].startedAt, "2026-08-10T10:00:00.000Z");
		assert.strictEqual(result[0].userMessages.length, 1);
		assert.strictEqual(result[0].userMessages[0].content, "Hello");
	});

	// --- 3.3: handle empty sessions directory ---

	it("returns empty array when sessions directory is empty", async () => {
		// Clean up any leftover files
		const files = await readdir(TEST_SESSIONS_DIR).catch(() => []);
		for (const f of files) {
			await rm(join(TEST_SESSIONS_DIR, f), { force: true });
		}

		const result = JSON.parse(await reflectionImpl({}, defaultOpts));
		assert.deepStrictEqual(result, []);
	});

	// --- 3.4: filter sessions by date window ---

	it("filters sessions by default 7-day window", async () => {
		const now = new Date();
		const recent = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
		const old = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

		await writeSession("recent-session", {
			startedAt: recent.toISOString(),
			endedAt: recent.toISOString(),
			threadId: "thread-recent",
			messages: [{ role: "user", content: "recent", timestamp: recent.toISOString() }],
		});

		await writeSession("old-session", {
			startedAt: old.toISOString(),
			endedAt: old.toISOString(),
			threadId: "thread-old",
			messages: [{ role: "user", content: "old", timestamp: old.toISOString() }],
		});

		const result = JSON.parse(await reflectionImpl({}, defaultOpts));
		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].sessionId, "thread-recent");
	});

	it("filters sessions by custom window (14 days)", async () => {
		const now = new Date();
		const recent = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
		const old = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000); // 20 days ago

		await writeSession("window-recent", {
			startedAt: recent.toISOString(),
			endedAt: recent.toISOString(),
			threadId: "thread-window-recent",
			messages: [{ role: "user", content: "recent", timestamp: recent.toISOString() }],
		});

		await writeSession("window-old", {
			startedAt: old.toISOString(),
			endedAt: old.toISOString(),
			threadId: "thread-window-old",
			messages: [{ role: "user", content: "old", timestamp: old.toISOString() }],
		});

		const result = JSON.parse(await reflectionImpl({ windowDays: 14 }, defaultOpts));
		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].sessionId, "thread-window-recent");
	});

	it("excludes sessions outside window (3 days)", async () => {
		const now = new Date();
		const within = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
		const outside = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago

		await writeSession("within-window", {
			startedAt: within.toISOString(),
			endedAt: within.toISOString(),
			threadId: "thread-within",
			messages: [{ role: "user", content: "within", timestamp: within.toISOString() }],
		});

		await writeSession("outside-window", {
			startedAt: outside.toISOString(),
			endedAt: outside.toISOString(),
			threadId: "thread-outside",
			messages: [{ role: "user", content: "outside", timestamp: outside.toISOString() }],
		});

		const result = JSON.parse(await reflectionImpl({ windowDays: 3 }, defaultOpts));
		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].sessionId, "thread-within");
	});

	// --- 3.5: filter sessions by ignore patterns ---

	it("excludes sessions matching ignore pattern in frontmatter", async () => {
		await writeSession("ignored-session", {
			startedAt: new Date().toISOString(),
			endedAt: new Date().toISOString(),
			threadId: "ignored",
			messages: [
				{ role: "user", content: "should be ignored", timestamp: new Date().toISOString() },
			],
		});

		await writeSession("kept-session", {
			startedAt: new Date().toISOString(),
			endedAt: new Date().toISOString(),
			threadId: "kept",
			messages: [{ role: "user", content: "should be kept", timestamp: new Date().toISOString() }],
		});

		const result = JSON.parse(await reflectionImpl({ ignorePatterns: ["ignored"] }, defaultOpts));
		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].sessionId, "kept");
	});

	it("excludes sessions matching ignore pattern in body", async () => {
		await writeSession("body-ignored", {
			startedAt: new Date().toISOString(),
			endedAt: new Date().toISOString(),
			threadId: "body-ignored",
			messages: [
				{ role: "user", content: "Run the reflection skill", timestamp: new Date().toISOString() },
			],
		});

		await writeSession("body-kept", {
			startedAt: new Date().toISOString(),
			endedAt: new Date().toISOString(),
			threadId: "body-kept",
			messages: [
				{ role: "user", content: "Normal conversation", timestamp: new Date().toISOString() },
			],
		});

		const result = JSON.parse(
			await reflectionImpl({ ignorePatterns: ["Run the reflection skill"] }, defaultOpts),
		);
		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].sessionId, "body-kept");
	});

	it("handles multiple ignore patterns", async () => {
		await writeSession("pattern-a", {
			startedAt: new Date().toISOString(),
			endedAt: new Date().toISOString(),
			threadId: "pattern-a",
			messages: [{ role: "user", content: "pattern A", timestamp: new Date().toISOString() }],
		});

		await writeSession("pattern-b", {
			startedAt: new Date().toISOString(),
			endedAt: new Date().toISOString(),
			threadId: "pattern-b",
			messages: [{ role: "user", content: "pattern B", timestamp: new Date().toISOString() }],
		});

		await writeSession("pattern-c", {
			startedAt: new Date().toISOString(),
			endedAt: new Date().toISOString(),
			threadId: "pattern-c",
			messages: [{ role: "user", content: "pattern C", timestamp: new Date().toISOString() }],
		});

		const result = JSON.parse(
			await reflectionImpl({ ignorePatterns: ["pattern-a", "pattern-b"] }, defaultOpts),
		);
		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].sessionId, "pattern-c");
	});

	it("does not filter when ignorePatterns is empty", async () => {
		await writeSession("no-filter-1", {
			startedAt: new Date().toISOString(),
			endedAt: new Date().toISOString(),
			threadId: "no-filter-1",
			messages: [{ role: "user", content: "msg1", timestamp: new Date().toISOString() }],
		});

		await writeSession("no-filter-2", {
			startedAt: new Date().toISOString(),
			endedAt: new Date().toISOString(),
			threadId: "no-filter-2",
			messages: [{ role: "user", content: "msg2", timestamp: new Date().toISOString() }],
		});

		const result = JSON.parse(await reflectionImpl({ ignorePatterns: [] }, defaultOpts));
		assert.strictEqual(result.length, 2);
	});

	// --- wildcard ignore patterns ---

	it("supports * wildcard in ignore patterns", async () => {
		await writeSession("wildcard-ignored", {
			startedAt: new Date().toISOString(),
			endedAt: new Date().toISOString(),
			threadId: "wildcard-ignored",
			messages: [
				{ role: "user", content: "Run the scan-issues skill", timestamp: new Date().toISOString() },
			],
		});

		await writeSession("wildcard-ignored-2", {
			startedAt: new Date().toISOString(),
			endedAt: new Date().toISOString(),
			threadId: "wildcard-ignored-2",
			messages: [
				{ role: "user", content: "Run the reflection skill", timestamp: new Date().toISOString() },
			],
		});

		await writeSession("wildcard-kept", {
			startedAt: new Date().toISOString(),
			endedAt: new Date().toISOString(),
			threadId: "wildcard-kept",
			messages: [
				{ role: "user", content: "Normal conversation", timestamp: new Date().toISOString() },
			],
		});

		const result = JSON.parse(
			await reflectionImpl({ ignorePatterns: ["Run the * skill"] }, defaultOpts),
		);
		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].sessionId, "wildcard-kept");
	});

	it("supports * wildcard matching any characters", async () => {
		await writeSession("star-match", {
			startedAt: new Date().toISOString(),
			endedAt: new Date().toISOString(),
			threadId: "star-match",
			messages: [{ role: "user", content: "foo bar baz", timestamp: new Date().toISOString() }],
		});

		await writeSession("star-no-match", {
			startedAt: new Date().toISOString(),
			endedAt: new Date().toISOString(),
			threadId: "star-no-match",
			messages: [{ role: "user", content: "foo baz", timestamp: new Date().toISOString() }],
		});

		const result = JSON.parse(await reflectionImpl({ ignorePatterns: ["foo * baz"] }, defaultOpts));
		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].sessionId, "star-no-match");
	});

	// --- 3.6: extract only user messages ---

	it("extracts only user messages", async () => {
		await writeSession("multi-role", {
			startedAt: new Date().toISOString(),
			endedAt: new Date().toISOString(),
			threadId: "multi-role",
			messages: [
				{ role: "user", content: "Hello", timestamp: "2026-08-10T10:00:00.000Z" },
				{ role: "assistant", content: "Hi!", timestamp: "2026-08-10T10:00:01.000Z" },
				{ role: "system", content: "System msg", timestamp: "2026-08-10T09:59:59.000Z" },
				{ role: "user", content: "How are you?", timestamp: "2026-08-10T10:00:02.000Z" },
			],
		});

		const result = JSON.parse(await reflectionImpl({}, defaultOpts));
		assert.strictEqual(result[0].userMessages.length, 2);
		assert.strictEqual(result[0].userMessages[0].content, "Hello");
		assert.strictEqual(result[0].userMessages[1].content, "How are you?");
	});

	it("includes session with no user messages (empty array)", async () => {
		await writeSession("no-user-msgs", {
			startedAt: new Date().toISOString(),
			endedAt: new Date().toISOString(),
			threadId: "no-user-msgs",
			messages: [
				{ role: "assistant", content: "Assistant only", timestamp: "2026-08-10T10:00:00.000Z" },
			],
		});

		const result = JSON.parse(await reflectionImpl({}, defaultOpts));
		assert.strictEqual(result.length, 1);
		assert.deepStrictEqual(result[0].userMessages, []);
	});

	// --- 3.7: return structured data format ---

	it("returns structured session data with all required fields", async () => {
		await writeSession("structured-test", {
			startedAt: "2026-08-10T10:00:00.000Z",
			endedAt: "2026-08-10T11:00:00.000Z",
			threadId: "thread-structured",
			messages: [{ role: "user", content: "Test", timestamp: "2026-08-10T10:00:00.000Z" }],
		});

		const result = JSON.parse(await reflectionImpl({}, defaultOpts));
		assert.strictEqual(result.length, 1);
		assert.ok(result[0].sessionId);
		assert.strictEqual(result[0].startedAt, "2026-08-10T10:00:00.000Z");
		assert.ok(Array.isArray(result[0].userMessages));
		assert.strictEqual(result[0].userMessages[0].content, "Test");
		assert.ok(result[0].userMessages[0].timestamp);
	});

	// --- 3.8: handle malformed YAML frontmatter ---

	it("skips malformed YAML frontmatter", async () => {
		await writeMalformedYamlSession(
			"malformed-yaml",
			"{{invalid: yaml: content",
			JSON.stringify([{ role: "user", content: "content", timestamp: "2026-08-10T10:00:00.000Z" }]),
		);

		await writeSession("valid-session", {
			startedAt: new Date().toISOString(),
			endedAt: new Date().toISOString(),
			threadId: "valid-session",
			messages: [{ role: "user", content: "valid", timestamp: new Date().toISOString() }],
		});

		const result = JSON.parse(await reflectionImpl({}, defaultOpts));
		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].sessionId, "valid-session");
	});

	// --- 3.9: handle malformed JSON body ---

	it("skips malformed JSON body", async () => {
		await writeMalformedJsonSession(
			"malformed-json",
			'---\nstartedAt: "2026-08-10T10:00:00.000Z"\nthreadId: "malformed-json"\nmessageCount: 1\n---\n',
			"{ invalid json content",
		);

		await writeSession("valid-json", {
			startedAt: new Date().toISOString(),
			endedAt: new Date().toISOString(),
			threadId: "valid-json",
			messages: [{ role: "user", content: "valid", timestamp: new Date().toISOString() }],
		});

		const result = JSON.parse(await reflectionImpl({}, defaultOpts));
		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].sessionId, "valid-json");
	});

	// --- mtime sorting: only parse top N newest files ---

	it("sorts by mtime and only parses the top 50 files", async () => {
		// Create 55 sessions — only the 50 newest should be parsed
		for (let i = 0; i < 55; i++) {
			await writeSession(`session-${String(i).padStart(3, "0")}`, {
				startedAt: new Date().toISOString(),
				endedAt: new Date().toISOString(),
				threadId: `thread-${i}`,
				messages: [{ role: "user", content: `msg ${i}`, timestamp: new Date().toISOString() }],
			});
			// Small delay to ensure different mtimes
			await new Promise((r) => setTimeout(r, 20));
		}

		const result = JSON.parse(await reflectionImpl({}, defaultOpts));
		assert.ok(result.length <= 50, `Expected at most 50 results, got ${result.length}`);
	});
});

describe("reflectionSessions tool - singleton export", () => {
	it("exports a LangChain Tool with correct name", async () => {
		const { reflectionSessions } = await import("../../src/tools/reflection.js");
		assert.strictEqual(reflectionSessions.name, "reflectionSessions");
	});

	it("exports a LangChain Tool with description", async () => {
		const { reflectionSessions } = await import("../../src/tools/reflection.js");
		assert.ok(reflectionSessions.description.length > 10, "Expected a descriptive description");
	});

	it("exports a LangChain Tool with a zod schema", async () => {
		const { reflectionSessions } = await import("../../src/tools/reflection.js");
		assert.ok(reflectionSessions.schema, "Expected a schema to be defined");
	});
});

describe("reflectionSessions tool - buildToolConfig", () => {
	it("registers reflectionSessions tool with filesystem:read permission", async () => {
		const { buildToolConfig } = await import("../../src/tools/index.js");
		const tools = await buildToolConfig({ permissions: ["filesystem:read"] });
		const toolNames = tools.map((t) => t.name);
		assert.ok(
			toolNames.includes("reflectionSessions"),
			`Expected 'reflectionSessions' tool to be registered, got: ${toolNames.join(", ")}`,
		);
	});

	it("does not register reflectionSessions tool without filesystem:read permission", async () => {
		const { buildToolConfig } = await import("../../src/tools/index.js");
		const tools = await buildToolConfig({ permissions: [] });
		const toolNames = tools.map((t) => t.name);
		assert.ok(
			!toolNames.includes("reflectionSessions"),
			`Expected 'reflectionSessions' tool NOT to be registered, got: ${toolNames.join(", ")}`,
		);
	});
});
