import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { searchSessionImpl } from "../../src/tools/session/index.js";

const testDir = join(process.cwd(), "memory", "__test_search__");
const testSubDir = join("memory", "__test_search__", "conv_sub");

function setup() {
	mkdirSync(testDir, { recursive: true });
	mkdirSync(join(testDir, "conv_sub"), { recursive: true });
}

function teardown() {
	rmSync(testDir, { recursive: true, force: true });
}

describe("searchSession", () => {
	before(setup);
	after(teardown);

	it("browse with no conversations directory returns ok:false error", async () => {
		const result = await searchSessionImpl({}, { sessionsDir: "nonexistent_path/" });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("No conversations directory found"));
	});

	it("browse empty directory lists sessions", async () => {
		const result = await searchSessionImpl({}, { sessionsDir: testSubDir });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("No conversations found"));
	});

	it("searches conversations by query", async () => {
		writeFileSync(
			join(testDir, "conv_sub", "session1.md"),
			"---\nsessionId: abc123\n---\nUser: Hello\nAssistant: Welcome to the session.",
		);
		const result = await searchSessionImpl({ query: "Welcome" }, { sessionsDir: testSubDir });
		assert.strictEqual(result.ok, true);
		assert.ok(
			typeof result.snippets === "string" &&
				(result.snippets.includes("Found") || result.snippets.includes("search")),
		);
	});

	it("searches with no matching query", async () => {
		const result = await searchSessionImpl(
			{ query: "xyz_not_in_any_file_123" },
			{ sessionsDir: testSubDir },
		);
		assert.strictEqual(result.ok, false);
		assert.ok(
			result.error.includes("No conversations matched") ||
				result.error.includes("no conversations matched"),
		);
	});

	it("gets full conversation by matching ID", async () => {
		writeFileSync(
			join(testDir, "conv_sub", "abc123.md"),
			"---\nsessionId: abc123\n---\nUser: Test\nAssistant: Response",
		);
		const result = await searchSessionImpl(
			{ conversationId: "abc123" },
			{ sessionsDir: testSubDir },
		);
		assert.strictEqual(result.ok, true);
		assert.ok(
			typeof result.conversation === "string" &&
				(result.conversation.includes("Conversation") || result.conversation.includes("abc123")),
		);
	});

	it("returns not found when conversation id does not match", async () => {
		const result = await searchSessionImpl(
			{ conversationId: "does_not_match_anything_123_xyz" },
			{ sessionsDir: testSubDir },
		);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("not found"));
	});

	it("browse returns structured conversations with file, date, sessionId, preview", async () => {
		writeFileSync(
			join(testDir, "conv_sub", "browse-test.md"),
			"---\nsessionId: browse-123\n---\ntest content browse",
		);
		const result = await searchSessionImpl({}, { sessionsDir: testSubDir });
		assert.strictEqual(result.ok, true);
		assert.ok(Array.isArray(result.conversations));
		assert.ok(result.conversations.length > 0);
		const conv = result.conversations.find((c) => c.file === "browse-test.md");
		assert.ok(conv);
		assert.strictEqual(conv.sessionId, "browse-123");
		assert.ok(typeof conv.preview === "string");
	});

	it("browse parses body as JSON array for preview", async () => {
		writeFileSync(
			join(testDir, "conv_sub", "json-body.md"),
			'---\nsessionId: json-sess\n---\n[{"role": "user", "content": "Hello world"}]',
		);
		const result = await searchSessionImpl({}, { sessionsDir: testSubDir });
		assert.strictEqual(result.ok, true);
		const jsonEntry = result.conversations.find((c) => c.file === "json-body.md");
		assert.ok(jsonEntry);
		// The preview should come from parsed[0].content
		assert.ok(jsonEntry.preview.includes("Hello world"));
	});
});
