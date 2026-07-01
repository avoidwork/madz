import { describe, it } from "node:test";
import assert from "node:assert";
import { parseFrontmatter } from "../../src/memory/reader.js";

describe("parseFrontmatter in context", () => {
	it("returns valid frontmatter object with title and timestamp as Date", () => {
		const content = "---\ntitle: Test Title\ntimestamp: 2024-01-15\n---\nTest body content";
		const result = parseFrontmatter(content);
		assert.strictEqual(result.frontmatter.title, "Test Title");
		// parseFrontmatter converts timestamps to Date objects
		assert.ok(result.frontmatter.timestamp instanceof Date);
		assert.strictEqual(result.content, "Test body content");
	});

	it("handles frontmatter without timestamp (timestamp is undefined)", () => {
		const content = "---\ntitle: No Timestamp\n---\nSome body";
		const result = parseFrontmatter(content);
		assert.strictEqual(result.frontmatter.title, "No Timestamp");
		assert.strictEqual(result.frontmatter.timestamp, undefined);
	});
});
