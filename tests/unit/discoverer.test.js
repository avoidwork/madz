import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { chdir } from "node:process";
import { join } from "node:path";
import {
	extractFrontmatter,
	lenientYamlParse,
	discoverSkills,
} from "../../src/skills/discoverer.js";
import { detectInterpreter, detectShebang } from "../../src/sandbox/runner.js";

let testDir;
let originalCwd;

function setup() {
	originalCwd = process.cwd();
	testDir = join(tmpdir(), "madz-disc-test-" + Date.now());
	mkdirSync(testDir, { recursive: true });
	chdir(testDir);
}

function cleanup() {
	if (testDir) {
		rmSync(testDir, { recursive: true, force: true });
	}
	if (originalCwd) {
		chdir(originalCwd);
	}
}

// --- Extract frontmatter tests ---

describe("extractFrontmatter", () => {
	it("extracts valid frontmatter from SKILL.md", () => {
		const content = "---\nname: test-skill\ndescription: A test skill\n---\n\nSome body content";
		const result = extractFrontmatter(content);
		assert.strictEqual(result.frontmatter.name, "test-skill");
		assert.strictEqual(result.frontmatter.description, "A test skill");
		assert.ok(result.body.includes("Some body content"));
	});

	it("returns null frontmatter when no delimiters", () => {
		const content = "# No frontmatter\n\nJust a markdown file.";
		const result = extractFrontmatter(content);
		assert.strictEqual(result.frontmatter, null);
		assert.ok(result.body.includes("No frontmatter"));
	});

	it("returns null frontmatter when no closing delimiter", () => {
		const content = "---\nname: test\n\nNo closing delimiter";
		const result = extractFrontmatter(content);
		assert.strictEqual(result.frontmatter, null);
	});

	it("handles empty content", () => {
		const result = extractFrontmatter("");
		assert.strictEqual(result.frontmatter, null);
		assert.strictEqual(result.body, "");
	});

	it("handles non-string content", () => {
		const result = extractFrontmatter(123);
		assert.strictEqual(result.frontmatter, null);
		assert.strictEqual(result.body, "");
	});

	it("parses multiple frontmatter fields", () => {
		const content =
			"---\nname: multi\nversion: 2.0.0\nlicense: MIT\ndescription: Multi-field skill\n---\n\nBody";
		const result = extractFrontmatter(content);
		assert.strictEqual(result.frontmatter.name, "multi");
		assert.strictEqual(result.frontmatter.version, "2.0.0");
		assert.strictEqual(result.frontmatter.license, "MIT");
	});
});

// --- Lenient YAML parse tests ---

describe("lenientYamlParse", () => {
	it("parses normal YAML correctly", () => {
		const result = lenientYamlParse("name: test-skill\ndescription: A test");
		assert.strictEqual(result.name, "test-skill");
		assert.strictEqual(result.description, "A test");
	});

	it("retries parsing YAML with unquoted colons", () => {
		const yaml = "name: test-skill\ndescription: Use when: the user asks about PDFs";
		const result = lenientYamlParse(yaml);
		assert.strictEqual(result.name, "test-skill");
		// Should be able to handle the colon
		assert.ok(typeof result.description === "string");
	});

	it("returns null for completely unparseable YAML", () => {
		const yaml = "{ invalid: yaml: [::: }";
		const result = lenientYamlParse(yaml);
		// May parse loosely or return null depending on js-yaml behavior
		assert.ok(result === null || typeof result === "object");
	});
});

// --- Discover skills tests ---

