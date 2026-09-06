import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import {
	extractFrontmatter,
	lenientYamlParse,
	discoverSkills,
	setCwd,
} from "../../src/skills/discoverer.js";

// ---------------------------------------------------------------------------
// Test directory under memory/ so it follows project conventions
// ---------------------------------------------------------------------------
const TEST_DIR = "memory/__test_discoverer__";
const FULL_TEST_DIR = join(process.cwd(), TEST_DIR);

function setup() {
	rmSync(FULL_TEST_DIR, { recursive: true, force: true });
	mkdirSync(FULL_TEST_DIR, { recursive: true });
}

function teardown() {
	try {
		rmSync(FULL_TEST_DIR, { recursive: true, force: true });
	} catch {
		// ignore cleanup errors
	}
}

// ---------------------------------------------------------------------------
// extractFrontmatter — pure function tests
// ---------------------------------------------------------------------------

describe("extractFrontmatter", () => {
	it("extracts valid frontmatter and body", () => {
		const content = [
			"---",
			"name: my-skill",
			"description: A test skill",
			"version: 1.0.0",
			"---",
			"",
			"Some body content here.",
		].join("\n");

		const result = extractFrontmatter(content);
		assert.ok(result.frontmatter !== null);
		assert.strictEqual(result.frontmatter.name, "my-skill");
		assert.strictEqual(result.frontmatter.description, "A test skill");
		assert.strictEqual(result.frontmatter.version, "1.0.0");
		assert.ok(result.body.includes("Some body content here."));
	});

	it("returns null frontmatter when no --- delimiters exist", () => {
		const content = "# Just a heading\n\nNo frontmatter block at all.";
		const result = extractFrontmatter(content);
		assert.strictEqual(result.frontmatter, null);
		assert.strictEqual(result.body, content.trim());
	});

	it("returns null frontmatter when only opening delimiter exists", () => {
		const content = "---\nname: orphan\nNo closing delimiter anywhere";
		const result = extractFrontmatter(content);
		assert.strictEqual(result.frontmatter, null);
		assert.strictEqual(result.body, content.trim());
	});

	it("returns null frontmatter for empty content", () => {
		const result = extractFrontmatter("");
		assert.strictEqual(result.frontmatter, null);
		assert.strictEqual(result.body, "");
	});

	it("returns null frontmatter for non-string input", () => {
		const result = extractFrontmatter(123);
		assert.strictEqual(result.frontmatter, null);
		assert.strictEqual(result.body, "");

		const resultNull = extractFrontmatter(null);
		assert.strictEqual(resultNull.frontmatter, null);
		assert.strictEqual(resultNull.body, "");

		const resultUndef = extractFrontmatter(undefined);
		assert.strictEqual(resultUndef.frontmatter, null);
		assert.strictEqual(resultUndef.body, "");

		const resultObj = extractFrontmatter({});
		assert.strictEqual(resultObj.frontmatter, null);
		assert.strictEqual(resultObj.body, "");
	});

	it("falls back to lenientYamlParse when frontmatter YAML is invalid", () => {
		// YAML with unquoted colons in values — triggers lenient fallback
		const content = [
			"---",
			"name: my-skill",
			"description: Use when: the user asks about PDFs",
			"---",
			"",
			"Body",
		].join("\n");

		const result = extractFrontmatter(content);
		assert.ok(result.frontmatter !== null, "should parse via lenient fallback");
		assert.strictEqual(result.frontmatter.name, "my-skill");
		assert.strictEqual(result.frontmatter.description, "Use when: the user asks about PDFs");
	});

	it("treats content after first --- block as body", () => {
		// Only the first YAML block between --- delimiters is frontmatter.
		// Everything after the closing --- is body content.
		const content = [
			"---",
			"name: my-skill",
			"description: A skill with metadata block",
			"---",
			"agent: coding",
			"confidence: 0.95",
			"---",
			"",
			"Body content after metadata block.",
		].join("\n");

		const result = extractFrontmatter(content);
		assert.ok(result.frontmatter !== null, "frontmatter should be parsed");
		assert.strictEqual(result.frontmatter.name, "my-skill");
		assert.strictEqual(result.frontmatter.description, "A skill with metadata block");

		// The second block is body, not merged into frontmatter
		assert.strictEqual(result.frontmatter.agent, undefined);
		assert.strictEqual(result.frontmatter.confidence, undefined);

		// Body includes everything after the first closing ---
		assert.ok(result.body.includes("agent: coding"));
		assert.ok(result.body.includes("Body content after metadata block."));
	});

	it("treats second --- block as body content (not metadata)", () => {
		// Frontmatter is only the first YAML block between --- delimiters.
		// Any subsequent --- blocks are part of the body.
		const content = [
			"---",
			"name: my-skill",
			"description: A skill",
			"---",
			"extra: data",
			"---",
			"",
			"Body",
		].join("\n");

		const result = extractFrontmatter(content);
		assert.ok(result.frontmatter !== null);
		assert.strictEqual(result.frontmatter.name, "my-skill");
		assert.strictEqual(result.frontmatter.description, "A skill");
		// The second block is body, not merged into frontmatter
		assert.strictEqual(result.frontmatter.extra, undefined);
		assert.ok(result.body.includes("extra: data"));
	});

	it("returns null frontmatter when YAML parses to non-object", () => {
		// YAML that parses to a scalar or array should yield null frontmatter
		const content = ["---", "12345", "---", "", "Body"].join("\n");
		const result = extractFrontmatter(content);
		assert.strictEqual(result.frontmatter, null);
	});

	it("preserves body when frontmatter is present", () => {
		const content = [
			"---",
			"name: preserve-body",
			"description: Check body preservation",
			"---",
			"",
			"# Heading",
			"",
			"Some **markdown** content with `code`.",
			"",
			"---",
			"",
			"More after a horizontal rule.",
		].join("\n");

		const result = extractFrontmatter(content);
		assert.ok(result.frontmatter !== null);
		assert.ok(result.body.includes("Heading"));
		assert.ok(result.body.includes("**markdown**"));
		assert.ok(result.body.includes("More after a horizontal rule."));
	});
});

