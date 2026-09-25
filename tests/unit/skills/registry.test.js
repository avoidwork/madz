import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { chdir } from "node:process";
import { join } from "node:path";
import { SkillRegistry } from "../../../src/skills/registry.js";

let testDir;
let originalCwd;

function setup() {
	originalCwd = process.cwd();
	testDir = join(tmpdir(), "madz-registry-test-" + Date.now());
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

describe("SkillRegistry.discover name drift", () => {
	beforeEach(setup);
	afterEach(cleanup);

	it("uses the directory name as the canonical identifier when frontmatter name matches", async () => {
		const skillDir = join(testDir, "my-skill");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(
			join(skillDir, "SKILL.md"),
			"---\nname: my-skill\ndescription: A test skill\n---\n\nBody",
		);

		const registry = new SkillRegistry();
		const results = await registry.discover([testDir]);

		assert.strictEqual(results.length, 1);
		assert.strictEqual(results[0].name, "my-skill");
		assert.strictEqual(registry.get("my-skill").name, "my-skill");
		assert.strictEqual(registry.get("my-skill").metadata.name, "my-skill");
		assert.strictEqual(registry.list()[0], "my-skill");
		// No drift warning when names match
		assert.ok(!results[0].warnings.some((w) => w.includes("does not match directory")));
	});

	it("uses the directory name as the canonical identifier when frontmatter name drifts", async () => {
		const skillDir = join(testDir, "dir-name");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(
			join(skillDir, "SKILL.md"),
			"---\nname: frontmatter-name\ndescription: A test skill\n---\n\nBody",
		);

		const registry = new SkillRegistry();
		const results = await registry.discover([testDir]);

		assert.strictEqual(results.length, 1);
		// The canonical identifier is the directory name, not the frontmatter name
		assert.strictEqual(results[0].name, "dir-name");
		assert.strictEqual(registry.get("dir-name").name, "dir-name");
		assert.strictEqual(registry.get("dir-name").metadata.name, "frontmatter-name");
		assert.strictEqual(registry.list()[0], "dir-name");
		// The frontmatter name is not used as the registry key
		assert.strictEqual(registry.get("frontmatter-name"), null);
	});

	it("emits a warning when the frontmatter name drifts from the directory name", async () => {
		const skillDir = join(testDir, "dir-name");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(
			join(skillDir, "SKILL.md"),
			"---\nname: frontmatter-name\ndescription: A test skill\n---\n\nBody",
		);

		const registry = new SkillRegistry();
		const results = await registry.discover([testDir]);

		assert.strictEqual(results.length, 1);
		assert.ok(
			results[0].warnings.some((w) =>
				w.includes('frontmatter name "frontmatter-name" does not match directory name "dir-name"'),
			),
		);
		// The warning is also present on the registered entry
		assert.ok(
			registry
				.get("dir-name")
				.warnings.some((w) =>
					w.includes(
						'frontmatter name "frontmatter-name" does not match directory name "dir-name"',
					),
				),
		);
	});

	it("does not emit a drift warning when frontmatter name matches the directory name", async () => {
		const skillDir = join(testDir, "matching-skill");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(
			join(skillDir, "SKILL.md"),
			"---\nname: matching-skill\ndescription: A test skill\n---\n\nBody",
		);

		const registry = new SkillRegistry();
		const results = await registry.discover([testDir]);

		assert.strictEqual(results.length, 1);
		assert.ok(!results[0].warnings.some((w) => w.includes("does not match directory")));
	});

	it("surfaces the canonical directory name in the catalog", async () => {
		const skillDir = join(testDir, "catalog-name");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(
			join(skillDir, "SKILL.md"),
			"---\nname: frontmatter-name\ndescription: A test skill\n---\n\nBody",
		);

		const registry = new SkillRegistry();
		await registry.discover([testDir]);
		const catalog = registry.getCatalog();

		assert.strictEqual(catalog.length, 1);
		assert.strictEqual(catalog[0].name, "catalog-name");
	});
});
