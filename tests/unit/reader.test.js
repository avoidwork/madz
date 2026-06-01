import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter, readMemoryFile } from "../../src/memory/reader.js";

const testDir = join(process.cwd(), "memory", "__test_reader__");

function setup() {
	mkdirSync(testDir, { recursive: true });
}

function teardown() {
	rmSync(testDir, { recursive: true, force: true });
}

describe("reader", () => {
	before(setup);
	after(teardown);

	describe("parseFrontmatter", () => {
		it("returns empty objects for null content", () => {
			const result = parseFrontmatter(null);
			assert.deepStrictEqual(result, { frontmatter: {}, content: "" });
		});

		it("returns empty objects for empty string", () => {
			const result = parseFrontmatter("");
			assert.deepStrictEqual(result, { frontmatter: {}, content: "" });
		});

		it("parses frontmatter with entries", () => {
			const content = "---\nentries:\n  - key: test\n    value: hello\n---\nSome body text.";
			const result = parseFrontmatter(content);
			assert.deepStrictEqual(result.frontmatter, {
				entries: [{ key: "test", value: "hello" }],
			});
			assert.strictEqual(result.content, "Some body text.");
		});

		it("returns body with no frontmatter", () => {
			const content = "Just plain text content.";
			const result = parseFrontmatter(content);
			assert.deepStrictEqual(result.frontmatter, {});
			assert.strictEqual(result.content, "Just plain text content.");
		});

		it("handles frontmatter with entries that have undefined value", () => {
			const content = "---\nentries:\n  - key: test\n    value: null\n---\nBody.";
			const result = parseFrontmatter(content);
			assert.deepStrictEqual(result.frontmatter.entries[0].value, null);
		});

		it("handles missing body after frontmatter", () => {
			const content = "---\ntitle: Test\n---\n";
			const result = parseFrontmatter(content);
			assert.strictEqual(result.frontmatter.title, "Test");
			assert.strictEqual(result.content, "");
		});
	});

	describe("readMemoryFile", () => {
		it("returns null for non-existent file", async () => {
			const result = await readMemoryFile("/nonexistent/file/path.md");
			assert.strictEqual(result, null);
		});

		it("returns parsed data for existing file with frontmatter", () => {
			const filePath = join(testDir, "test.md");
			writeFileSync(filePath, "---\ntitle: Test File\n---\n\nThis is the body content.");
			const result = readMemoryFile(filePath);
			assert.ok(result);
			assert.strictEqual(result.frontmatter.title, "Test File");
			assert.strictEqual(result.content, "This is the body content.");
			assert.strictEqual(result.path, filePath);
		});

		it("returns parsed data for file without frontmatter", () => {
			const filePath = join(testDir, "plain.md");
			writeFileSync(filePath, "Just plain content without frontmatter.");
			const result = readMemoryFile(filePath);
			assert.ok(result);
			assert.deepStrictEqual(result.frontmatter, {});
			assert.strictEqual(result.content, "Just plain content without frontmatter.");
		});
	});
});
