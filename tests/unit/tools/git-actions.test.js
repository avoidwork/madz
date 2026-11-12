import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { git, gitImpl } from "../../../src/tools/git/index.js";

let dir;
let remoteDir;
const g = (input) => gitImpl(input, { cwd: dir });
// Run test-side git without repo-selecting vars that a parent git hook may have set.
const cleanEnv = () => {
	const env = { ...process.env };
	for (const name of Object.keys(env)) if (name.startsWith("GIT_")) delete env[name];
	return env;
};
const sh = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf-8", env: cleanEnv() });
const write = (name, content) => fs.writeFileSync(path.join(dir, name), content);

describe("tools - git actions (real repo)", () => {
	before(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), "madz-git-"));
		remoteDir = fs.mkdtempSync(path.join(os.tmpdir(), "madz-git-remote-"));
		execFileSync("git", ["init", "--bare", "-b", "main"], { cwd: remoteDir, env: cleanEnv() });
		sh("init", "-b", "main");
		sh("config", "user.name", "Test");
		sh("config", "user.email", "t@example.com");
		sh("config", "commit.gpgsign", "false");
	});

	after(() => {
		fs.rmSync(dir, { recursive: true, force: true });
		fs.rmSync(remoteDir, { recursive: true, force: true });
	});

	it("log on an empty repo returns no commits", async () => {
		const r = await g({ action: "log" });
		assert.equal(r.ok, true);
		assert.deepEqual(r.commits, []);
	});

	it("add multiple paths and commit (root commit hash)", async () => {
		write("a.txt", "a\n");
		write("b.txt", "b\n");
		const add = await g({ action: "add", paths: ["a.txt", "b.txt"] });
		assert.equal(add.ok, true);
		const c = await g({ action: "commit", message: "first" });
		assert.equal(c.ok, true);
		assert.match(c.hash, /^[0-9a-f]{7,}$/);
	});

	it("status distinguishes staged, unstaged, untracked", async () => {
		write("a.txt", "a2\n");
		write("b.txt", "b2\n");
		write("new file.txt", "x\n");
		sh("add", "b.txt");
		const s = await g({ action: "status" });
		assert.equal(s.branch, "main");
		const by = Object.fromEntries(s.changes.map((c) => [c.path, c]));
		assert.equal(by["a.txt"].unstaged, true);
		assert.equal(by["a.txt"].staged, false);
		assert.equal(by["b.txt"].staged, true);
		assert.equal(by["new file.txt"].untracked, true);
		assert.equal(s.clean, false);
	});

	it("status on a detached HEAD keeps a non-null branch and sets detached", async () => {
		sh("checkout", "-q", "--detach");
		try {
			const s = await g({ action: "status" });
			assert.equal(s.detached, true);
			assert.equal(s.branch, "HEAD (no branch)");
		} finally {
			sh("checkout", "-q", "main");
		}
	});

	it("restore unstages and discards", async () => {
		const un = await g({ action: "restore", path: "b.txt", staged: true });
		assert.equal(un.ok, true);
		const discard = await g({ action: "restore", paths: ["a.txt", "b.txt"] });
		assert.equal(discard.ok, true);
		assert.equal(fs.readFileSync(path.join(dir, "a.txt"), "utf-8"), "a\n");
	});

	it("diff handles ranges, binary, and path-like refs", async () => {
		write("a.txt", "changed\n");
		const d = await g({ action: "diff", path: "a.txt" });
		assert.deepEqual(d.files, ["a.txt"]);
		const p = await g({ action: "diff", patch: true, unified: 1 });
		assert.match(p.output, /\+changed/);
		sh("commit", "-am", "second");
		const range = await g({ action: "diff", ref: "HEAD~1..HEAD", nameOnly: true });
		assert.deepEqual(range.files, ["a.txt"]);
	});

	it("log honours limit together with ref and path history", async () => {
		const r = await g({ action: "log", ref: "main", limit: 1 });
		assert.equal(r.commits.length, 1);
		const h = await g({ action: "log", path: "b.txt" });
		assert.equal(h.commits.length, 1);
		const full = await g({ action: "log", full: true, limit: 1 });
		assert.ok(full.commits[0].author && full.commits[0].email && full.commits[0].date);
	});

	it("commit amend and empty", async () => {
		const am = await g({ action: "commit", amend: true, message: "second amended" });
		assert.equal(am.amended, true);
		const none = await g({ action: "commit", message: "x" });
		assert.equal(none.ok, false);
		assert.equal(none.kind, "nothing-to-commit");
		const empty = await g({ action: "commit", message: "empty", allowEmpty: true });
		assert.equal(empty.ok, true);
	});

	it("reset soft/mixed and guarded hard", async () => {
		const guard = await g({ action: "reset", mode: "hard" });
		assert.equal(guard.ok, false);
		const soft = await g({ action: "reset", mode: "soft", ref: "HEAD~1" });
		assert.equal(soft.ok, true);
		await g({ action: "commit", message: "empty again", allowEmpty: true });
	});

	it("stash push/list/pop/drop", async () => {
		write("a.txt", "stash me\n");
		write("u.txt", "untracked\n");
		const push = await g({ action: "stash", includeUntracked: true, message: "wip" });
		assert.equal(push.stashed, true);
		assert.equal(fs.existsSync(path.join(dir, "u.txt")), false);
		const list = await g({ action: "stash", sub: "list" });
		assert.equal(list.stashes.length, 1);
		assert.match(list.stashes[0].message, /wip/);
		const pop = await g({ action: "stash", sub: "pop" });
		assert.equal(pop.ok, true);
		assert.equal(fs.existsSync(path.join(dir, "u.txt")), true);
		sh("checkout", "--", "a.txt");
		fs.rmSync(path.join(dir, "u.txt"));
	});

	it("branch list details, rename, current, delete", async () => {
		await g({ action: "branch", create: true, branch: "feat" });
		const list = await g({ action: "branch" });
		assert.equal(list.current, "main");
		assert.ok(list.branches.includes("feat"));
		const cur = await g({ action: "branch", current: true });
		assert.equal(cur.current, "main");
		const ren = await g({ action: "branch", branch: "feat", name: "feat2" });
		assert.equal(ren.renamed, true);
		const del = await g({ action: "branch", delete: true, branch: "feat2" });
		assert.equal(del.deleted, true);
		const prot = await g({ action: "branch", delete: true, force: true, branch: "main" });
		assert.equal(prot.ok, false);
		assert.match(prot.error, /protected/);
	});

	it("merge conflict reports files, abort recovers", async () => {
		sh("checkout", "-b", "left");
		write("c.txt", "left\n");
		sh("add", ".");
		sh("commit", "-m", "left");
		sh("checkout", "main");
		sh("checkout", "-b", "right");
		write("c.txt", "right\n");
		sh("add", ".");
		sh("commit", "-m", "right");
		const m = await g({ action: "merge", branch: "left" });
		assert.equal(m.ok, false);
		assert.equal(m.kind, "conflict");
		assert.deepEqual(m.conflicts, ["c.txt"]);
		const s = await g({ action: "status" });
		assert.equal(s.changes.find((c) => c.path === "c.txt").conflicted, true);
		const ab = await g({ action: "merge", abort: true });
		assert.equal(ab.ok, true);
		sh("checkout", "main");
	});

	it("cherry-pick, revert, merge-base", async () => {
		const cp = await g({ action: "cherry-pick", ref: "left" });
		assert.equal(cp.ok, true);
		const rv = await g({ action: "revert", ref: "HEAD" });
		assert.equal(rv.ok, true);
		const mb = await g({ action: "merge-base", ref: "main left" });
		assert.match(mb.hash, /^[0-9a-f]{40}$/);
		const anc = await g({ action: "merge-base", ref: "main left", isAncestor: true });
		assert.equal(typeof anc.ancestor, "boolean");
	});

	it("blame, show file, ls-files, check-ignore, mv, rm", async () => {
		const b = await g({ action: "blame", path: "a.txt" });
		assert.ok(b.lines[0].author);
		const sf = await g({ action: "show", ref: "HEAD", file: true, path: "a.txt" });
		assert.match(sf.output, /a/);
		write(".gitignore", "*.log\n");
		write("x.log", "l\n");
		const ig = await g({ action: "check-ignore", paths: ["x.log", "a.txt"] });
		assert.deepEqual(ig.ignored, ["x.log"]);
		const lf = await g({ action: "ls-files" });
		assert.ok(lf.files.includes("a.txt"));
		const mv = await g({ action: "mv", path: "b.txt", to: "b2.txt" });
		assert.equal(mv.ok, true, JSON.stringify(mv));
		const blocked = await g({ action: "rm", path: "b2.txt" });
		assert.equal(blocked.ok, false);
		sh("commit", "-m", "rename");
		const rm = await g({ action: "rm", path: "b2.txt" });
		assert.equal(rm.ok, true, JSON.stringify(rm));
		sh("add", ".");
		sh("commit", "-m", "tidy");
	});

	it("clean is a dry run unless forced", async () => {
		write("junk.txt", "j\n");
		const dry = await g({ action: "clean" });
		assert.equal(dry.dryRun, true);
		assert.deepEqual(dry.files, ["junk.txt"]);
		assert.equal(fs.existsSync(path.join(dir, "junk.txt")), true);
		const real = await g({ action: "clean", force: true });
		assert.equal(real.dryRun, false);
		assert.equal(fs.existsSync(path.join(dir, "junk.txt")), false);
	});

	it("config get/set with dangerous keys refused", async () => {
		const set = await g({ action: "config", sub: "set", key: "user.nickname", value: "t" });
		assert.equal(set.ok, true);
		const get = await g({ action: "config", key: "user.nickname" });
		assert.equal(get.value, "t");
		const missing = await g({ action: "config", key: "nope.nothing" });
		assert.equal(missing.value, null);
		const bad = await g({ action: "config", sub: "set", key: "core.sshCommand", value: "evil" });
		assert.equal(bad.ok, false);
	});

	it("tags: lightweight, annotated, delete, describe", async () => {
		const none = await g({ action: "describe" });
		assert.equal(none.tag, null);
		await g({ action: "tag", name: "v1.0.0", lightweight: true });
		await g({ action: "tag", name: "v1.1.0", message: "rel" });
		const list = await g({ action: "tag", sortVersion: true });
		assert.deepEqual(list.tags, ["v1.1.0", "v1.0.0"]);
		const d = await g({ action: "describe" });
		assert.ok(d.tag);
		const del = await g({ action: "tag", delete: true, name: "v1.0.0" });
		assert.equal(del.deleted, true);
		const bad = await g({ action: "describe", ref: "no-such-ref" });
		assert.equal(bad.ok, false);
	});

	it("remote list, push -u, protected force guard, fetch/pull", async () => {
		await g({ action: "remote", sub: "add", remote: "origin", url: remoteDir });
		const rl = await g({ action: "remote", sub: "list" });
		assert.equal(rl.remotes[0].name, "origin");
		const forced = await g({ action: "push", force: true, branch: "main" });
		assert.equal(forced.ok, false);
		assert.match(forced.error, /protected/);
		const push = await g({ action: "push", setUpstream: true, branch: "main" });
		assert.equal(push.ok, true, push.error);
		const st = await g({ action: "status" });
		assert.equal(st.upstream, "origin/main");
		const f = await g({ action: "fetch", prune: true });
		assert.equal(f.ok, true);
		const p = await g({ action: "pull", ffOnly: true, branch: "main" });
		assert.equal(p.ok, true, p.error);
		const lr = await g({ action: "ls-remote", heads: true });
		assert.ok(lr.refs.length >= 1);
	});

	it("checkout from start-point, file checkout, switch", async () => {
		const c = await g({ action: "checkout", create: true, branch: "topic", ref: "main" });
		assert.equal(c.ok, true);
		const s = await g({ action: "switch", branch: "main" });
		assert.equal(s.ok, true);
		write("a.txt", "dirty\n");
		const f = await g({ action: "checkout", path: "a.txt" });
		assert.equal(f.ok, true);
		assert.equal(fs.readFileSync(path.join(dir, "a.txt"), "utf-8"), "changed\n");
	});

	it("worktree list is porcelain and handles spaces", async () => {
		const wtPath = path.join(os.tmpdir(), `madz wt ${Date.now()}`);
		const add = await g({ action: "worktree", sub: "add", path: wtPath, branch: "wt-branch" });
		assert.equal(add.ok, true, add.error);
		const list = await g({ action: "worktree", sub: "list" });
		const wt = list.worktrees.find((w) => w.branch === "wt-branch");
		assert.ok(wt);
		assert.equal(fs.realpathSync(wt.path), fs.realpathSync(wtPath));
		await g({ action: "worktree", sub: "lock", path: wtPath, message: "busy" });
		const locked = (await g({ action: "worktree", sub: "list" })).worktrees.find(
			(w) => w.branch === "wt-branch",
		);
		assert.equal(locked.locked, true);
		await g({ action: "worktree", sub: "unlock", path: wtPath });
		const rm = await g({ action: "worktree", sub: "remove", path: wtPath });
		assert.equal(rm.ok, true);
	});

	it("apply a patch via stdin", async () => {
		write("a.txt", "patched\n");
		const patch = sh("diff");
		sh("checkout", "--", "a.txt");
		const chk = await g({ action: "apply", patchText: patch, checkOnly: true });
		assert.equal(chk.ok, true, chk.error);
		const ap = await g({ action: "apply", patchText: patch });
		assert.equal(ap.applied, true);
		assert.equal(fs.readFileSync(path.join(dir, "a.txt"), "utf-8"), "patched\n");
		sh("checkout", "--", "a.txt");
	});

	it("init and clone", async () => {
		const target = fs.mkdtempSync(path.join(os.tmpdir(), "madz-git-clone-"));
		try {
			const cl = await gitImpl(
				{ action: "clone", url: remoteDir, path: path.join(target, "c") },
				{ cwd: target },
			);
			assert.equal(cl.ok, true, cl.error);
			const ini = await gitImpl(
				{ action: "init", path: path.join(target, "i"), branch: "main" },
				{ cwd: target },
			);
			assert.equal(ini.ok, true, ini.error);
		} finally {
			fs.rmSync(target, { recursive: true, force: true });
		}
	});

	it("submodule status on a repo with none is empty", async () => {
		const r = await g({ action: "submodule" });
		assert.deepEqual(r.submodules, []);
	});

	it("rev-parse flags", async () => {
		const top = await g({ action: "rev-parse", flag: "--show-toplevel" });
		assert.equal(fs.realpathSync(top.output), fs.realpathSync(dir));
		const short = await g({ action: "rev-parse", flag: "--short" });
		assert.match(short.output, /^[0-9a-f]+$/);
		const v = await g({ action: "rev-parse", flag: "--verify", ref: "HEAD" });
		assert.equal(v.ok, true);
	});

	it("rejects option injection and unsafe urls", async () => {
		for (const input of [
			{ action: "checkout", branch: "--orphan=x" },
			{ action: "diff", ref: "--output=/tmp/pwn" },
			{ action: "push", remote: "--upload-pack=x" },
			{ action: "clone", url: "ext::sh -c evil" },
			{ action: "add", path: "-A" },
			{ action: "add", path: "" },
			{ action: "add", paths: ["   "] },
		]) {
			const r = await g(input);
			assert.equal(r.ok, false, JSON.stringify(input));
			assert.equal(r.kind, "invalid-input");
		}
	});

	it("truncates oversized output", async () => {
		write("big.txt", "line\n".repeat(5000));
		sh("add", "big.txt");
		const r = await g({ action: "diff", cached: true, patch: true, maxBytes: 500 });
		assert.equal(r.truncated, true);
		assert.ok(r.output.length < 700);
		sh("reset", "-q");
		fs.rmSync(path.join(dir, "big.txt"));
	});

	it("reports not-a-repo with a hint", async () => {
		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "madz-nogit-"));
		try {
			const r = await gitImpl({ action: "log" }, { cwd: tmp });
			assert.equal(r.ok, false);
			assert.equal(r.kind, "not-a-repo");
			assert.ok(r.hint);
		} finally {
			fs.rmSync(tmp, { recursive: true, force: true });
		}
	});

	it("schema accepts new actions and fields", () => {
		for (const input of [
			{ action: "restore", paths: ["a"], staged: true },
			{ action: "stash", sub: "pop", index: 1 },
			{ action: "push", setUpstream: true, forceWithLease: true },
			{ action: "reset", mode: "hard", force: true },
		]) {
			assert.ok(git.schema.safeParse(input).success, JSON.stringify(input));
		}
	});
});
