import { describe, it } from "node:test";
import assert from "node:assert";
import { AgentSchema } from "../../../../src/config/schemas/agent.js";

describe("AgentSchema", () => {
	it("defaults bundledSkills to true", () => {
		const result = AgentSchema.parse({});
		assert.strictEqual(result.bundledSkills, true);
	});

	it("accepts bundledSkills false", () => {
		const result = AgentSchema.parse({ bundledSkills: false });
		assert.strictEqual(result.bundledSkills, false);
	});

	it("defaults sampling to true", () => {
		const result = AgentSchema.parse({});
		assert.strictEqual(result.sampling, true);
	});
});
