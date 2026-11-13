import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	parseFrontmatter,
	readMemoryFile,
	MAX_MEMORY_FILE_BYTES,
} from "../../../src/memory/reader.js";

describe("memory/reader (hardening)", () => {
	it("handles CRLF frontmatter", () => {
		const r = parseFrontmatter("---\r\ntitle: T\r\n---\r\nbody\r\n");
		assert.strictEqual(r.frontmatter.title, "T");
		assert.strictEqual(r.content, "body");
	});

	it("handles empty frontmatter", () => {
		const r = parseFrontmatter("---\n---\nbody");
		assert.deepStrictEqual(r.frontmatter, {});
		assert.strictEqual(r.content, "body");
	});

	it("treats array frontmatter as empty object", () => {
		const r = parseFrontmatter("---\n- a\n- b\n---\nbody");
		assert.deepStrictEqual(r.frontmatter, {});
	});

	it("ignores frontmatter with anchors/aliases", () => {
		const r = parseFrontmatter("---\na: &x [1]\nb: *x\n---\nbody");
		assert.deepStrictEqual(r.frontmatter, {});
		assert.strictEqual(r.content, "body");
	});

	it("does not mistake & or * inside quoted values for anchors", () => {
		const r = parseFrontmatter('---\ntitle: "R&D *team*"\n---\nbody');
		assert.strictEqual(r.frontmatter.title, "R&D *team*");
	});

	it("normalizes timestamps explicitly to Date", () => {
		const r = parseFrontmatter("---\ntimestamp: 2024-01-01T00:00:00.000Z\n---\nx");
		assert.ok(r.frontmatter.timestamp instanceof Date);
	});

	it("readMemoryFile returns null for ENOENT, skips oversize, throws other errors", async () => {
		const d = await mkdtemp(join(tmpdir(), "madz-reader-"));
		try {
			assert.strictEqual(await readMemoryFile(join(d, "missing.md")), null);
			await writeFile(join(d, "big.md"), "x".repeat(MAX_MEMORY_FILE_BYTES + 1));
			assert.strictEqual(await readMemoryFile(join(d, "big.md")), null);
			await writeFile(join(d, "ok.md"), "---\ntitle: Ok\n---\nbody");
			const ok = await readMemoryFile(join(d, "ok.md"));
			assert.strictEqual(ok.frontmatter.title, "Ok");
			assert.strictEqual(ok.path, join(d, "ok.md"));
			await assert.rejects(readMemoryFile(join(d, "ok.md", "x")), { code: "ENOTDIR" });
		} finally {
			await rm(d, { recursive: true, force: true });
		}
	});
});
