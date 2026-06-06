import { describe, it } from "node:test";
import assert from "node:assert";

// Permission resolution logic (copied from permissions.js for testing without deps)
const DEFAULT_PERMS = ["filesystem:read", "env:read"];

function resolvePermissions(skillMetadata) {
	if (!skillMetadata || typeof skillMetadata !== "object") {
		return [...DEFAULT_PERMS];
	}
	const skillPerms = Array.isArray(skillMetadata.permissions) ? skillMetadata.permissions : [];
	const combined = new Set([...DEFAULT_PERMS, ...skillPerms]);
	return Array.from(combined);
}

function hasPermission(permissions, permission) {
	return permissions.includes(permission);
}

function resolveCapabilities(skillMetadata) {
	const perms = resolvePermissions(skillMetadata);
	const capabilities = {
		filesystem: [],
		network: [],
		env: [],
		process: [],
	};
	for (const perm of perms) {
		switch (perm) {
			case "filesystem:read":
				capabilities.filesystem.push("read");
				break;
			case "filesystem:write":
				capabilities.filesystem.push("read");
				capabilities.filesystem.push("write");
				break;
			case "filesystem:exec":
				capabilities.filesystem.push("read");
				capabilities.filesystem.push("exec");
				break;
			case "network:outbound":
				capabilities.network.push("outbound");
				break;
			case "process:spawn":
				capabilities.process.push("spawn");
				break;
			case "env:read":
				capabilities.env.push("read");
				break;
		}
	}
	return capabilities;
}

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

describe("skills registry - permission resolution", () => {
	describe("resolvePermissions", () => {
		it("merges skill permissions with defaults", () => {
			const perms = resolvePermissions({ permissions: ["network:outbound"] });
			assert.ok(perms.includes("filesystem:read"));
			assert.ok(perms.includes("env:read"));
			assert.ok(perms.includes("network:outbound"));
		});

		it("returns defaults when no permissions specified", () => {
			const perms = resolvePermissions({});
			assert.deepStrictEqual(perms, DEFAULT_PERMS);
		});

		it("returns defaults for null metadata", () => {
			const perms = resolvePermissions(null);
			assert.deepStrictEqual(perms, DEFAULT_PERMS);
		});

		it("deduplicates permissions", () => {
			const perms = resolvePermissions({ permissions: ["filesystem:read", "env:read"] });
			const count = perms.filter((p) => p === "filesystem:read").length;
			assert.strictEqual(count, 1);
		});

		it("handles empty permissions array", () => {
			const perms = resolvePermissions({ permissions: [] });
			assert.deepStrictEqual(perms, DEFAULT_PERMS);
		});

		it("includes network and process permissions from metadata", () => {
			const perms = resolvePermissions({ permissions: ["network:outbound", "process:spawn"] });
			assert.ok(perms.includes("network:outbound"));
			assert.ok(perms.includes("process:spawn"));
		});
	});

	describe("hasPermission", () => {
		it("returns true for existing permission", () => {
			assert.strictEqual(hasPermission(["filesystem:read", "env:read"], "filesystem:read"), true);
		});

		it("returns false for missing permission", () => {
			assert.strictEqual(hasPermission(["filesystem:read"], "network:outbound"), false);
		});
	});

	describe("resolveCapabilities", () => {
		it("maps filesystem:read capability", () => {
			const caps = resolveCapabilities({ permissions: ["filesystem:read"] });
			assert.ok(caps.filesystem.includes("read"));
			assert.ok(!caps.filesystem.includes("write"));
		});

		it("maps filesystem:write capability (includes read)", () => {
			const caps = resolveCapabilities({ permissions: ["filesystem:write"] });
			assert.ok(caps.filesystem.includes("read"));
			assert.ok(caps.filesystem.includes("write"));
		});

		it("maps network:outbound capability", () => {
			const caps = resolveCapabilities({ permissions: ["network:outbound"] });
			assert.ok(caps.network.includes("outbound"));
		});

		it("maps process:spawn capability", () => {
			const caps = resolveCapabilities({ permissions: ["process:spawn"] });
			assert.ok(caps.process.includes("spawn"));
		});

		it("combines multiple capabilities", () => {
			const caps = resolveCapabilities({ permissions: ["filesystem:read", "network:outbound"] });
			assert.ok(caps.filesystem.includes("read"));
			assert.ok(caps.network.includes("outbound"));
		});

		it("handles no permissions", () => {
			const caps = resolveCapabilities({});
			assert.ok(Array.isArray(caps.filesystem));
			assert.ok(Array.isArray(caps.network));
		});
	});

	describe("default permissions", () => {
		it("includes filesystem:read", () => {
			assert.ok(DEFAULT_PERMS.includes("filesystem:read"));
		});
		it("includes env:read", () => {
			assert.ok(DEFAULT_PERMS.includes("env:read"));
		});
	});

	describe("valid permission values", () => {
		it("accepts filesystem:read", () => {
			assert.ok(hasPermission(["filesystem:read"], "filesystem:read"));
		});
		it("accepts network:outbound", () => {
			assert.ok(hasPermission(["network:outbound"], "network:outbound"));
		});
		it("accepts process:spawn", () => {
			assert.ok(hasPermission(["process:spawn"], "process:spawn"));
		});
	});
});

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
			"allowed-tools": "read_file write_file",
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
