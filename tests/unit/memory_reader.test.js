import { describe, it } from "node:test";
import assert from "node:assert";
import { parseFrontmatter } from "../../src/memory/reader.js";

describe("parseFrontmatter with SAFE_SCHEMA", () => {
	it("rejects malicious !!js/function tag", () => {
		const malicious = `---\ntitle: Test\n!!js/function "return evil"\n---\nBody`;
		const result = parseFrontmatter(malicious);
		// Should not execute the function, should return safe default
		assert.strictEqual(result.frontmatter.title, "Test");
		assert.ok(!result.frontmatter["!!js/function"]);
	});

	it("rejects malicious !!js/regexp tag", () => {
		const malicious = `---\ntitle: Test\n!!js/regexp /evil/\n---\nBody`;
		const result = parseFrontmatter(malicious);
		assert.strictEqual(result.frontmatter.title, "Test");
		assert.ok(!result.frontmatter["!!js/regexp"]);
	});

	it("rejects malicious !!js/undefined tag", () => {
		const malicious = `---\ntitle: Test\n!!js/undefined\n---\nBody`;
		const result = parseFrontmatter(malicious);
		assert.strictEqual(result.frontmatter.title, "Test");
	});

	it("parses valid YAML frontmatter correctly", () => {
		const valid = `---\ntitle: Test\ntimestamp: 2024-01-01\nprovider: openai\ntokenCount: 42\n---\nBody content`;
		const result = parseFrontmatter(valid);
		assert.strictEqual(result.frontmatter.title, "Test");
		assert.strictEqual(result.frontmatter.timestamp, "2024-01-01");
		assert.strictEqual(result.frontmatter.provider, "openai");
		assert.strictEqual(result.frontmatter.tokenCount, 42);
		assert.strictEqual(result.content, "Body content");
	});

	it("handles empty frontmatter", () => {
		const result = parseFrontmatter("---\n---\nBody");
		assert.deepStrictEqual(result.frontmatter, {});
		assert.strictEqual(result.content, "Body");
	});

	it("handles content without frontmatter", () => {
		const result = parseFrontmatter("Just plain text");
		assert.deepStrictEqual(result.frontmatter, {});
		assert.strictEqual(result.content, "Just plain text");
	});

	it("handles empty string", () => {
		const result = parseFrontmatter("");
		assert.deepStrictEqual(result.frontmatter, {});
		assert.strictEqual(result.content, "");
	});

	it("handles malformed YAML gracefully", () => {
		const malformed = `---\ninvalid: yaml: content:\n---\nBody`;
		const result = parseFrontmatter(malformed);
		// Should return empty frontmatter without throwing
		assert.deepStrictEqual(result.frontmatter, {});
	});

	it("parses nested objects", () => {
		const valid = `---\nmetadata:\n  author: Test\n  version: 1\n---\nBody`;
		const result = parseFrontmatter(valid);
		assert.deepStrictEqual(result.frontmatter.metadata, { author: "Test", version: 1 });
	});

	it("parses boolean and null values", () => {
		const valid = `---\nenabled: true\ndisabled: false\noptional: null\n---\nBody`;
		const result = parseFrontmatter(valid);
		assert.strictEqual(result.frontmatter.enabled, true);
		assert.strictEqual(result.frontmatter.disabled, false);
		assert.strictEqual(result.frontmatter.optional, null);
	});
});
