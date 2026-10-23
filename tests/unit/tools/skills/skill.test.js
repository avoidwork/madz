import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { chdir } from "node:process";
import { join } from "node:path";
import { SkillRegistry } from "../../../../src/skills/registry.js";
import { skillImpl } from "../../../../src/tools/skills/index.js";

let testDir;
let originalCwd;

function setup() {
	originalCwd = process.cwd();
	testDir = join(tmpdir(), "madz-skill-tool-test-" + Date.now());
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

async function makeRegistry() {
	const skillDir = join(testDir, "my-skill");
	mkdirSync(skillDir, { recursive: true });
	writeFileSync(
		join(skillDir, "SKILL.md"),
		"---\nname: my-skill\ndescription: A test skill\n---\n\nBody content",
	);
	const scriptsDir = join(skillDir, "scripts");
	mkdirSync(scriptsDir, { recursive: true });
	writeFileSync(join(scriptsDir, "run.sh"), "#!/bin/sh\necho hi\n");

	const registry = new SkillRegistry();
	await registry.discover([testDir]);
	return registry;
}

describe("skill tool", () => {
	beforeEach(setup);
	afterEach(cleanup);

	it("returns the full SKILL.md body for a registered skill", async () => {
		const registry = await makeRegistry();
		const result = await skillImpl({ name: "my-skill" }, { registry });
		assert.strictEqual(result.name, "my-skill");
		assert.ok(result.body.includes("Body content"));
		assert.strictEqual(result.error, undefined);
	});

	it("returns a clear error for an unknown skill", async () => {
		const registry = await makeRegistry();
		const result = await skillImpl({ name: "nope" }, { registry });
		assert.ok(result.error.includes("not found"));
	});

	it("returns a clear error when the registry is unavailable", async () => {
		const result = await skillImpl({ name: "my-skill" }, {});
		assert.ok(result.error.includes("registry is unavailable"));
	});

	it("populates files for a skill with a scripts/ directory", async () => {
		const registry = await makeRegistry();
		const result = await skillImpl({ name: "my-skill" }, { registry });
		assert.ok(Array.isArray(result.files));
		assert.ok(result.files.some((f) => f.includes("scripts/run.sh")));
	});

	it("returns an empty files array when a skill has no supporting files", async () => {
		const skillDir = join(testDir, "bare-skill");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(
			join(skillDir, "SKILL.md"),
			"---\nname: bare-skill\ndescription: A bare skill\n---\n\nBody",
		);
		const registry = new SkillRegistry();
		await registry.discover([testDir]);
		const result = await skillImpl({ name: "bare-skill" }, { registry });
		assert.deepStrictEqual(result.files, []);
	});

	it("returns a clear error when the skill body cannot be loaded", async () => {
		const registry = new SkillRegistry();
		// Register a skill with a body path that does not exist on disk.
		registry.register("ghost-skill", {
			name: "ghost-skill",
			description: "A skill whose body is missing",
			_path: join(testDir, "ghost-skill", "SKILL.md"),
			_directory: join(testDir, "ghost-skill"),
		});
		const result = await skillImpl({ name: "ghost-skill" }, { registry });
		assert.ok(result.error.includes("could not be loaded"));
	});
});
