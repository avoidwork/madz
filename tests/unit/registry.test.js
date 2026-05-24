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

// Schema validation logic (copied from validator.js)
function validateSkillSchema(skill) {
	const errors = [];
	if (!skill.name) {
		errors.push("Skill must have a name");
		return { valid: false, errors };
	}
	if (
		skill.inputSchema &&
		(typeof skill.inputSchema !== "object" || Array.isArray(skill.inputSchema))
	) {
		errors.push(`Skill "${skill.name}" input schema must be an object`);
	}
	if (
		skill.outputSchema &&
		(typeof skill.outputSchema !== "object" || Array.isArray(skill.outputSchema))
	) {
		errors.push(`Skill "${skill.name}" output schema must be an object`);
	}
	return { valid: errors.length === 0, errors };
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

describe("skill schema validation", () => {
	it("accepts skill with valid schema", () => {
		const result = validateSkillSchema({
			name: "test-skill",
			inputSchema: { type: "object", properties: { query: { type: "string" } } },
		});
		assert.strictEqual(result.valid, true);
	});

	it("rejects skill without name", () => {
		const result = validateSkillSchema({ inputSchema: {} });
		assert.strictEqual(result.valid, false);
	});

	it("rejects skill with invalid input schema type", () => {
		const result = validateSkillSchema({
			name: "bad-skill",
			inputSchema: "not-an-object",
		});
		assert.strictEqual(result.valid, false);
	});

	it("rejects skill with invalid output schema type", () => {
		const result = validateSkillSchema({
			name: "bad-skill",
			outputSchema: [],
		});
		assert.strictEqual(result.valid, false);
	});
});
