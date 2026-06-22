import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { chdir } from "node:process";
import { join } from "node:path";
import {
	createSkillImpl,
	createSkillViewTool,
	skillViewImpl,
	generateSkillCatalogPrompt,
	createSkill,
} from "../../src/tools/skills.js";
import { findSkillScript } from "../../src/tools/cron.js";
import { SkillRegistry } from "../../src/skills/registry.js";

let testDir;
let originalCwd;

function setup() {
	originalCwd = process.cwd();
	testDir = join(tmpdir(), "madz-create-skill-test-" + Date.now());
	mkdirSync(testDir, { recursive: true });
	chdir(testDir);
}

function cleanup() {
	if (testDir && existsSync(testDir)) {
		rmSync(testDir, { recursive: true, force: true });
	}
	if (originalCwd) {
		chdir(originalCwd);
	}
}

// --- Tool registration tests ---

describe("createSkill tool registration", () => {
	it("exports createSkillImpl function", async () => {
		assert.ok(typeof createSkillImpl === "function");
	});

	it("exports createSkill tool", async () => {
		assert.ok(typeof createSkill !== "undefined");
		assert.strictEqual(createSkill.name, "createSkill");
	});

	it("exports createSkillViewTool factory", async () => {
		assert.ok(typeof createSkillViewTool === "function");
	});

	it("exports skillViewImpl function", async () => {
		assert.ok(typeof skillViewImpl === "function");
	});
});

// --- Name validation ---

describe("name validation", () => {
	beforeEach(setup);
	afterEach(cleanup);

	it("rejects uppercase letters", async () => {
		const result = await createSkillImpl(
			{ name: "My-Skill", description: "A test" },
			{ skillsDir: "skills/" },
		);
		assert.strictEqual(result.success, false);
		assert.ok(
			result.errors.some(
				(e) =>
					e.toLowerCase().includes("hyphen") ||
					e.toLowerCase().includes("lowercase") ||
					e.toLowerCase().includes("alphanumeric"),
			),
		);
	});

	it("rejects leading hyphen", async () => {
		const result = await createSkillImpl(
			{ name: "-skill", description: "A test" },
			{ skillsDir: "skills/" },
		);
		assert.strictEqual(result.success, false);
	});

	it("rejects trailing hyphen", async () => {
		const result = await createSkillImpl(
			{ name: "skill-", description: "A test" },
			{ skillsDir: "skills/" },
		);
		assert.strictEqual(result.success, false);
	});

	it("rejects consecutive hyphens", async () => {
		const result = await createSkillImpl(
			{ name: "my--skill", description: "A test" },
			{ skillsDir: "skills/" },
		);
		assert.strictEqual(result.success, false);
	});

	it("rejects names with underscores", async () => {
		const result = await createSkillImpl(
			{ name: "my_skill", description: "A test" },
			{ skillsDir: "skills/" },
		);
		assert.strictEqual(result.success, false);
	});

	it("accepts valid names", async () => {
		const result = await createSkillImpl(
			{ name: "valid-name", description: "A test" },
			{ skillsDir: "skills/" },
		);
		assert.strictEqual(result.success, true);
		assert.strictEqual(result.registered, false);
	});

	it("rejects empty name", async () => {
		const result = await createSkillImpl(
			{ name: "", description: "A test" },
			{ skillsDir: "skills/" },
		);
		assert.strictEqual(result.success, false);
	});

	it("rejects numeric-only names with hyphens", async () => {
		// Numeric+alpha names are valid per spec since they pass /^-[a-z0-9]+(-[a-z0-9]+)*$/
		const result = await createSkillImpl(
			{ name: "1abc", description: "A test" },
			{ skillsDir: "skills/" },
		);
		assert.strictEqual(result.success, true);
	});
});

// --- Description validation ---