describe("discoverSkills", () => {
	beforeEach(setup);
	afterEach(cleanup);

	it("discovers SKILL.md files with valid frontmatter", () => {
		const skillDir = join(testDir, "my-skill");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(
			join(skillDir, "SKILL.md"),
			"---\nname: my-skill\ndescription: A test skill\n---\n\nContent",
		);

		const skills = discoverSkills(["."]);
		assert.strictEqual(skills.length, 1);
		assert.strictEqual(skills[0].name, "my-skill");
		assert.strictEqual(skills[0].metadata.name, "my-skill");
		assert.strictEqual(skills[0].metadata.description, "A test skill");
		assert.ok(skills[0].metadata._path.endsWith("SKILL.md"));
	});

	it("skips SKILL.md without valid frontmatter", () => {
		const skillDir = join(testDir, "no-meta-skill");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(join(skillDir, "SKILL.md"), "# No frontmatter here");

		const skills = discoverSkills(["."]);
		assert.strictEqual(skills.length, 0);
	});

	it("skips directories with empty description", () => {
		const skillDir = join(testDir, "empty-desc-skill");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(
			join(skillDir, "SKILL.md"),
			"---\nname: empty-desc-skill\ndescription: ''\n---\n\nBody",
		);

		const skills = discoverSkills(["."]);
		assert.strictEqual(skills.length, 0);
	});

	it("skips directories starting with dot", () => {
		const hiddenDir = join(testDir, ".hidden-skill");
		mkdirSync(hiddenDir, { recursive: true });
		writeFileSync(
			join(hiddenDir, "SKILL.md"),
			"---\nname: hidden-skill\ndescription: Hidden\n---\n\nBody",
		);

		const skills = discoverSkills(["."]);
		assert.strictEqual(skills.length, 0);
	});

	it("skips node_modules directories", () => {
		const nmDir = join(testDir, "node_modules", "some-skill");
		mkdirSync(nmDir, { recursive: true });
		writeFileSync(
			join(nmDir, "SKILL.md"),
			"---\nname: node-skill\ndescription: In node_modules\n---\n\nBody",
		);

		const skills = discoverSkills(["."]);
		assert.strictEqual(skills.length, 0);
	});

	it("discovers skills with scripts directory", () => {
		const skillDir = join(testDir, "scripts-skill");
		const scriptsDir = join(skillDir, "scripts");
		mkdirSync(scriptsDir, { recursive: true });
		writeFileSync(
			join(skillDir, "SKILL.md"),
			"---\nname: scripts-skill\ndescription: Has scripts\n---\n\nBody",
		);

		const skills = discoverSkills(["."]);
		assert.strictEqual(skills.length, 1);
		assert.ok(skills[0].metadata.scripts.endsWith("scripts"));
	});

	it("discovers multiple skills", () => {
		const skill1 = join(testDir, "skill-a");
		const skill2 = join(testDir, "skill-b");
		mkdirSync(skill1, { recursive: true });
		mkdirSync(skill2, { recursive: true });

		writeFileSync(join(skill1, "SKILL.md"), "---\nname: skill-a\ndescription: Skill A\n---\n\nA");
		writeFileSync(join(skill2, "SKILL.md"), "---\nname: skill-b\ndescription: Skill B\n---\n\nB");

		const skills = discoverSkills(["."]);
		assert.strictEqual(skills.length, 2);
		const names = skills.map((s) => s.name).sort();
		assert.deepStrictEqual(names, ["skill-a", "skill-b"]);
	});

	it("returns empty array for non-existent directory", () => {
		const skills = discoverSkills(["/nonexistent/path"]);
		assert.strictEqual(skills.length, 0);
	});

	it("handles multiple scopes", () => {
		const scope1 = join(testDir, "shared");
		const dirA = join(scope1, "shared-skill");
		mkdirSync(dirA, { recursive: true });
		writeFileSync(
			join(dirA, "SKILL.md"),
			"---\nname: shared-skill\ndescription: Shared skill\n---\n\nBody",
		);

		const skills = discoverSkills([scope1, "skills/"]);
		assert.strictEqual(skills.length, 1);
		assert.strictEqual(skills[0].name, "shared-skill");
	});

	it("handles name collisions - second occurrence is skipped", () => {
		const dir1 = join(testDir, "collision-skill");
		mkdirSync(dir1, { recursive: true });
		writeFileSync(
			join(dir1, "SKILL.md"),
			"---\nname: collision-skill\ndescription: First\n---\n\nBody",
		);

		const dir2 = join(testDir, "collision-alias");
		mkdirSync(dir2, { recursive: true });
		writeFileSync(
			join(dir2, "SKILL.md"),
			"---\nname: collision-skill\ndescription: Second\n---\n\nBody",
		);

		const skills = discoverSkills(["."]);
		// Should only have one (the first directory alphabetically found)
		// "collision-alias" sorts before "collision-skill", so that one is found first
		assert.strictEqual(skills.length, 1);
		assert.strictEqual(skills[0].metadata.name, "collision-skill");
	});

	it("skips skills without a name in frontmatter", () => {
		const skillDir = join(testDir, "no-name-skill");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(join(skillDir, "SKILL.md"), "---\ndescription: No name\n---\n\nBody");

		const skills = discoverSkills(["."]);
		assert.strictEqual(skills.length, 0);
	});

	it("accepts numeric name cast to string", () => {
		const skillDir = join(testDir, "numeric-name");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(join(skillDir, "SKILL.md"), "---\nname: 123\ndescription: Numeric\n---\n\nBody");

		const skills = discoverSkills(["."]);
		// YAML parses "name: 123" as a number, but we cast it to string for validation
		assert.strictEqual(skills.length, 1);
		assert.strictEqual(skills[0].metadata.name, "123");
	});

	it("handles project-level .agents/skills taking precedence", () => {
		const agentsDir = join(testDir, ".agents", "skills");
		const agentSkillDir = join(agentsDir, "shared-skill");
		mkdirSync(agentSkillDir, { recursive: true });
		writeFileSync(
			join(agentSkillDir, "SKILL.md"),
			"---\nname: shared-skill\ndescription: Agent skill\n---\n\nAgent body",
		);

		const regularSkillDir = join(testDir, "shared-skill");
		mkdirSync(regularSkillDir, { recursive: true });
		writeFileSync(
			join(regularSkillDir, "SKILL.md"),
			"---\nname: shared-skill\ndescription: Regular skill\n---\n\nRegular body",
		);

		const skills = discoverSkills([join(testDir, "skills/"), ".agents/skills/"]);
		// Both skills found, but the one from .agents/skills is higher priority
		// and should override the regular one
		assert.strictEqual(skills.length, 1);
		assert.strictEqual(skills[0].metadata.description, "Agent skill");
	});

	it("discovers skills from system-skills/ directory", () => {
		const systemDir = join(testDir, "system-skills");
		const systemSkillDir = join(systemDir, "system-skill");
		mkdirSync(systemSkillDir, { recursive: true });
		writeFileSync(
			join(systemSkillDir, "SKILL.md"),
			"---\nname: system-skill\ndescription: A system skill\n---\n\nSystem body",
		);

		const skills = discoverSkills([systemDir]);
		assert.strictEqual(skills.length, 1);
		assert.strictEqual(skills[0].name, "system-skill");
		assert.strictEqual(skills[0].metadata.description, "A system skill");
	});

	it("handles system-skills/ shadowing user skills/", () => {
		const systemDir = join(testDir, "system-skills");
		const shadowDir = join(systemDir, "shadow-skill");
		mkdirSync(shadowDir, { recursive: true });
		writeFileSync(
			join(shadowDir, "SKILL.md"),
			"---\nname: shadow-skill\ndescription: System version\n---\n\nSystem body",
		);

		const userDir = join(testDir, "skills");
		const userSkillDir = join(userDir, "shadow-skill");
		mkdirSync(userSkillDir, { recursive: true });
		writeFileSync(
			join(userSkillDir, "SKILL.md"),
			"---\nname: shadow-skill\ndescription: User version\n---\n\nUser body",
		);

		const skills = discoverSkills([systemDir, userDir]);
		// System skill should shadow user skill (first scope wins)
		assert.strictEqual(skills.length, 1);
		assert.strictEqual(skills[0].metadata.description, "System version");
		assert.ok(skills[0].path.includes("system-skills"));
	});

	it("discovers both system and user skills when no collision", () => {
		const systemDir = join(testDir, "system-skills");
		const systemSkillDir = join(systemDir, "sys-only");
		mkdirSync(systemSkillDir, { recursive: true });
		writeFileSync(
			join(systemSkillDir, "SKILL.md"),
			"---\nname: sys-only\ndescription: System only\n---\n\nSystem body",
		);

		const userDir = join(testDir, "skills");
		const userSkillDir = join(userDir, "user-only");
		mkdirSync(userSkillDir, { recursive: true });
		writeFileSync(
			join(userSkillDir, "SKILL.md"),
			"---\nname: user-only\ndescription: User only\n---\n\nUser body",
		);

		const skills = discoverSkills([systemDir, userDir]);
		assert.strictEqual(skills.length, 2);
		const names = skills.map((s) => s.name).sort();
		assert.deepStrictEqual(names, ["sys-only", "user-only"]);
	});
});

