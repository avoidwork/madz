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

	it("defaults autoContinueLimit to 1000", () => {
		const result = AgentSchema.parse({});
		assert.strictEqual(result.autoContinueLimit, 1000);
	});

	it("accepts a custom autoContinueLimit", () => {
		const result = AgentSchema.parse({ autoContinueLimit: 5 });
		assert.strictEqual(result.autoContinueLimit, 5);
	});

	it("rejects a non-positive autoContinueLimit", () => {
		assert.throws(() => AgentSchema.parse({ autoContinueLimit: 0 }));
		assert.throws(() => AgentSchema.parse({ autoContinueLimit: -1 }));
	});
});