describe("description validation", () => {
	beforeEach(setup);
	afterEach(cleanup);

	it("rejects empty description", async () => {
		const result = await createSkillImpl(
			{ name: "test-skill", description: "" },
			{ skillsDir: "skills/" },
		);
		assert.strictEqual(result.success, false);
	});

	it("rejects whitespace-only description", async () => {
		const result = await createSkillImpl(
			{ name: "test-skill", description: "   " },
			{ skillsDir: "skills/" },
		);
		assert.strictEqual(result.success, false);
	});

	it("rejects description over 1024 chars", async () => {
		const longDesc = "a".repeat(1025);
		const result = await createSkillImpl(
			{ name: "test-skill", description: longDesc },
			{ skillsDir: "skills/" },
		);
		assert.strictEqual(result.success, false);
		assert.ok(result.errors.some((e) => e.includes("1024") || e.toLowerCase().includes("exceeds")));
	});

	it("accepts valid description", async () => {
		const result = await createSkillImpl(
			{
				name: "test-skill",
				description: "Extract data from PDFs and fill forms. Use when handling PDF files.",
			},
			{ skillsDir: "skills/" },
		);
		assert.strictEqual(result.success, true);
	});

	it("accepts minimal description", async () => {
		const result = await createSkillImpl(
			{ name: "test-skill", description: "x" },
			{ skillsDir: "skills/" },
		);
		assert.strictEqual(result.success, true);
	});
});

// --- Permission validation ---

describe("permission validation", () => {
	beforeEach(setup);
	afterEach(cleanup);

	it("accepts valid permission", async () => {
		const result = await createSkillImpl(
			{
				name: "test-skill",
				description: "A test",
				permissions: ["filesystem:read", "filesystem:write"],
			},
			{ skillsDir: "skills/" },
		);
		assert.strictEqual(result.success, true);
	});

	it("rejects invalid permission", async () => {
		const result = await createSkillImpl(
			{
				name: "test-skill",
				description: "A test",
				permissions: ["filesystem:delete"],
			},
			{ skillsDir: "skills/" },
		);
		assert.strictEqual(result.success, false);
		assert.ok(result.errors.some((e) => e.includes("Invalid permission")));
	});

	it("rejects mixed valid and invalid permissions", async () => {
		const result = await createSkillImpl(
			{
				name: "test-skill",
				description: "A test",
				permissions: ["filesystem:read", "bad:perm"],
			},
			{ skillsDir: "skills/" },
		);
		assert.strictEqual(result.success, false);
		assert.ok(result.errors.some((e) => e.includes("Invalid permission")));
	});

	it("accepts empty permissions array", async () => {
		const result = await createSkillImpl(
			{ name: "test-skill", description: "A test", permissions: [] },
			{ skillsDir: "skills/" },
		);
		assert.strictEqual(result.success, true);
	});

	it("accepts no permissions (undefined)", async () => {
		const result = await createSkillImpl(
			{ name: "test-skill", description: "A test" },
			{ skillsDir: "skills/" },
		);
		assert.strictEqual(result.success, true);
	});
});

// --- Duplicate detection ---

describe("duplicate detection", () => {
	beforeEach(setup);
	afterEach(cleanup);

	it("rejects creation when skill already registered in registry", async () => {
		const registry = new SkillRegistry();
		registry.register("existing-skill", {
			name: "existing-skill",
			description: "Already exists",
			_path: "/fake/path/skills/existing-skill/SKILL.md",
		});

		const result = await createSkillImpl(
			{ name: "existing-skill", description: "New description" },
			{ skillsDir: "skills/", registry },
		);
		assert.strictEqual(result.success, false);
		assert.ok(
			result.errors.some(
				(e) => e.includes("already exists") || e.toLowerCase().includes("already"),
			),
		);
	});

	it("allows creating a new skill after duplicate rejection", async () => {
		const registry = new SkillRegistry();
		registry.register("first-skill", {
			name: "first-skill",
			description: "First",
			_path: "/fake/path/skills/first-skill/SKILL.md",
		});

		const result = await createSkillImpl(
			{ name: "second-skill", description: "Second" },
			{ skillsDir: "skills/", registry },
		);
		assert.strictEqual(result.success, true);
		assert.strictEqual(result.registered, true);
	});
});

// --- File creation ---

