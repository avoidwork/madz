import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { mkdtemp, rm, readdir, readFile, writeFile, utimes, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { loadSession } from "../../../src/session/loader.js";
import { saveSession } from "../../../src/session/saver.js";
import { resumeSession } from "../../../src/session/resume.js";
import { isValidSessionId, assertSessionId } from "../../../src/session/sessionId.js";
import { SessionStateManager } from "../../../src/session/stateManager.js";
import { parseFrontmatter } from "../../../src/memory/reader.js";

const SESSIONS = "sessions/";
let root;
let dir;

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "madz-sess-"));
	dir = join(root, "sessions");
	await mkdir(dir);
});
afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

const msgs = [
	{ role: "user", content: "hi", timestamp: "2026-01-01T00:00:00.000Z" },
	{ role: "assistant", content: "hello" },
];

describe("sessionId validation", () => {
	it("accepts uuids and simple ids", () => {
		assert.ok(isValidSessionId(randomUUID()));
		assert.ok(isValidSessionId("abc_DEF-1"));
	});
	it("rejects traversal, odd characters, empty and long ids", () => {
		for (const id of ["../../x", "a/b", 'a"b\nc: d', "a b", "a.md", "", "x".repeat(129), null, 5]) {
			assert.strictEqual(isValidSessionId(id), false, String(id));
			assert.throws(() => assertSessionId(id), /Invalid session ID/);
		}
	});
});

describe("saveSession / loadSession id safety", () => {
	it("rejects traversal ids on save and load and writes nothing outside", async () => {
		await assert.rejects(saveSession(SESSIONS, msgs, "../outside", root), /Invalid session ID/);
		await assert.rejects(loadSession(SESSIONS, 20, "../../etc/passwd", root), /Invalid session ID/);
		assert.ok(!existsSync(join(root, "outside.md")));
		assert.deepStrictEqual(await readdir(dir), []);
	});
	it("rejects quote+newline ids", async () => {
		await assert.rejects(saveSession(SESSIONS, msgs, 'a"b\nc: d', root), /Invalid session ID/);
	});
	it("accepts a uuid and round-trips", async () => {
		const id = randomUUID();
		await saveSession(SESSIONS, msgs, id, root);
		const loaded = await loadSession(SESSIONS, 20, id, root);
		assert.strictEqual(loaded.sessionId, id);
		assert.strictEqual(loaded.conversation.length, 2);
	});
	it("empty threadId still writes unsaved.md", async () => {
		await saveSession(SESSIONS, msgs, "", root);
		assert.ok(existsSync(join(dir, "unsaved.md")));
	});
});

describe("saveSession file handling", () => {
	it("leaves no temp files", async () => {
		await saveSession(SESSIONS, msgs, "s1", root);
		await saveSession(SESSIONS, msgs, "s1", root);
		assert.deepStrictEqual(await readdir(dir), ["s1.md"]);
	});
	it("rethrows and leaves nothing behind when the directory is missing", async () => {
		await assert.rejects(saveSession("nope/", msgs, "s1", root));
		assert.deepStrictEqual(await readdir(root), ["sessions"]);
	});
	it("tolerates null conversation", async () => {
		await saveSession(SESSIONS, null, "s1", root);
		const raw = await readFile(join(dir, "s1.md"), "utf-8");
		assert.ok(raw.includes("messageCount: 0"));
	});
	it("escapes control characters so frontmatter parses back", async () => {
		const ts = "a\r\tb\u0001c";
		await saveSession(SESSIONS, [{ role: "user", content: "x", timestamp: ts }], "s1", root);
		const raw = await readFile(join(dir, "s1.md"), "utf-8");
		// oxlint-disable-next-line no-control-regex -- checking raw controls are escaped
		assert.ok(!/[\r\t\u0001]/.test(raw.split("---")[1]));
		const { frontmatter } = parseFrontmatter(raw);
		assert.strictEqual(frontmatter.startedAt, ts);
		assert.strictEqual(frontmatter.threadId, "s1");
	});
});

describe("loadSession content handling", () => {
	const write = (name, body) => writeFile(join(dir, name), body);

	it("throws a clear error for invalid JSON on an explicit id", async () => {
		await write("bad.md", "---\nthreadId: bad\n---\nnot json");
		await assert.rejects(loadSession(SESSIONS, 20, "bad", root), /corrupt/);
	});
	it("throws for a non-array body", async () => {
		await write("obj.md", '---\nthreadId: obj\n---\n{"a":1}');
		await assert.rejects(loadSession(SESSIONS, 20, "obj", root), /not an array/);
	});
	it("latest skips corrupt files and unsaved.md", async () => {
		await saveSession(SESSIONS, msgs, "good", root);
		await write("bad.md", "garbage");
		await saveSession(SESSIONS, [{ role: "user", content: "u" }], "", root);
		const t1 = new Date(Date.now() + 5000);
		const t2 = new Date(Date.now() + 9000);
		await utimes(join(dir, "bad.md"), t1, t1);
		await utimes(join(dir, "unsaved.md"), t2, t2);
		const loaded = await loadSession(SESSIONS, 20, "", root);
		assert.strictEqual(loaded.sessionId, "good");
	});
	it("returns empty for missing directory and rethrows other readdir errors", async () => {
		const empty = await loadSession("missing/", 20, "", root);
		assert.deepStrictEqual(empty, { sessionId: "", conversation: [], metadata: {} });
		await write("file.txt", "x");
		await assert.rejects(loadSession("sessions/file.txt", 20, "", root));
	});
	it("filters invalid elements and drops leading tool results after windowing", async () => {
		const body = JSON.stringify([
			1,
			null,
			{ content: "no role" },
			{ role: "user", content: "a" },
			{ role: "assistant", content: "b" },
			{ role: "tool", content: "r1" },
			{ role: "tool", content: "r2" },
			{ role: "assistant", content: "c" },
		]);
		await write("w.md", `---\nthreadId: w\n---\n${body}`);
		const loaded = await loadSession(SESSIONS, 3, "w", root);
		assert.deepStrictEqual(
			loaded.conversation.map((m) => m.content),
			["c"],
		);
	});
	it("falls back to the file basename when frontmatter has no id", async () => {
		await write("plain.md", "---\nfoo: 1\n---\n[]");
		const loaded = await loadSession(SESSIONS, 20, "plain", root);
		assert.strictEqual(loaded.sessionId, "plain");
	});
});

describe("resumeSession", () => {
	it("loads into a fresh state under the requested id", async () => {
		await saveSession(SESSIONS, msgs, "abc", root);
		const state = new SessionStateManager({});
		state.addExchange({ role: "user", content: "old" });
		await resumeSession(state, SESSIONS, "abc", root);
		assert.strictEqual(state.getSessionId(), "abc");
		assert.deepStrictEqual(
			state.getConversation().map((m) => m.content),
			["hi", "hello"],
		);
	});
	it("reports a missing session clearly and leaves state untouched", async () => {
		const state = new SessionStateManager({ sessionId: "keep" });
		await assert.rejects(resumeSession(state, SESSIONS, "nope", root), /Session not found: nope/);
		assert.strictEqual(state.getSessionId(), "keep");
	});
	it("rejects invalid ids", async () => {
		const state = new SessionStateManager({});
		await assert.rejects(resumeSession(state, SESSIONS, "../x", root), /Invalid session ID/);
	});
});
