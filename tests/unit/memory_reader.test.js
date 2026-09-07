import { describe, it, after, beforeEach } from "node:test";
import assert from "node:assert";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter, readMemoryFile } from "../../src/memory/reader.js";

const TEST_DIR = "memory/__test_reader__/";
const CWD = join(process.cwd(), TEST_DIR);

function setup() {
	mkdirSync(CWD, { recursive: true });
}

function teardown() {
	rmSync(CWD, { recursive: true, force: true });
}

describe("memory_reader", () => {
	beforeEach(setup);
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

		it("parses valid frontmatter with entries", () => {
			const content = "---\nentries:\n  - key: test\n    value: hello\n---\nSome body text.";
			const result = parseFrontmatter(content);
			assert.deepStrictEqual(result.frontmatter, {
				entries: [{ key: "test", value: "hello" }],
			});
			assert.strictEqual(result.content, "Some body text.");
		});

		it("returns empty frontmatter for content without frontmatter", () => {
			const content = "Just plain text content.";
			const result = parseFrontmatter(content);
			assert.deepStrictEqual(result.frontmatter, {});
			assert.strictEqual(result.content, "Just plain text content.");
		});

		it("handles missing body after frontmatter (trailing newline)", () => {
			const content = "---\ntitle: Test\n---\n";
			const result = parseFrontmatter(content);
			assert.strictEqual(result.frontmatter.title, "Test");
			assert.strictEqual(result.content, "");
		});

		it("handles missing body after frontmatter (no trailing newline)", () => {
			const content = "---\ntitle: Test\n---";
			const result = parseFrontmatter(content);
			assert.strictEqual(result.frontmatter.title, "Test");
			assert.strictEqual(result.content, "");
		});

		it("returns empty frontmatter for invalid YAML in frontmatter (lines 23-25)", () => {
			// Triggers the catch block in parseFrontmatter: load() throws,
			// logger.debug is called, and {} is returned.
			const content = "---\ninvalid: [unclosed\n---\nbody content";
			const result = parseFrontmatter(content);
			assert.deepStrictEqual(result.frontmatter, {});
			assert.strictEqual(result.content, "body content");
		});

		it("converts timestamp string to Date object (lines 32-40)", () => {
			// js-yaml 5.x keeps date strings as strings; the function
			// manually converts the 'timestamp' field to a Date instance.
			const content = '---\ntimestamp: "2024-06-15T12:00:00.000Z"\n---\nbody';
			const result = parseFrontmatter(content);
			assert.ok(
				result.frontmatter.timestamp instanceof Date,
				"timestamp should be a Date instance",
			);
			assert.strictEqual(result.frontmatter.timestamp.toISOString(), "2024-06-15T12:00:00.000Z");
		});

		it("handles non-object YAML parse result (line 27)", () => {
			// When YAML parses to a scalar (e.g. a plain string) the result
			// is truthy but not an object → frontmatter falls back to {}.
			const content = "---\nhello\n---\nbody";
			const result = parseFrontmatter(content);
			assert.deepStrictEqual(result.frontmatter, {});
			assert.strictEqual(result.content, "body");
		});

		it("does not convert non-date timestamp string", () => {
			// A string that looks date-ish but is not a valid Date should
			// remain as-is (the NaN guard on line 37 prevents assignment).
			const content = '---\ntimestamp: "not-a-date"\n---\nbody';
			const result = parseFrontmatter(content);
			assert.strictEqual(typeof result.frontmatter.timestamp, "string");
			assert.strictEqual(result.frontmatter.timestamp, "not-a-date");
		});
	});

	describe("readMemoryFile", () => {
		it("returns null for non-existent file", async () => {
			const result = await readMemoryFile("/nonexistent/file/path.md");
			assert.strictEqual(result, null);
		});

		it("returns parsed data for existing file with frontmatter", async () => {
			const filePath = join(CWD, "test.md");
			writeFileSync(filePath, "---\ntitle: Test File\n---\n\nThis is the body content.");
			const result = await readMemoryFile(filePath);
			assert.ok(result);
			assert.strictEqual(result.frontmatter.title, "Test File");
			assert.strictEqual(result.content, "This is the body content.");
			assert.strictEqual(result.path, filePath);
		});

		it("returns parsed data for file without frontmatter", async () => {
			const filePath = join(CWD, "plain.md");
			writeFileSync(filePath, "Just plain content without frontmatter.");
			const result = await readMemoryFile(filePath);
			assert.ok(result);
			assert.deepStrictEqual(result.frontmatter, {});
			assert.strictEqual(result.content, "Just plain content without frontmatter.");
			assert.strictEqual(result.path, filePath);
		});

		it("returns parsed data with empty frontmatter for invalid YAML frontmatter", async () => {
			// Exercises the same catch block as parseFrontmatter but through
			// the I/O path, verifying readMemoryFile propagates the fallback.
			const filePath = join(CWD, "invalid-yaml.md");
			writeFileSync(filePath, "---\ninvalid: [unclosed\n---\nbody content");
			const result = await readMemoryFile(filePath);
			assert.ok(result);
			assert.deepStrictEqual(result.frontmatter, {});
			assert.strictEqual(result.content, "body content");
			assert.strictEqual(result.path, filePath);
		});
	});
});
