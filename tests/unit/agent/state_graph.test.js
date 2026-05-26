import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { graphCache } from "../../../src/agent/react.js";

describe("buildCheckpointedGraph", () => {
	beforeEach(() => {
		graphCache.clear();
	});

	afterEach(() => {
		graphCache.clear();
	});

	it("creates a compiled agent with checkpointer", async () => {
		const fakeModel = { lc_kwargs: { model: "test" } };
		// Force reimport to get fresh module reference for cache
		const { createReactAgent: cra } = await import("../../../src/agent/react.js");
		const agent = cra(fakeModel, [], ":memory:");
		assert.ok(agent);
		assert.ok(typeof agent.invoke === "function");
	});

	it("caches compiled agents by dbPath and model name", async () => {
		const fakeModel = { lc_kwargs: { model: "test-cache" } };
		const { createReactAgent: cra } = await import("../../../src/agent/react.js");
		const agent1 = cra(fakeModel, [], ":memory:");
		const agent2 = cra(fakeModel, [], ":memory:");
		assert.strictEqual(agent1, agent2);
	});

	it("creates separate agents for different models", async () => {
		const fakeModel1 = { modelName: "model-a" };
		const fakeModel2 = { modelName: "model-b" };
		const { createReactAgent: cra } = await import("../../../src/agent/react.js");
		const agent1 = cra(fakeModel1, [], ":memory:");
		const agent2 = cra(fakeModel2, [], ":memory:");
		assert.notStrictEqual(agent1, agent2);
	});

	it("caches by both dbPath and model", async () => {
		const fakeModel = { lc_kwargs: { model: "shared-model" } };
		const { createReactAgent: cra } = await import("../../../src/agent/react.js");
		const agent1 = cra(fakeModel, [], ":memory:");
		const agent2 = cra(fakeModel, [], "different-path");
		assert.notStrictEqual(agent1, agent2);
	});
});
