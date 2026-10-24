import { describe, it } from "node:test";
import assert from "node:assert";
import { MemorySchema } from "../../../../src/config/schemas/memory.js";

describe("MemorySchema", () => {
	it("preserves checkpointsDir when configured", () => {
		const result = MemorySchema.parse({ checkpointsDir: "memory/checkpoints/custom/" });
		assert.strictEqual(result.checkpointsDir, "memory/checkpoints/custom/");
	});

	it("applies the default checkpointsDir when absent", () => {
		const result = MemorySchema.parse({});
		assert.strictEqual(result.checkpointsDir, "memory/checkpoints/");
	});

	it("does not strip checkpointsDir from a full config", () => {
		const result = MemorySchema.parse({
			directory: "memory/",
			contextDir: "memory/context/",
			schedulesDir: "memory/schedules/",
			sessionsDir: "memory/sessions/",
			screenshotsDir: "memory/screenshots/",
			checkpointsDir: "memory/checkpoints/",
			toolsDir: "memory/tools/",
			ephemeralLimit: 5,
			maxEntries: 100,
			maxTodos: 100,
		});
		assert.strictEqual(result.checkpointsDir, "memory/checkpoints/");
	});
});