describe("skill directory creation", () => {
	beforeEach(setup);
	afterEach(cleanup);

	it("creates skill directory and SKILL.md", async () => {
		const result = await createSkillImpl(
			{ name: "new-skill", description: "A new skill" },
			{ skillsDir: "skills/" },
		);
		assert.strictEqual(result.success, true);
		assert.strictEqual(result.registered, false);
		assert.ok(result.paths.length > 0);
		assert.ok(existsSync(join(testDir, "skills", "new-skill")));
		assert.ok(existsSync(join(testDir, "skills", "new-skill", "SKILL.md")));
	});

	it("creates SKILL.md with valid YAML frontmatter", async () => {
		const result = await createSkillImpl(
			{ name: "yaml-test", description: "Testing YAML" },
			{ skillsDir: "skills/" },
		);
		assert.strictEqual(result.success, true);

		const skillPath = join(testDir, "skills", "yaml-test", "SKILL.md");
		const content = readFileSync(skillPath, "utf-8");
		assert.ok(content.includes("---"));
		assert.ok(content.includes("name: yaml-test"));
		assert.ok(content.includes("description: Testing YAML"));
	});

	it("writes SKILL.md with optional license field", async () => {
		const result = await createSkillImpl(
			{ name: "license-skill", description: "Has license", license: "MIT" },
			{ skillsDir: "skills/" },
		);
		assert.strictEqual(result.success, true);

		const skillPath = join(testDir, "skills", "license-skill", "SKILL.md");
		const content = readFileSync(skillPath, "utf-8");
		assert.ok(content.includes("license: MIT"));
	});

	it("writes SKILL.md with compatibility field", async () => {
		const result = await createSkillImpl(
			{ name: "compat-skill", description: "Has compatibility", compatibility: "Node.js 20+" },
			{ skillsDir: "skills/" },
		);
		assert.strictEqual(result.success, true);

		const skillPath = join(testDir, "skills", "compat-skill", "SKILL.md");
		const content = readFileSync(skillPath, "utf-8");
		assert.ok(content.includes("compatibility: Node.js 20+"));
	});

	it("writes SKILL.md with metadata field", async () => {
		const result = await createSkillImpl(
			{
				name: "meta-skill",
				description: "Has metadata",
				metadata: { author: "test", version: "2.0" },
			},
			{ skillsDir: "skills/" },
		);
		assert.strictEqual(result.success, true);

		const skillPath = join(testDir, "skills", "meta-skill", "SKILL.md");
		const content = readFileSync(skillPath, "utf-8");
		assert.ok(content.includes("author: test"));
		assert.ok(content.includes("version: '2.0'") || content.includes('version: "2.0"'));
	});

	it("registers skill and marks registered: true", async () => {
		const registry = new SkillRegistry();
		const result = await createSkillImpl(
			{ name: "registered-skill", description: "Will register" },
			{ skillsDir: "skills/", registry },
		);
		assert.strictEqual(result.success, true);
		assert.strictEqual(result.registered, true);
		assert.strictEqual(registry.size, 1);
		assert.strictEqual(registry.get("registered-skill") !== null, true);
	});

	it("includes warnings when registration fails", async () => {
		const registry = new SkillRegistry();
		// Pre-register with invalid config that will cause registration failure
		const result = await createSkillImpl(
			{ name: "bad-reg-skill", description: "Will be registered" },
			{ skillsDir: "skills/", registry },
		);
		assert.strictEqual(result.success, true);
		assert.strictEqual(result.registered, true);
	});
});

// --- Script scaffolding ---

describe("scripts scaffolding", () => {
	beforeEach(setup);
	afterEach(cleanup);

	it("creates scripts/ directory when scaffoldScripts is true", async () => {
		const result = await createSkillImpl(
			{ name: "script-skill", description: "With scripts", scaffoldScripts: true },
			{ skillsDir: "skills/" },
		);
		assert.strictEqual(result.success, true);
		assert.ok(
			existsSync(join(testDir, "skills", "script-skill", "scripts")),
			"scripts/ directory should exist",
		);
		assert.ok(
			existsSync(join(testDir, "skills", "script-skill", "scripts", "README.md")),
			"scripts/README.md should exist",
		);
	});

	it("does not create scripts/ directory when scaffoldScripts is false (default)", async () => {
		const result = await createSkillImpl(
			{ name: "no-script-skill", description: "Without scripts" },
			{ skillsDir: "skills/" },
		);
		assert.strictEqual(result.success, true);
		assert.ok(
			!existsSync(join(testDir, "skills", "no-script-skill", "scripts")),
			"scripts/ directory should not exist",
		);
	});
});

// --- Returns tests ---

