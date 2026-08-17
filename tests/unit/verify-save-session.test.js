import { strictEqual } from "node:assert";
import { rmSync, existsSync, mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const TEST_DIR = "memory/__test_verify_save_session/";

rmSync(join(process.cwd(), TEST_DIR), { recursive: true, force: true });
mkdirSync(join(process.cwd(), TEST_DIR), { recursive: true });

const { saveSession } = await import("../../src/session/saver.js");

const conversation = [
	{ role: "user", content: "hello", timestamp: "2026-08-17T10:00:00.000Z" },
	{ role: "assistant", content: "hi there", timestamp: "2026-08-17T10:00:01.000Z" },
];

await saveSession(TEST_DIR, conversation, "verify-thread");

const fullPath = join(process.cwd(), TEST_DIR, "verify-thread.md");
strictEqual(existsSync(fullPath), true, "session file should exist");

const content = await readFile(fullPath, "utf-8");
strictEqual(content.includes("verify-thread"), true, "should contain threadId in frontmatter");
strictEqual(content.includes('"role": "user"'), true, "should contain user message");
strictEqual(content.includes('"role": "assistant"'), true, "should contain assistant message");

rmSync(join(process.cwd(), TEST_DIR), { recursive: true, force: true });

console.log("PASS — saveSession works correctly");