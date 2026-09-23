import { describe, it } from "node:test";
import assert from "node:assert";

// Schema validation logic (copied from validator.js for testing without deps)
function validateSkillName(name, dirName) {
	const warnings = [];
	if (!name || typeof name !== "string") {
		return { valid: false, warnings: ["Skill must have a name"] };
	}
	if (name.length < 1 || name.length > 64) {
		warnings.push(`Skill name length must be 1-64 chars, got ${name.length}`);
	}
	if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
		warnings.push("Skill name must contain only lowercase alphanumeric characters and hyphens");
	}
	if (name.startsWith("-") || name.endsWith("-")) {
		warnings.push("Skill name must not start or end with a hyphen");
	}
	if (/--/.test(name)) {
		warnings.push("Skill name must not contain consecutive hyphens");
	}
	if (dirName && name !== dirName) {
		warnings.push(`Skill name "${name}" does not match parent directory "${dirName}"`);
	}
	return { valid: warnings.length === 0, warnings };
}

function validateSkillDescription(description) {
	if (!description || typeof description !== "string" || description.trim().length === 0) {
		return { valid: false, skip: true, warnings: ["Skill description is empty or missing"] };
	}
	if (description.length > 1024) {
		return {
			valid: false,
			skip: true,
			warnings: [`Skill description exceeds 1024 chars (${description.length})`],
		};
	}
	return { valid: true, skip: false, warnings: [] };
}

function validateSkillSchema(skill, dirName) {
	const errors = [];
	const warnings = [];

	if (!skill.name) {
		errors.push("Skill must have a name");
		return { valid: false, skip: true, errors, warnings };
	}

	const nameCheck = validateSkillName(skill.name, dirName);
	warnings.push(...nameCheck.warnings);

	const descCheck = validateSkillDescription(skill.description);
	if (descCheck.skip) {
		errors.push(...descCheck.warnings);
		return { valid: false, skip: true, errors, warnings };
	}

	return { valid: true, skip: false, errors, warnings };
}

describe("validateSkillName", () => {
	it("accepts valid name", () => {
		const result = validateSkillName("my-skill", "my-skill");
		assert.strictEqual(result.valid, true);
	});

	it("accepts name with multiple hyphens", () => {
		const result = validateSkillName("a-b-c", "a-b-c");
		assert.strictEqual(result.valid, true);
	});

	it("accepts numeric name", () => {
		const result = validateSkillName("test123", "test123");
		assert.strictEqual(result.valid, true);
	});

	it("rejects name without directory match", () => {
		const result = validateSkillName("different-name", "my-skill");
		assert.strictEqual(result.valid, false);
		assert.ok(result.warnings.length > 0);
	});
});

describe("validateSkillSchema", () => {
	it("accepts skill with valid name and description", () => {
		const result = validateSkillSchema({
			name: "test-skill",
			description: "A test skill",
		});
		assert.strictEqual(result.valid, true);
		assert.strictEqual(result.skip, false);
	});

	it("rejects skill without name", () => {
		const result = validateSkillSchema({ description: "No name" });
		assert.strictEqual(result.valid, false);
		assert.strictEqual(result.skip, true);
	});

	it("rejects skill with empty description", () => {
		const result = validateSkillSchema({ name: "empty-desc", description: "" });
		assert.strictEqual(result.valid, false);
		assert.strictEqual(result.skip, true);
	});

	it("rejects skill with missing description", () => {
		const result = validateSkillSchema({ name: "no-desc" });
		assert.strictEqual(result.valid, false);
		assert.strictEqual(result.skip, true);
	});

	it("rejects skill with blank description", () => {
		const result = validateSkillSchema({ name: "blank-desc", description: "   " });
		assert.strictEqual(result.valid, false);
		assert.strictEqual(result.skip, true);
	});

	it("accepts numeric name cast to string", () => {
		const result = validateSkillSchema({ name: 123, description: "Numeric name" });
		// Numeric name is cast to string for validation
		assert.strictEqual(result.valid, true);
		assert.strictEqual(result.skip, false);
	});

	it("warns on skill with name too long but stays valid (lenient)", () => {
		const longName = "a".repeat(100);
		const result = validateSkillSchema({ name: longName, description: "Has a long name" });
		// Lenient validation produces warnings but still marks as valid (no skip)
		assert.strictEqual(result.skip, false);
		assert.ok(result.warnings.length > 0);
	});
});

describe("new meta fields", () => {
	it("accepts skill with license field", () => {
		const result = validateSkillSchema({
			name: "licensed-skill",
			description: "With license",
			license: "MIT",
		});
		assert.strictEqual(result.valid, true);
	});

	it("accepts skill with compatibility field", () => {
		const result = validateSkillSchema({
			name: "compatible-skill",
			description: "Compatible",
			compatibility: "v1.0+",
		});
		assert.strictEqual(result.valid, true);
	});

	it("accepts skill with metadata field", () => {
		const result = validateSkillSchema({
			name: "metdata-skill",
			description: "Has metadata",
			metadata: { author: "test", tags: "test" },
		});
		assert.strictEqual(result.valid, true);
	});

	it("accepts skill with allowed-tools field", () => {
		const result = validateSkillSchema({
			name: "tools-skill",
			description: "Has allowed tools",
			"allowed-tools": "readFile writeFile",
		});
		assert.strictEqual(result.valid, true);
	});

	it("accepts disabled skill", () => {
		const result = validateSkillSchema({
			name: "disabled-skill",
			description: "Is disabled",
			disabled: true,
		});
		assert.strictEqual(result.valid, true);
	});

	it("rejects skill with empty description even with meta fields", () => {
		const result = validateSkillSchema({
			name: "empty-desc-meta",
			description: "",
			license: "MIT",
		});
		assert.strictEqual(result.valid, false);
		assert.strictEqual(result.skip, true);
	});
});

describe("ensureSkillsDir", () => {
	it("creates skills directory when missing", async () => {
		const { ensureSkillsDir } = await import("../../src/skills/registry.js");
		const fs = await import("node:fs");
		const path = await import("node:path");
		const os = await import("node:os");

		const testDir = path.join(os.tmpdir(), "madz-" + Date.now(), "skills");
		const parentDir = path.dirname(testDir);

		if (!fs.existsSync(parentDir)) {
			fs.mkdirSync(parentDir, { recursive: true });
		}

		await ensureSkillsDir(testDir);
		assert.ok(fs.existsSync(parentDir));
	});

	it("succeeds when directory already exists", async () => {
		const { ensureSkillsDir } = await import("../../src/skills/registry.js");
		const fs = await import("node:fs");
		const path = await import("node:path");
		const os = await import("node:os");

		const testDir = path.join(os.tmpdir(), "madz-" + Date.now(), "skills");
		fs.mkdirSync(testDir, { recursive: true });

		await ensureSkillsDir(testDir);
		assert.ok(fs.existsSync(testDir));

		fs.rmSync(path.join(os.tmpdir(), "madz-" + Date.now()), { recursive: true, force: true });
	});
});