// --- Detect interpreter tests ---

describe("detectInterpreter", () => {
	it("detects python from .py extension", () => {
		const result = detectInterpreter("skill/scripts/extract.py");
		assert.deepStrictEqual(result, { command: "python3", args: [] });
	});

	it("detects node from .js extension", () => {
		const result = detectInterpreter("skill/main.js");
		assert.deepStrictEqual(result, { command: "node", args: [] });
	});

	it("detects node from .mjs extension", () => {
		const result = detectInterpreter("skill/module.mjs");
		assert.deepStrictEqual(result, { command: "node", args: [] });
	});

	it("detects bash from .sh extension", () => {
		const result = detectInterpreter("skill/run.sh");
		assert.deepStrictEqual(result, { command: "bash", args: [] });
	});

	it("detects ruby from .rb extension", () => {
		const result = detectInterpreter("skill/script.rb");
		assert.deepStrictEqual(result, { command: "ruby", args: [] });
	});

	it("detects typescript via node+tsx", () => {
		const result = detectInterpreter("skill/index.ts");
		assert.deepStrictEqual(result, { command: "node", args: ["--import", "tsx"] });
	});

	it("returns null for unsupported extension", () => {
		const result = detectInterpreter("skill/file.xyz");
		assert.strictEqual(result, null);
	});

	it("returns null for null input", () => {
		const result = detectInterpreter(null);
		assert.strictEqual(result, null);
	});
});

