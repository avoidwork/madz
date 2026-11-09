import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertPathAllowed, resolvePath } from "../../src/sandbox/pathResolver.js";
import { validatePath } from "../../src/tools/common.js";

let root;
let outside;

describe("sandbox - symlink resolution", () => {
	before(() => {
		root = realpathSync(mkdtempSync(join(tmpdir(), "madz-sb-")));
		outside = realpathSync(mkdtempSync(join(tmpdir(), "madz-sb-out-")));
		mkdirSync(join(root, "private"));
		writeFileSync(join(root, "ok.txt"), "ok");
		writeFileSync(join(outside, "secret.txt"), "s");
		symlinkSync(outside, join(root, "escape"));
		symlinkSync(join(outside, "secret.txt"), join(root, "secret-link"));
		symlinkSync(join(root, "private"), join(root, "to-private"));
		symlinkSync(root, join(tmpdir(), `madz-sb-rootlink-${process.pid}`));
	});
	after(() => {
		rmSync(root, { recursive: true, force: true });
		rmSync(outside, { recursive: true, force: true });
		rmSync(join(tmpdir(), `madz-sb-rootlink-${process.pid}`), { force: true });
	});

	it("denies a symlink that resolves outside the allowed directory", () => {
		assert.strictEqual(resolvePath(join(root, "escape", "secret.txt"), [root]).allowed, false);
		assert.strictEqual(resolvePath(join(root, "secret-link"), [root]).allowed, false);
	});

	it("denies a not-yet-existing file below an escaping symlink", () => {
		assert.strictEqual(resolvePath(join(root, "escape", "new", "deep.txt"), [root]).allowed, false);
	});

	it("allows ordinary and in-sandbox symlinked paths, and returns the real path", () => {
		assert.strictEqual(resolvePath(join(root, "ok.txt"), [root]).allowed, true);
		assert.strictEqual(resolvePath(join(root, "new", "file.txt"), [root]).allowed, true);
		const r = resolvePath(join(root, "to-private", "x.txt"), [root]);
		assert.strictEqual(r.allowed, true);
		assert.strictEqual(r.realPath, join(root, "private", "x.txt"));
	});

	it("matches the sandbox rule itself when it is reached through a symlink", () => {
		const rootLink = join(tmpdir(), `madz-sb-rootlink-${process.pid}`);
		assert.strictEqual(resolvePath(join(rootLink, "ok.txt"), [root]).allowed, true);
		assert.strictEqual(resolvePath(join(root, "ok.txt"), [rootLink]).allowed, true);
	});

	it("applies negative rules to the real location of a symlink", () => {
		const rules = [root, `!${join(root, "private")}`];
		assert.strictEqual(resolvePath(join(root, "private", "a.txt"), rules).allowed, false);
		assert.strictEqual(resolvePath(join(root, "to-private", "a.txt"), rules).allowed, false);
		assert.strictEqual(resolvePath(join(root, "ok.txt"), rules).allowed, true);
	});

	it("noFollow checks the link itself so it can be removed", () => {
		assert.strictEqual(
			resolvePath(join(root, "secret-link"), [root], { noFollow: true }).allowed,
			true,
		);
		assert.strictEqual(
			resolvePath(join(root, "escape", "secret.txt"), [root], { noFollow: true }).allowed,
			false,
		);
	});

	it("fails closed on a symlink loop", () => {
		symlinkSync(join(root, "loop-b"), join(root, "loop-a"));
		symlinkSync(join(root, "loop-a"), join(root, "loop-b"));
		assert.strictEqual(resolvePath(join(root, "loop-a"), [root]).allowed, false);
	});

	it("still rejects with no rules and traversal", () => {
		assert.strictEqual(resolvePath(join(root, "ok.txt"), []).allowed, false);
		assert.strictEqual(resolvePath(join(root, "..", "etc", "passwd"), [root]).allowed, false);
	});

	it("validatePath exposes realPath and forwards options", () => {
		const ok = validatePath(join(root, "to-private", "x"), [root]);
		assert.strictEqual(ok.allowed, true);
		assert.strictEqual(ok.realPath, join(root, "private", "x"));
		assert.strictEqual(validatePath(join(root, "secret-link"), [root]).allowed, false);
		assert.strictEqual(
			validatePath(join(root, "secret-link"), [root], { noFollow: true }).allowed,
			true,
		);
	});

	it("assertPathAllowed throws for an escaping symlink", () => {
		assert.throws(() => assertPathAllowed(join(root, "escape", "secret.txt"), [root]), {
			name: "AccessDeniedError",
		});
	});
});
