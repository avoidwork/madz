import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { sessionSearchImpl } from "../../src/tools/sessionSearch.js";

const testDir = join(process.cwd(), "memory", "__test_search__");
const testSubDir = join("memory", "__test_search__", "conv_sub");

function setup() {
	mkdirSync(testDir, { recursive: true });
	mkdirSync(join(testDir, "conv_sub"), { recursive: true });
}

function teardown() {
	rmSync(testDir, { recursive: true, force: true });
}

describe("sessionSearch", () => {
	before(setup);
	after(teardown);

	it("browse with no conversations directory returns missing message", async () => {
		const result = await sessionSearchImpl({}, { conversationsDir: "nonexistent_path/" });
		assert.ok(result.includes("No conversations directory found"));
	});

	it("browse empty directory lists sessions", async () => {
		const result = await sessionSearchImpl({}, { conversationsDir: testSubDir });
		assert.ok(typeof result === "string");
	});

	it("searches conversations by query", async () => {
		writeFileSync(
			join(testDir, "conv_sub", "session1.md"),
			"---\nsessionId: abc123\n---\nUser: Hello\nAssistant: Welcome to the session.",
		);
		const result = await sessionSearchImpl({ query: "Welcome" }, { conversationsDir: testSubDir });
		assert.ok(
			typeof result === "string" && (result.includes("Found") || result.includes("search")),
		);
	});

	it("searches with no matching query", async () => {
		const result = await sessionSearchImpl(
			{ query: "xyz_not_in_any_file_123" },
			{ conversationsDir: testSubDir },
		);
		assert.ok(
			typeof result === "string" &&
				(result.includes("No conversations matched") ||
					result.includes("no conversations matched")),
		);
	});

	it("gets full conversation by matching ID", async () => {
		writeFileSync(
			join(testDir, "conv_sub", "abc123.md"),
			"---\nsessionId: abc123\n---\nUser: Test\nAssistant: Response",
		);
		const result = await sessionSearchImpl(
			{ conversationId: "abc123" },
			{ conversationsDir: testSubDir },
		);
		assert.ok(
			typeof result === "string" && (result.includes("Conversation") || result.includes("abc123")),
		);
	});

	it("returns not found when conversation id does not match", async () => {
		const result = await sessionSearchImpl(
			{ conversationId: "does_not_match_anything_123_xyz" },
			{ conversationsDir: testSubDir },
		);
		assert.ok(typeof result === "string" && result.includes("not found"));
	});
});
