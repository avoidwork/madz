import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { chdir } from "node:process";
import { join } from "node:path";
import { discoverSkills } from "../../src/registry/discoverer.js";

let testDir;
let originalCwd;

function setup() {
	originalCwd = process.cwd();
	testDir = join(tmpdir(), "madz-discover-test-" + Date.now());
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

describe("discoverer - with metadata file", () => {
	beforeEach(setup);
	afterEach(cleanup);

	it("discovers skills with skill.yaml", () => {
		const skillDir = join(testDir, "my-skill");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(join(skillDir, "skill.yaml"), "name: my-skill\nversion: 1.0.0\n");

		const skills = discoverSkills(".");
		assert.strictEqual(skills.length, 1);
		assert.strictEqual(skills[0].name, "my-skill");
		assert.strictEqual(skills[0].metadata.name, "my-skill");
		assert.strictEqual(skills[0].metadata.version, "1.0.0");
		assert.ok(skills[0].metadata._path.endsWith("/skill.yaml"));
	});

	it("discovers skills with skill.json", () => {
		const skillDir = join(testDir, "json-skill");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(join(skillDir, "skill.json"), JSON.stringify({ name: "json-skill" }));

		const skills = discoverSkills(".");
		assert.strictEqual(skills.length, 1);
		assert.strictEqual(skills[0].name, "json-skill");
		assert.ok(skills[0].metadata._path.endsWith("/skill.json"));
	});

	it("skips directories without metadata files", () => {
		const emptyDir = join(testDir, "empty-skill");
		mkdirSync(emptyDir, { recursive: true });

		const skills = discoverSkills(".");
		assert.strictEqual(skills.length, 0);
	});
});

describe("discoverer - SKILL.md fallback", () => {
	beforeEach(setup);
	afterEach(cleanup);

	it("discovers skills with only SKILL.md", () => {
		const skillDir = join(testDir, "markdown-skill");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(join(skillDir, "SKILL.md"), "# Markdown skill\n\nThis is a skill.");

		const skills = discoverSkills(".");
		assert.strictEqual(skills.length, 1);
		assert.strictEqual(skills[0].name, "markdown-skill");
		assert.strictEqual(skills[0].metadata.name, "markdown-skill");
		assert.ok(skills[0].metadata._path.endsWith("/SKILL.md"));
	});

	it("discovers skill with SKILL.md and scripts directory", () => {
		const skillDir = join(testDir, "script-skill");
		mkdirSync(join(skillDir, "scripts"), { recursive: true });
		writeFileSync(join(skillDir, "SKILL.md"), "# Script skill\n\nRun scripts.");

		const skills = discoverSkills(".");
		assert.strictEqual(skills.length, 1);
		assert.ok(skills[0].metadata.scripts.endsWith("scripts"));
	});

	it("skips SKILL.md-only skills without SKILL.md fallback", () => {
		// Empty directory — no metadata, no SKILL.md
		const emptyDir = join(testDir, "nothing-skill");
		mkdirSync(emptyDir, { recursive: true });

		const skills = discoverSkills(".");
		assert.strictEqual(skills.length, 0);
	});
});

describe("discoverer - mixed", () => {
	beforeEach(setup);
	afterEach(cleanup);

	it("discovers both metadata and SKILL.md-only skills", () => {
		const metaDir = join(testDir, "meta-skill");
		mkdirSync(metaDir, { recursive: true });
		writeFileSync(join(metaDir, "skill.yaml"), "name: meta-skill\n");

		const mdDir = join(testDir, "md-skill");
		mkdirSync(mdDir, { recursive: true });
		writeFileSync(join(mdDir, "SKILL.md"), "# Markdown skill\n");

		const skills = discoverSkills(".");
		assert.strictEqual(skills.length, 2);
		const names = skills.map((s) => s.name).sort();
		assert.deepStrictEqual(names, ["md-skill", "meta-skill"]);
	});
});