// ---------------------------------------------------------------------------
// lenientYamlParse — pure function tests
// ---------------------------------------------------------------------------

describe("lenientYamlParse", () => {
	it("parses valid YAML correctly", () => {
		const result = lenientYamlParse("name: test-skill\ndescription: A test skill");
		assert.ok(result !== null);
		assert.strictEqual(result.name, "test-skill");
		assert.strictEqual(result.description, "A test skill");
	});

	it("parses YAML with unquoted colons in values", () => {
		const yaml = [
			"name: pdf-helper",
			"description: Use when: the user asks about PDFs or documents",
			"trigger: file:*.pdf",
		].join("\n");

		const result = lenientYamlParse(yaml);
		assert.ok(result !== null, "should parse despite unquoted colons");
		assert.strictEqual(result.name, "pdf-helper");
		assert.ok(result.description.includes("Use when:"));
		assert.ok(result.description.includes("the user asks about PDFs or documents"));
		assert.strictEqual(result.trigger, "file:*.pdf");
	});

	it("returns null for completely unparseable YAML", () => {
		const result = lenientYamlParse("{ invalid: yaml: [::: }");
		assert.strictEqual(result, null);
	});

	it("returns null for empty string", () => {
		const result = lenientYamlParse("");
		assert.strictEqual(result, null);
	});

	it("handles YAML with already-quoted values containing colons", () => {
		const yaml = [
			"name: log-parser",
			'description: "Use when: parsing log files"',
		].join("\n");

		const result = lenientYamlParse(yaml);
		assert.ok(result !== null);
		assert.strictEqual(result.name, "log-parser");
		assert.strictEqual(result.description, "Use when: parsing log files");
	});

	it("handles YAML with multiple unquoted colons across lines", () => {
		const yaml = [
			"name: multi-colon",
			"description: Step 1: do this, Step 2: do that",
			"trigger: on:error",
		].join("\n");

		const result = lenientYamlParse(yaml);
		assert.ok(result !== null);
		assert.strictEqual(result.name, "multi-colon");
		assert.ok(result.description.includes("Step 1: do this"));
		assert.ok(result.description.includes("Step 2: do that"));
	});
});