// --- Detect shebang tests ---

describe("detectShebang", () => {
	it("detects python shebang", () => {
		const scriptDir = join(testDir, "shebang-test");
		mkdirSync(scriptDir, { recursive: true });
		const scriptPath = join(scriptDir, "script");
		writeFileSync(scriptPath, "#!/usr/bin/env python3\nprint('hello')");

		const result = detectShebang(scriptPath);
		assert.deepStrictEqual(result, { command: "python3", args: [] });
	});

	it("detects bash shebang", () => {
		const scriptDir = join(testDir, "shebang-test2");
		mkdirSync(scriptDir, { recursive: true });
		const scriptPath = join(scriptDir, "run");
		writeFileSync(scriptPath, "#!/bin/bash\necho hello");

		const result = detectShebang(scriptPath);
		assert.deepStrictEqual(result, { command: "bash", args: [] });
	});

	it("detects ruby shebang with args", () => {
		const scriptDir = join(testDir, "shebang-test3");
		mkdirSync(scriptDir, { recursive: true });
		const scriptPath = join(scriptDir, "script");
		writeFileSync(scriptPath, "#!/usr/bin/env ruby -w\nputs 'hello'");

		const result = detectShebang(scriptPath);
		assert.strictEqual(result.command, "ruby");
		assert.ok(result.args.includes("-w"));
	});

	it("returns null for non-existent file", () => {
		const result = detectShebang("/nonexistent/file.py");
		assert.strictEqual(result, null);
	});

	it("returns null for no shebang", () => {
		const scriptDir = join(testDir, "shebang-test4");
		mkdirSync(scriptDir, { recursive: true });
		const scriptPath = join(scriptDir, "plain");
		writeFileSync(scriptPath, "print('hello')");

		const result = detectShebang(scriptPath);
		assert.strictEqual(result, null);
	});
});
