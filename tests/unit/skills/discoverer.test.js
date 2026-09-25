import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { chdir } from "node:process";
import { join } from "node:path";
import { extractFrontmatter, discoverSkills, setCwd } from "../../../src/skills/discoverer.js";

let testDir;
let originalCwd;

function setup() {
	originalCwd = process.cwd();
	testDir = join(tmpdir(), "madz-skills-disc-test-" + Date.now());
	mkdirSync(testDir, { recursive: true });
	chdir(testDir);
	setCwd(testDir);
}

function cleanup() {
	if (testDir) {
		rmSync(testDir, { recursive: true, force: true });
	}
	if (originalCwd) {
		chdir(originalCwd);
		setCwd(originalCwd);
	}
}

// --- extractFrontmatter: frontmatter with `---` in the body ---

describe("extractFrontmatter with --- in body", () => {
	it("extracts frontmatter correctly when the body contains a Markdown table separator", () => {
		const content = [
			"---",
			"name: table-skill",
			"description: A skill with a table",
			"---",
			"",
			"| col1 | col2 |",
			"| --- | --- |",
			"| a | b |",
		].join("\n");

		const result = extractFrontmatter(content);
		assert.ok(result.frontmatter !== null);
		assert.strictEqual(result.frontmatter.name, "table-skill");
		assert.strictEqual(result.frontmatter.description, "A skill with a table");
		assert.ok(result.body.includes("| --- | --- |"));
		assert.ok(result.body.includes("| col1 | col2 |"));
	});

	it("extracts frontmatter correctly when the body contains a horizontal rule", () => {
		const content = [
			"---",
			"name: hr-skill",
			"description: A skill with a horizontal rule",
			"---",
			"",
			"Some body text.",
			"",
			"---",
			"",
			"More body text.",
		].join("\n");

		const result = extractFrontmatter(content);
		assert.ok(result.frontmatter !== null);
		assert.strictEqual(result.frontmatter.name, "hr-skill");
		assert.ok(result.body.includes("Some body text."));
		assert.ok(result.body.includes("More body text."));
	});

	it("does not truncate frontmatter when a --- appears inside the frontmatter region", () => {
		// The regex captures up to the first closing --- line, so a --- in the
		// body is not treated as the closing delimiter.
		const content = [
			"---",
			"name: nested-skill",
			"description: A skill",
			"---",
			"",
			"Body with --- inside.",
		].join("\n");

		const result = extractFrontmatter(content);
		assert.ok(result.frontmatter !== null);
		assert.strictEqual(result.frontmatter.name, "nested-skill");
		assert.strictEqual(result.frontmatter.description, "A skill");
		assert.ok(result.body.includes("Body with --- inside."));
	});

	it("handles CRLF line endings", () => {
		const content = "---\r\nname: crlf-skill\r\ndescription: A CRLF skill\r\n---\r\n\r\nBody";
		const result = extractFrontmatter(content);
		assert.ok(result.frontmatter !== null);
		assert.strictEqual(result.frontmatter.name, "crlf-skill");
		assert.strictEqual(result.frontmatter.description, "A CRLF skill");
		assert.ok(result.body.includes("Body"));
	});

	it("handles a closing delimiter with no trailing newline", () => {
		const content = "---\nname: no-newline-skill\ndescription: No trailing newline\n---";
		const result = extractFrontmatter(content);
		assert.ok(result.frontmatter !== null);
		assert.strictEqual(result.frontmatter.name, "no-newline-skill");
		assert.strictEqual(result.frontmatter.description, "No trailing newline");
	});

	it("returns null frontmatter when there is no closing delimiter", () => {
		const content = "---\nname: orphan\nNo closing delimiter anywhere";
		const result = extractFrontmatter(content);
		assert.strictEqual(result.frontmatter, null);
		assert.strictEqual(result.body, content.trim());
	});

	it("returns null frontmatter when content has no --- delimiters", () => {
		const content = "# Just a heading\n\nNo frontmatter block at all.";
		const result = extractFrontmatter(content);
		assert.strictEqual(result.frontmatter, null);
		assert.strictEqual(result.body, content.trim());
	});
});

// --- discoverSkills integration with --- in body ---

describe("discoverSkills with --- in body", () => {
	beforeEach(setup);
	afterEach(cleanup);

	it("discovers a skill whose SKILL.md body contains a table separator", async () => {
		const skillDir = join(testDir, "table-skill");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(
			join(skillDir, "SKILL.md"),
			[
				"---",
				"name: table-skill",
				"description: A skill with a table",
				"---",
				"",
				"| col1 | col2 |",
				"| --- | --- |",
				"| a | b |",
			].join("\n"),
		);

		const skills = await discoverSkills(["."]);
		assert.strictEqual(skills.length, 1);
		assert.strictEqual(skills[0].name, "table-skill");
		assert.strictEqual(skills[0].metadata.name, "table-skill");
		assert.strictEqual(skills[0].metadata.description, "A skill with a table");
	});
});