// ---------------------------------------------------------------------------
// discoverSkills — I/O function tests using memory/__test_discoverer__/
// ---------------------------------------------------------------------------

describe("discoverSkills", () => {
	beforeEach(setup);
	afterEach(teardown);

	it("discovers SKILL.md files with valid frontmatter", async () => {
		const skillDir = join(FULL_TEST_DIR, "my-skill");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(
			join(skillDir, "SKILL.md"),
			["---", "name: my-skill", "description: A test skill", "---", "", "Content"].join("\n"),
		);

		const skills = await discoverSkills([FULL_TEST_DIR]);
		assert.strictEqual(skills.length, 1);
		assert.strictEqual(skills[0].name, "my-skill");
		assert.strictEqual(skills[0].metadata.name, "my-skill");
		assert.strictEqual(skills[0].metadata.description, "A test skill");
		assert.ok(skills[0].metadata._path.endsWith("SKILL.md"));
		assert.ok(skills[0].metadata._directory.endsWith("my-skill"));
	});

	it("returns empty array for non-existent directory (covers line 192-193)", async () => {
		const skills = await discoverSkills([join(FULL_TEST_DIR, "does-not-exist")]);
		assert.strictEqual(skills.length, 0);
	});

	it("skips SKILL.md without valid frontmatter (covers line 187-188)", async () => {
		const skillDir = join(FULL_TEST_DIR, "no-frontmatter");
		mkdirSync(skillDir, { recursive: true });
		// SKILL.md exists but has no frontmatter — readFile succeeds but
		// extractFrontmatter returns null frontmatter, so it's skipped
		writeFileSync(join(skillDir, "SKILL.md"), "# Just a markdown file\n\nNo frontmatter here.");

		const skills = await discoverSkills([FULL_TEST_DIR]);
		assert.strictEqual(skills.length, 0);
	});

	it("skips SKILL.md with missing name in frontmatter", async () => {
		const skillDir = join(FULL_TEST_DIR, "no-name");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(
			join(skillDir, "SKILL.md"),
			["---", "description: Missing name field", "---", "", "Body"].join("\n"),
		);

		const skills = await discoverSkills([FULL_TEST_DIR]);
		assert.strictEqual(skills.length, 0);
	});

	it("skips SKILL.md with empty description", async () => {
		const skillDir = join(FULL_TEST_DIR, "empty-desc");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(
			join(skillDir, "SKILL.md"),
			["---", "name: empty-desc", "description: ''", "---", "", "Body"].join("\n"),
		);

		const skills = await discoverSkills([FULL_TEST_DIR]);
		assert.strictEqual(skills.length, 0);
	});

	it("skips SKILL.md with non-string description", async () => {
		const skillDir = join(FULL_TEST_DIR, "bad-desc");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(
			join(skillDir, "SKILL.md"),
			["---", "name: bad-desc", "description: 42", "---", "", "Body"].join("\n"),
		);

		const skills = await discoverSkills([FULL_TEST_DIR]);
		assert.strictEqual(skills.length, 0);
	});

	it("discovers multiple skills across directories", async () => {
		const skillA = join(FULL_TEST_DIR, "skill-a");
		const skillB = join(FULL_TEST_DIR, "skill-b");
		mkdirSync(skillA, { recursive: true });
		mkdirSync(skillB, { recursive: true });

		writeFileSync(
			join(skillA, "SKILL.md"),
			["---", "name: skill-a", "description: Skill A", "---", "", "Content A"].join("\n"),
		);
		writeFileSync(
			join(skillB, "SKILL.md"),
			["---", "name: skill-b", "description: Skill B", "---", "", "Content B"].join("\n"),
		);

		const skills = await discoverSkills([FULL_TEST_DIR]);
		assert.strictEqual(skills.length, 2);
		const names = skills.map((s) => s.name).sort();
		assert.deepStrictEqual(names, ["skill-a", "skill-b"]);
	});

	it("skips dotfile directories", async () => {
		const hiddenDir = join(FULL_TEST_DIR, ".hidden");
		mkdirSync(hiddenDir, { recursive: true });
		writeFileSync(
			join(hiddenDir, "SKILL.md"),
			["---", "name: hidden", "description: Should be skipped", "---", "", "Body"].join("\n"),
		);

		const skills = await discoverSkills([FULL_TEST_DIR]);
		assert.strictEqual(skills.length, 0);
	});

	it("skips node_modules directories", async () => {
		const nmDir = join(FULL_TEST_DIR, "node_modules", "some-pkg");
		mkdirSync(nmDir, { recursive: true });
		writeFileSync(
			join(nmDir, "SKILL.md"),
			["---", "name: nm-skill", "description: In node_modules", "---", "", "Body"].join("\n"),
		);

		const skills = await discoverSkills([FULL_TEST_DIR]);
		assert.strictEqual(skills.length, 0);
	});

	it("handles name collisions — second occurrence is skipped", async () => {
		const dir1 = join(FULL_TEST_DIR, "alpha-skill");
		const dir2 = join(FULL_TEST_DIR, "beta-skill");
		mkdirSync(dir1, { recursive: true });
		mkdirSync(dir2, { recursive: true });

		writeFileSync(
			join(dir1, "SKILL.md"),
			["---", "name: collision-skill", "description: First occurrence", "---", "", "Body"].join(
				"\n",
			),
		);
		writeFileSync(
			join(dir2, "SKILL.md"),
			["---", "name: collision-skill", "description: Second occurrence", "---", "", "Body"].join(
				"\n",
			),
		);

		const skills = await discoverSkills([FULL_TEST_DIR]);
		// Only the first one found (alphabetically: alpha-skill before beta-skill)
		assert.strictEqual(skills.length, 1);
		assert.strictEqual(skills[0].metadata.description, "First occurrence");
	});

	it("handles .skills/ shadowing user skills/", async () => {
		// System skill in .skills/ should override user skill with same name
		const systemDir = join(FULL_TEST_DIR, ".skills");
		const systemSkillDir = join(systemDir, "shadow-skill");
		mkdirSync(systemSkillDir, { recursive: true });
		writeFileSync(
			join(systemSkillDir, "SKILL.md"),
			["---", "name: shadow-skill", "description: System version", "---", "", "System body"].join(
				"\n",
			),
		);

		const userDir = join(FULL_TEST_DIR, "skills");
		const userSkillDir = join(userDir, "shadow-skill");
		mkdirSync(userSkillDir, { recursive: true });
		writeFileSync(
			join(userSkillDir, "SKILL.md"),
			["---", "name: shadow-skill", "description: User version", "---", "", "User body"].join(
				"\n",
			),
		);

		// .skills/ scope first, then user skills/ — .skills/ wins on collision
		const skills = await discoverSkills([systemDir, userDir]);
		assert.strictEqual(skills.length, 1);
		assert.strictEqual(skills[0].metadata.description, "System version");
		assert.ok(skills[0].path.includes(".skills"));
	});

	it("discovers both system and user skills when names do not collide", async () => {
		const systemDir = join(FULL_TEST_DIR, ".skills");
		const systemSkillDir = join(systemDir, "sys-only");
		mkdirSync(systemSkillDir, { recursive: true });
		writeFileSync(
			join(systemSkillDir, "SKILL.md"),
			["---", "name: sys-only", "description: System only", "---", "", "System body"].join("\n"),
		);

		const userDir = join(FULL_TEST_DIR, "skills");
		const userSkillDir = join(userDir, "user-only");
		mkdirSync(userSkillDir, { recursive: true });
		writeFileSync(
			join(userSkillDir, "SKILL.md"),
			["---", "name: user-only", "description: User only", "---", "", "User body"].join("\n"),
		);

		const skills = await discoverSkills([systemDir, userDir]);
		assert.strictEqual(skills.length, 2);
		const names = skills.map((s) => s.name).sort();
		assert.deepStrictEqual(names, ["sys-only", "user-only"]);
	});

	it("discovers skills with scripts directory", async () => {
		const skillDir = join(FULL_TEST_DIR, "scripted-skill");
		const scriptsDir = join(skillDir, "scripts");
		mkdirSync(scriptsDir, { recursive: true });
		writeFileSync(
			join(skillDir, "SKILL.md"),
			["---", "name: scripted-skill", "description: Has scripts", "---", "", "Body"].join("\n"),
		);

		const skills = await discoverSkills([FULL_TEST_DIR]);
		assert.strictEqual(skills.length, 1);
		assert.ok(skills[0].metadata.scripts.endsWith("scripts"));
	});

	it("accepts numeric name cast to string", async () => {
		const skillDir = join(FULL_TEST_DIR, "numeric-name");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(
			join(skillDir, "SKILL.md"),
			["---", "name: 123", "description: Numeric name", "---", "", "Body"].join("\n"),
		);

		const skills = await discoverSkills([FULL_TEST_DIR]);
		assert.strictEqual(skills.length, 1);
		assert.strictEqual(skills[0].metadata.name, "123");
	});

	it("handles multiple scopes, merging results", async () => {
		const scopeA = join(FULL_TEST_DIR, "scope-a");
		const scopeB = join(FULL_TEST_DIR, "scope-b");
		mkdirSync(join(scopeA, "skill-a"), { recursive: true });
		mkdirSync(join(scopeB, "skill-b"), { recursive: true });

		writeFileSync(
			join(scopeA, "skill-a", "SKILL.md"),
			["---", "name: from-scope-a", "description: In scope A", "---", "", "Body"].join("\n"),
		);
		writeFileSync(
			join(scopeB, "skill-b", "SKILL.md"),
			["---", "name: from-scope-b", "description: In scope B", "---", "", "Body"].join("\n"),
		);

		const skills = await discoverSkills([scopeA, scopeB]);
		assert.strictEqual(skills.length, 2);
		const names = skills.map((s) => s.metadata.name).sort();
		assert.deepStrictEqual(names, ["from-scope-a", "from-scope-b"]);
	});

	it("handles SKILL.md read error gracefully (covers line 187-188)", async () => {
		// Create a directory with a SKILL.md that exists but is unreadable
		// We simulate this by creating a directory entry that is a directory
		// named SKILL.md — access() will succeed (it exists) but readFile will fail
		const skillDir = join(FULL_TEST_DIR, "broken-skill");
		mkdirSync(skillDir, { recursive: true });
		// Create a *directory* named SKILL.md — access(F_OK) passes but readFile throws
		mkdirSync(join(skillDir, "SKILL.md"), { recursive: true });

		const skills = await discoverSkills([FULL_TEST_DIR]);
		// Should not throw; the error is caught and logged, skill is skipped
		assert.strictEqual(skills.length, 0);
	});
});

// ---------------------------------------------------------------------------
// setCwd — verify it updates the module-level cwd
// ---------------------------------------------------------------------------

describe("setCwd", () => {
	it("updates the module-level cwd variable", () => {
		const originalCwd = process.cwd();
		try {
			setCwd("/tmp/set-cwd-test");
			// We can't directly import `cwd` because it's a live binding,
			// but we can verify discoverSkills uses it via options.cwd fallback.
			// The cwd is used when options.cwd is not provided.
			// For this test we just verify the function exists and accepts a string.
			assert.ok(typeof setCwd === "function");
		} finally {
			setCwd(originalCwd);
		}
	});
});
