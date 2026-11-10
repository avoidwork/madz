import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	symlinkSync,
	writeFileSync,
	chmodSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	appendImpl,
	copyImpl,
	deleteImpl,
	editImpl,
	fileImpl,
	file,
	listImpl,
	mkdirImpl,
	moveImpl,
	readImpl,
	writeImpl,
} from "../../../../src/tools/file/index.js";

let root;
let outside;
const opts = () => ({ allowedPaths: [root], maxReadSize: 1024 * 1024 });
const p = (name) => join(root, name);
const edit = (name, input) => editImpl({ path: p(name), ...input }, opts());

describe("tools - file actions", () => {
	before(() => {
		root = mkdtempSync(join(tmpdir(), "madz-file-"));
		outside = mkdtempSync(join(tmpdir(), "madz-file-out-"));
	});
	after(() => {
		rmSync(root, { recursive: true, force: true });
		rmSync(outside, { recursive: true, force: true });
	});

	describe("edit", () => {
		it("refuses an ambiguous match and reports the line numbers", async () => {
			writeFileSync(p("dup.js"), "const a = 1;\nconst a = 1;\n");
			const r = await edit("dup.js", { oldString: "const a = 1;", newString: "X" });
			assert.strictEqual(r.ok, false);
			assert.match(r.error, /2 matches.*lines 1, 2/);
			assert.deepStrictEqual(r.matches, [1, 2]);
			assert.strictEqual(readFileSync(p("dup.js"), "utf-8"), "const a = 1;\nconst a = 1;\n");
		});

		it("replaceAll replaces every occurrence", async () => {
			writeFileSync(p("all.js"), "a\nb\na\n");
			const r = await edit("all.js", { oldString: "a", newString: "Z", replaceAll: true });
			assert.strictEqual(r.ok, true);
			assert.strictEqual(r.changes, 2);
			assert.strictEqual(readFileSync(p("all.js"), "utf-8"), "Z\nb\nZ\n");
		});

		it("does not edit text that differs only by case", async () => {
			writeFileSync(p("case.js"), "const Foo = 1;\n");
			const r = await edit("case.js", { oldString: "const foo = 1;", newString: "x" });
			assert.strictEqual(r.ok, false);
			assert.strictEqual(readFileSync(p("case.js"), "utf-8"), "const Foo = 1;\n");
		});

		it("applies whitespace-tolerant matches without corrupting the file", async () => {
			writeFileSync(p("ws.js"), "if (x) {\n    a();   \n    b();\n}\n");
			const r = await edit("ws.js", { oldString: "  a();  \n  b();", newString: "REPLACED" });
			assert.strictEqual(r.ok, true);
			assert.strictEqual(r.fuzzy, true);
			assert.strictEqual(readFileSync(p("ws.js"), "utf-8"), "if (x) {\nREPLACED\n}\n");
		});

		it("reports fuzzy: false for an exact match", async () => {
			writeFileSync(p("exact.txt"), "alpha beta");
			const r = await edit("exact.txt", { oldString: "beta", newString: "gamma" });
			assert.strictEqual(r.fuzzy, false);
		});

		it("rejects missing or empty inputs instead of writing 'undefined'", async () => {
			writeFileSync(p("req.txt"), "hello\n");
			assert.match((await edit("req.txt", { oldString: "hello" })).error, /newString/);
			assert.match((await edit("req.txt", { newString: "x" })).error, /oldString/);
			assert.match((await edit("req.txt", { oldString: "", newString: "x" })).error, /oldString/);
			assert.strictEqual(readFileSync(p("req.txt"), "utf-8"), "hello\n");
		});

		it("keeps CRLF line endings for inserted text", async () => {
			writeFileSync(p("crlf.txt"), "a\r\nb\r\nc\r\n");
			await edit("crlf.txt", { oldString: "b", newString: "B\nB2" });
			assert.strictEqual(readFileSync(p("crlf.txt"), "utf-8"), "a\r\nB\r\nB2\r\nc\r\n");
		});

		it("returns numbered suggestions when nothing matches", async () => {
			writeFileSync(p("sug.js"), "alpha\nconst valu = 1;\nomega\n");
			const r = await edit("sug.js", { oldString: "const value = 1;", newString: "x" });
			assert.strictEqual(r.ok, false);
			assert.deepStrictEqual(r.suggestions, ["2: const valu = 1;"]);
		});

		it("dryRun returns the diff without writing", async () => {
			writeFileSync(p("dry.txt"), "one\ntwo\nthree\n");
			const r = await edit("dry.txt", { oldString: "two", newString: "TWO", dryRun: true });
			assert.strictEqual(r.ok, true);
			assert.strictEqual(r.dryRun, true);
			assert.match(r.diff, /-two/);
			assert.match(r.diff, /\+TWO/);
			assert.strictEqual(readFileSync(p("dry.txt"), "utf-8"), "one\ntwo\nthree\n");
		});

		it("diff hunks carry real file line numbers and context", async () => {
			writeFileSync(p("ln.txt"), Array.from({ length: 20 }, (_, i) => `l${i + 1}`).join("\n"));
			const r = await edit("ln.txt", { oldString: "l15", newString: "X", dryRun: true });
			assert.match(r.diff, /^--- a\/ln\.txt\n\+\+\+ b\/ln\.txt\n/);
			assert.match(r.diff, /@@ -12,7 \+12,7 @@/);
			assert.match(r.diff, /-l15\n\+X/);
		});

		it("diff shows an insertion as a pure addition, not a rewrite", async () => {
			writeFileSync(p("ins-diff.txt"), "a\nb\n");
			const r = await edit("ins-diff.txt", {
				startLine: 1,
				endLine: 0,
				newString: "N",
				dryRun: true,
			});
			assert.deepStrictEqual(r.diff.split("\n").slice(2), ["@@ -1,2 +1,3 @@", "+N", " a", " b"]);
		});

		it("diff shows a deletion as a pure removal", async () => {
			writeFileSync(p("del-diff.txt"), "a\nb\nc\n");
			const r = await edit("del-diff.txt", { oldString: "b\n", newString: "", dryRun: true });
			assert.deepStrictEqual(r.diff.split("\n").slice(2), ["@@ -1,3 +1,2 @@", " a", "-b", " c"]);
		});

		it("diff splits distant changes into separate hunks", async () => {
			writeFileSync(
				p("far.txt"),
				Array.from({ length: 40 }, (_, i) => `line-${i + 1}-end`).join("\n"),
			);
			const r = await edit("far.txt", {
				edits: [
					{ oldString: "line-3-end", newString: "CHANGED-3" },
					{ oldString: "line-38-end", newString: "CHANGED-38" },
				],
				dryRun: true,
			});
			assert.strictEqual(r.diff.split("\n").filter((l) => l.startsWith("@@")).length, 2);
		});

		it("diff covers replaceAll across the whole file", async () => {
			writeFileSync(p("ra-diff.txt"), "x\nmid\nx\n");
			const r = await edit("ra-diff.txt", { oldString: "x", newString: "Y", replaceAll: true });
			assert.strictEqual(r.changes, 2);
			assert.strictEqual(r.diff.split("\n").filter((l) => l.startsWith("-x")).length, 2);
			assert.strictEqual(r.diff.split("\n").filter((l) => l.startsWith("+Y")).length, 2);
		});

		it("diff handles a missing trailing newline and large rewrites", async () => {
			writeFileSync(p("nonl.txt"), "a\nb");
			const r = await edit("nonl.txt", { oldString: "b", newString: "c", dryRun: true });
			assert.match(r.diff, /\\ No newline at end of file/);
			const big = Array.from({ length: 3000 }, (_, i) => `a${i}`).join("\n");
			writeFileSync(p("big-diff.txt"), big);
			const rewrite = await edit("big-diff.txt", {
				oldString: big,
				newString: big.replace(/a/g, "b"),
				dryRun: true,
			});
			assert.strictEqual(rewrite.ok, true);
			assert.strictEqual(rewrite.diff.split("\n").filter((l) => l.startsWith("-a")).length, 3000);
		});

		it("diff leaves no temporary directory behind", async () => {
			// Private TMPDIR so edits running in parallel test processes cannot interfere.
			const savedTmp = process.env.TMPDIR;
			const privateTmp = mkdtempSync(join(tmpdir(), "madz-diff-probe-"));
			process.env.TMPDIR = privateTmp;
			try {
				writeFileSync(p("tmpclean.txt"), "one\n");
				await edit("tmpclean.txt", { oldString: "one", newString: "two" });
				await edit("tmpclean.txt", { oldString: "nothing-here", newString: "x" });
				assert.deepStrictEqual(readdirSync(privateTmp), []);
			} finally {
				if (savedTmp === undefined) delete process.env.TMPDIR;
				else process.env.TMPDIR = savedTmp;
				rmSync(privateTmp, { recursive: true, force: true });
			}
		});

		it("reports a clear error when the diff binary is missing", async () => {
			writeFileSync(p("nodiff.txt"), "one\n");
			const savedPath = process.env.PATH;
			process.env.PATH = "/nonexistent";
			try {
				const r = await edit("nodiff.txt", { oldString: "one", newString: "two" });
				assert.strictEqual(r.ok, false);
				assert.match(r.error, /diff' command is not installed/);
				assert.strictEqual(readFileSync(p("nodiff.txt"), "utf-8"), "one\n");
			} finally {
				process.env.PATH = savedPath;
			}
		});

		it("replaces a line range", async () => {
			writeFileSync(p("range.txt"), "a\nb\nc\nd\n");
			const r = await edit("range.txt", { startLine: 2, endLine: 3, newString: "X" });
			assert.strictEqual(r.ok, true);
			assert.strictEqual(readFileSync(p("range.txt"), "utf-8"), "a\nX\nd\n");
		});

		it("inserts before a line with endLine = startLine - 1", async () => {
			writeFileSync(p("ins.txt"), "a\nb\n");
			await edit("ins.txt", { startLine: 2, endLine: 1, newString: "NEW" });
			assert.strictEqual(readFileSync(p("ins.txt"), "utf-8"), "a\nNEW\nb\n");
		});

		it("appends past the last line and rejects invalid ranges", async () => {
			writeFileSync(p("rng.txt"), "a\nb\n");
			await edit("rng.txt", { startLine: 3, endLine: 2, newString: "c" });
			assert.strictEqual(readFileSync(p("rng.txt"), "utf-8"), "a\nb\nc\n");
			assert.match(
				(await edit("rng.txt", { startLine: 9, newString: "x" })).error,
				/invalid line range/,
			);
			assert.match(
				(await edit("rng.txt", { startLine: 1, endLine: 9, newString: "x" })).error,
				/past the last line/,
			);
		});

		it("applies multiple edits in order, all-or-nothing", async () => {
			writeFileSync(p("multi.txt"), "one two three");
			const r = await edit("multi.txt", {
				edits: [
					{ oldString: "one", newString: "1" },
					{ oldString: "three", newString: "3" },
				],
			});
			assert.strictEqual(r.ok, true);
			assert.strictEqual(r.changes, 2);
			assert.strictEqual(readFileSync(p("multi.txt"), "utf-8"), "1 two 3");

			const bad = await edit("multi.txt", {
				edits: [
					{ oldString: "1", newString: "ONE" },
					{ oldString: "missing", newString: "x" },
				],
			});
			assert.strictEqual(bad.ok, false);
			assert.match(bad.error, /edits\[1\]/);
			assert.strictEqual(readFileSync(p("multi.txt"), "utf-8"), "1 two 3");
		});

		it("rejects an empty edits array and a missing file", async () => {
			writeFileSync(p("e.txt"), "x");
			assert.strictEqual((await edit("e.txt", { edits: [] })).ok, false);
			const r = await edit("nope.txt", { oldString: "a", newString: "b" });
			assert.strictEqual(r.ok, false);
			assert.match(r.error, /File not found/);
		});

		it("refuses to edit a directory or a binary file", async () => {
			mkdirSync(p("adir"), { recursive: true });
			assert.match((await edit("adir", { oldString: "a", newString: "b" })).error, /directory/);
			writeFileSync(p("b.bin"), Buffer.from([1, 0, 2]));
			assert.match((await edit("b.bin", { oldString: "a", newString: "b" })).error, /binary/);
		});

		it("preserves the file mode", async () => {
			writeFileSync(p("mode.sh"), "echo a\n");
			chmodSync(p("mode.sh"), 0o755);
			await edit("mode.sh", { oldString: "a", newString: "b" });
			assert.strictEqual(statSync(p("mode.sh")).mode & 0o777, 0o755);
		});
	});

	describe("read", () => {
		const text = Array.from({ length: 10 }, (_, i) => `l${i + 1}`).join("\n");

		it("offset alone returns the remaining lines without full content", async () => {
			writeFileSync(p("r.txt"), text);
			const r = await readImpl({ path: p("r.txt"), offset: 7 }, opts());
			assert.deepStrictEqual(r.lines, ["8|l8", "9|l9", "10|l10"]);
			assert.strictEqual(r.content, undefined);
			assert.strictEqual(r.totalLines, 10);
			assert.strictEqual(r.hasMore, false);
		});

		it("limit alone returns the first lines and flags more", async () => {
			const r = await readImpl({ path: p("r.txt"), limit: 3 }, opts());
			assert.deepStrictEqual(r.lines, ["1|l1", "2|l2", "3|l3"]);
			assert.strictEqual(r.hasMore, true);
		});

		it("paginates a file larger than the whole-file limit", async () => {
			writeFileSync(p("large.txt"), "line\n".repeat(300_000));
			const small = { allowedPaths: [root], maxReadSize: 100 * 1024 };
			assert.strictEqual((await readImpl({ path: p("large.txt") }, small)).ok, false);
			const page = await readImpl({ path: p("large.txt"), offset: 10, limit: 2 }, small);
			assert.strictEqual(page.ok, true);
			assert.deepStrictEqual(page.lines, ["11|line", "12|line"]);
		});

		it("refuses binary files and directories with guidance", async () => {
			writeFileSync(p("bin.dat"), Buffer.from([0, 1, 2]));
			assert.match((await readImpl({ path: p("bin.dat") }, opts())).error, /binary/);
			mkdirSync(p("rd"), { recursive: true });
			assert.match((await readImpl({ path: p("rd") }, opts())).error, /list action/);
		});

		it("suggests a similar file, including a different extension", async () => {
			writeFileSync(p("foo.js"), "x");
			const r = await readImpl({ path: p("foo.ts") }, opts());
			assert.match(r.error, /Did you mean: .*foo\.js/);
		});
	});

	describe("write / append", () => {
		it("returns the resolved path for relative input", async () => {
			const r = await writeImpl({ path: p("w.txt"), content: "x" }, opts());
			assert.strictEqual(r.path, p("w.txt"));
		});

		it("requires content and never throws", async () => {
			const r = await writeImpl({ path: p("w2.txt") }, opts());
			assert.strictEqual(r.ok, false);
			assert.match(r.error, /content/);
			assert.strictEqual(existsSync(p("w2.txt")), false);
		});

		it("requires a path (does not default to the base directory)", async () => {
			const r = await writeImpl({ content: "x" }, opts());
			assert.strictEqual(r.ok, false);
			assert.match(r.error, /path/);
		});

		it("returns an error when the target is a directory or the parent is a file", async () => {
			mkdirSync(p("wdir"), { recursive: true });
			assert.match((await writeImpl({ path: p("wdir"), content: "x" }, opts())).error, /directory/);
			writeFileSync(p("afile"), "x");
			assert.strictEqual(
				(await writeImpl({ path: p("afile/child"), content: "x" }, opts())).ok,
				false,
			);
		});

		it("leaves no temp files behind and keeps the mode of an existing file", async () => {
			writeFileSync(p("atomic.sh"), "old");
			chmodSync(p("atomic.sh"), 0o750);
			await writeImpl({ path: p("atomic.sh"), content: "new" }, opts());
			assert.strictEqual(readFileSync(p("atomic.sh"), "utf-8"), "new");
			assert.strictEqual(statSync(p("atomic.sh")).mode & 0o777, 0o750);
			const listing = await listImpl({ path: root }, opts());
			assert.ok(!listing.entries.some((e) => e.path.endsWith(".tmp")));
		});

		it("appends, creating the file when needed", async () => {
			await appendImpl({ path: p("log.txt"), content: "a\n" }, opts());
			await appendImpl({ path: p("log.txt"), content: "b\n" }, opts());
			assert.strictEqual(readFileSync(p("log.txt"), "utf-8"), "a\nb\n");
			assert.match((await appendImpl({ path: p("log.txt") }, opts())).error, /content/);
			const big = await appendImpl({ path: p("log.txt"), content: "x".repeat(600 * 1024) }, opts());
			assert.match(big.error, /exceeds maximum/);
		});
	});

	describe("delete / list / mkdir", () => {
		it("delete refuses a directory unless recursive", async () => {
			mkdirSync(p("d1/inner"), { recursive: true });
			writeFileSync(p("d1/inner/f.txt"), "x");
			const r = await deleteImpl({ path: p("d1") }, opts());
			assert.strictEqual(r.ok, false);
			assert.match(r.error, /recursive: true/);
			assert.strictEqual((await deleteImpl({ path: p("d1"), recursive: true }, opts())).ok, true);
			assert.strictEqual(existsSync(p("d1")), false);
		});

		it("delete requires a path and refuses the sandbox root", async () => {
			assert.match((await deleteImpl({}, opts())).error, /path/);
			const r = await deleteImpl({ path: root, recursive: true }, opts());
			assert.strictEqual(r.ok, false);
			assert.match(r.error, /protected/);
			assert.ok(existsSync(root));
		});

		it("list returns entries, supports recursion, and skips node_modules", async () => {
			mkdirSync(p("tree/sub"), { recursive: true });
			mkdirSync(p("tree/node_modules/pkg"), { recursive: true });
			writeFileSync(p("tree/a.txt"), "abc");
			writeFileSync(p("tree/sub/b.txt"), "b");
			writeFileSync(p("tree/node_modules/pkg/x.js"), "x");
			const flat = await listImpl({ path: p("tree") }, opts());
			assert.deepStrictEqual(flat.entries.map((e) => e.path).sort(), [
				"a.txt",
				"node_modules",
				"sub",
			]);
			assert.strictEqual(flat.entries.find((e) => e.path === "a.txt").size, 3);
			const deep = await listImpl({ path: p("tree"), recursive: true }, opts());
			const paths = deep.entries.map((e) => e.path);
			assert.ok(paths.includes("sub/b.txt"));
			assert.ok(!paths.some((q) => q.includes("pkg")));
		});

		it("list rejects files and defaults to the base directory", async () => {
			writeFileSync(p("lf.txt"), "x");
			assert.match((await listImpl({ path: p("lf.txt") }, opts())).error, /not a directory/);
			const r = await listImpl({}, { allowedPaths: [process.cwd()] });
			assert.strictEqual(r.ok, true);
			assert.ok(r.entries.some((e) => e.path === "package.json"));
		});

		it("mkdir creates nested directories", async () => {
			const r = await mkdirImpl({ path: p("m/n/o") }, opts());
			assert.strictEqual(r.ok, true);
			assert.ok(statSync(p("m/n/o")).isDirectory());
			assert.match((await mkdirImpl({}, opts())).error, /path/);
		});
	});

	describe("move / copy", () => {
		it("moves a file and creates the destination directory", async () => {
			writeFileSync(p("mv-src.txt"), "data");
			const r = await moveImpl({ path: p("mv-src.txt"), to: p("mv/dest/out.txt") }, opts());
			assert.strictEqual(r.ok, true);
			assert.strictEqual(existsSync(p("mv-src.txt")), false);
			assert.strictEqual(readFileSync(p("mv/dest/out.txt"), "utf-8"), "data");
		});

		it("refuses to clobber an existing destination unless overwrite is set", async () => {
			writeFileSync(p("src1.txt"), "new");
			writeFileSync(p("dst1.txt"), "old");
			const blocked = await moveImpl({ path: p("src1.txt"), to: p("dst1.txt") }, opts());
			assert.strictEqual(blocked.ok, false);
			assert.match(blocked.error, /overwrite: true/);
			assert.strictEqual(readFileSync(p("dst1.txt"), "utf-8"), "old");
			const ok = await moveImpl(
				{ path: p("src1.txt"), to: p("dst1.txt"), overwrite: true },
				opts(),
			);
			assert.strictEqual(ok.ok, true);
			assert.strictEqual(readFileSync(p("dst1.txt"), "utf-8"), "new");
		});

		it("copies files and directories, keeping the source", async () => {
			mkdirSync(p("cp-src/sub"), { recursive: true });
			writeFileSync(p("cp-src/sub/f.txt"), "f");
			const r = await copyImpl({ path: p("cp-src"), to: p("cp-dst") }, opts());
			assert.strictEqual(r.ok, true);
			assert.strictEqual(readFileSync(p("cp-dst/sub/f.txt"), "utf-8"), "f");
			assert.ok(existsSync(p("cp-src/sub/f.txt")));
			writeFileSync(p("one.txt"), "1");
			assert.strictEqual(
				(await copyImpl({ path: p("one.txt"), to: p("two.txt") }, opts())).ok,
				true,
			);
		});

		it("validates inputs: missing to, same path, missing source, protected root", async () => {
			writeFileSync(p("v.txt"), "x");
			assert.match((await moveImpl({ path: p("v.txt") }, opts())).error, /'to'/);
			assert.match((await copyImpl({ path: p("v.txt"), to: p("v.txt") }, opts())).error, /same/);
			assert.strictEqual((await moveImpl({ path: p("ghost"), to: p("g2") }, opts())).ok, false);
			const r = await moveImpl({ path: root, to: p("elsewhere") }, opts());
			assert.match(r.error, /protected/);
		});

		it("validates both ends against the sandbox", async () => {
			writeFileSync(p("in.txt"), "x");
			const out = await moveImpl({ path: p("in.txt"), to: join(outside, "stolen.txt") }, opts());
			assert.match(out.error, /Access denied/);
			assert.ok(existsSync(p("in.txt")));
			const r = await copyImpl({ path: join(outside, "x"), to: p("y") }, opts());
			assert.match(r.error, /Access denied/);
		});
	});

	describe("sandbox and symlinks", () => {
		before(() => {
			writeFileSync(join(outside, "secret.txt"), "SECRET");
			symlinkSync(outside, p("link"));
			symlinkSync(join(outside, "secret.txt"), p("filelink"));
			symlinkSync(join(outside, "newfile.txt"), p("dangling"));
			writeFileSync(p("inside.txt"), "ok");
			symlinkSync(p("inside.txt"), p("goodlink"));
		});

		it("blocks reading, writing and deleting through a directory symlink", async () => {
			assert.match((await readImpl({ path: p("link/secret.txt") }, opts())).error, /Access denied/);
			assert.match(
				(await writeImpl({ path: p("link/pwn.txt"), content: "x" }, opts())).error,
				/Access denied/,
			);
			assert.strictEqual(existsSync(join(outside, "pwn.txt")), false);
			assert.match(
				(await deleteImpl({ path: p("link/secret.txt") }, opts())).error,
				/Access denied/,
			);
			assert.ok(existsSync(join(outside, "secret.txt")));
		});

		it("blocks a file symlink and a dangling symlink that point outside", async () => {
			assert.match((await readImpl({ path: p("filelink") }, opts())).error, /Access denied/);
			const w = await writeImpl({ path: p("dangling"), content: "y" }, opts());
			assert.match(w.error, /Access denied/);
			assert.strictEqual(existsSync(join(outside, "newfile.txt")), false);
		});

		it("blocks edits and appends through an outside symlink", async () => {
			const e = await editImpl(
				{ path: p("filelink"), oldString: "SECRET", newString: "x" },
				opts(),
			);
			assert.match(e.error, /Access denied/);
			assert.strictEqual(readFileSync(join(outside, "secret.txt"), "utf-8"), "SECRET");
			assert.match(
				(await appendImpl({ path: p("filelink"), content: "x" }, opts())).error,
				/Access denied/,
			);
		});

		it("deleting a symlink removes the link, not its target", async () => {
			symlinkSync(join(outside, "secret.txt"), p("tmplink"));
			const r = await deleteImpl({ path: p("tmplink") }, opts());
			assert.strictEqual(r.ok, true);
			assert.strictEqual(existsSync(p("tmplink")), false);
			assert.ok(existsSync(join(outside, "secret.txt")));
		});

		it("allows a symlink that stays inside the sandbox", async () => {
			const r = await readImpl({ path: p("goodlink") }, opts());
			assert.strictEqual(r.ok, true);
			assert.strictEqual(r.content, "ok");
		});

		it("fails closed on a symlink loop", async () => {
			symlinkSync(p("loop-b"), p("loop-a"));
			symlinkSync(p("loop-a"), p("loop-b"));
			assert.match((await readImpl({ path: p("loop-a") }, opts())).error, /Access denied/);
		});
	});

	describe("dispatch and schema", () => {
		it("dispatches every action and rejects unknown or inherited names", async () => {
			assert.strictEqual((await fileImpl({ action: "mkdir", path: p("disp") }, opts())).ok, true);
			assert.match((await fileImpl({ action: "toString" }, opts())).error, /Unknown action/);
			assert.match((await fileImpl({ action: "ls" }, opts())).error, /Valid actions: read, write/);
		});

		it("schema accepts the new actions and fields", () => {
			for (const input of [
				{ action: "append", path: "a", content: "x" },
				{ action: "list", recursive: true },
				{ action: "move", path: "a", to: "b", overwrite: true },
				{ action: "copy", path: "a", to: "b" },
				{ action: "mkdir", path: "a" },
				{ action: "edit", path: "a", startLine: 1, endLine: 2, newString: "x" },
				{
					action: "edit",
					path: "a",
					edits: [{ oldString: "a", newString: "b", replaceAll: true }],
					dryRun: true,
				},
			]) {
				assert.ok(file.schema.safeParse(input).success, JSON.stringify(input));
			}
			assert.strictEqual(file.schema.safeParse({ action: "glob" }).success, false);
		});
	});
});