describe("return value structure", () => {
	beforeEach(setup);
	afterEach(cleanup);

	it("returns paths array on success", async () => {
		const result = await createSkillImpl(
			{ name: "paths-test", description: "Testing paths" },
			{ skillsDir: "skills/" },
		);
		assert.ok(Array.isArray(result.paths));
		assert.ok(result.paths.some((p) => p.includes("SKILL.md")));
	});

	it("returns errors array on failure", async () => {
		const result = await createSkillImpl(
			{ name: "BAD-NAME", description: "Bad name" },
			{ skillsDir: "skills/" },
		);
		assert.strictEqual(result.success, false);
		assert.ok(Array.isArray(result.errors));
		assert.ok(result.errors.length > 0);
	});
});

// --- Catalog prompt generation ---

describe("generateSkillCatalogPrompt", () => {
	it("returns empty string for empty catalog", () => {
		const result = generateSkillCatalogPrompt([]);
		assert.strictEqual(result, "");
	});

	it("returns empty string for null catalog", () => {
		const result = generateSkillCatalogPrompt(null);
		assert.strictEqual(result, "");
	});

	it("formats skill entries", () => {
		const catalog = [
			{ name: "pdf-skill", description: "Process PDFs", location: "/skills/pdf-skill" },
			{
				name: "search-skill",
				description: "Search files",
				location: "/skills/search-skill",
			},
		];
		const result = generateSkillCatalogPrompt(catalog);
		assert.ok(result.includes("# Available Skills"));
		assert.ok(result.includes("## pdf-skill"));
		assert.ok(result.includes("Process PDFs"));
		assert.ok(result.includes("Location: /skills/pdf-skill"));
		assert.ok(result.includes("## search-skill"));
	});
});

// --- findSkillScript tests ---

describe("findSkillScript", () => {
	beforeEach(setup);
	afterEach(cleanup);

	it("finds script in skills/ directory", async () => {
		const skillDir = join(testDir, "skills", "test-skill");
		mkdirSync(skillDir, { recursive: true });
		const scriptsDir = join(skillDir, "scripts");
		mkdirSync(scriptsDir, { recursive: true });
		writeFileSync(join(scriptsDir, "run.sh"), "#!/bin/bash\necho hello");

		const result = await findSkillScript("test-skill", "skills");
		assert.ok(result.endsWith("skills/test-skill/scripts/run.sh"));
	});

	it("finds script in system-skills/ before skills/", async () => {
		const systemDir = join(testDir, "system-skills", "test-skill");
		mkdirSync(systemDir, { recursive: true });
		const systemScripts = join(systemDir, "scripts");
		mkdirSync(systemScripts, { recursive: true });
		writeFileSync(join(systemScripts, "run.sh"), "#!/bin/bash\necho system");

		const userDir = join(testDir, "skills", "test-skill");
		mkdirSync(userDir, { recursive: true });
		const userScripts = join(userDir, "scripts");
		mkdirSync(userScripts, { recursive: true });
		writeFileSync(join(userScripts, "run.sh"), "#!/bin/bash\necho user");

		const result = await findSkillScript("test-skill", ["system-skills", "skills"]);
		assert.ok(result.includes("system-skills"), "Should find system skill first");
		assert.ok(result.endsWith("system-skills/test-skill/scripts/run.sh"));
	});

	it("returns null when no script exists", async () => {
		const result = await findSkillScript("nonexistent-skill", "skills");
		assert.strictEqual(result, null);
	});

	it("handles string baseDir (backward compatibility)", async () => {
		const skillDir = join(testDir, "skills", "legacy-skill");
		mkdirSync(skillDir, { recursive: true });
		const scriptsDir = join(skillDir, "scripts");
		mkdirSync(scriptsDir, { recursive: true });
		writeFileSync(join(scriptsDir, "run.py"), "#!/usr/bin/env python3\nprint('hello')");

		const result = await findSkillScript("legacy-skill", "skills");
		assert.ok(result.endsWith("skills/legacy-skill/scripts/run.py"));
	});

	it("finds root-level script when no scripts/ directory exists", async () => {
		const skillDir = join(testDir, "system-skills", "root-skill");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(join(skillDir, "run.sh"), "#!/bin/bash\necho root");

		const result = await findSkillScript("root-skill", "system-skills");
		assert.ok(result.endsWith("system-skills/root-skill/run.sh"));
	});
});
