import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("poppy - tool registry", () => {
	it("registers poppy in TOOL_PERMISSIONS with network:outbound", async () => {
		const { TOOL_PERMISSIONS } = await import("../../../../src/tools/index.js");
		assert.deepStrictEqual(TOOL_PERMISSIONS.poppy, ["network:outbound"]);
	});

	it("classifies poppy for the expected agent types", async () => {
		const { TOOL_CLASSIFICATIONS } = await import("../../../../src/tools/index.js");
		assert.ok(TOOL_CLASSIFICATIONS.poppy.includes("orchestrator"));
		assert.ok(TOOL_CLASSIFICATIONS.poppy.includes("research"));
		assert.ok(TOOL_CLASSIFICATIONS.poppy.includes("coding"));
		assert.ok(TOOL_CLASSIFICATIONS.poppy.includes("security-audit"));
	});

	it("exposes poppy to the orchestrator", async () => {
		const { ORCHESTRATOR_TOOLS } = await import("../../../../src/tools/index.js");
		assert.ok(ORCHESTRATOR_TOOLS.includes("poppy"));
	});

	it("registers poppy in the TOOLS map", async () => {
		const { TOOLS } = await import("../../../../src/tools/index.js");
		assert.ok(TOOLS.poppy, "poppy should be present in TOOLS");
	});

	it("getToolsForAgentTypes returns poppy for classified agent types", async () => {
		const { getToolsForAgentTypes, TOOLS } = await import("../../../../src/tools/index.js");
		for (const agent of ["orchestrator", "research", "coding", "security-audit"]) {
			const matches = getToolsForAgentTypes([agent], TOOLS);
			assert.ok(matches.includes("poppy"), `poppy should be classified for ${agent}`);
		}
	});

	it("getToolsForAgentTypes excludes poppy for unclassified agent types", async () => {
		const { getToolsForAgentTypes, TOOLS } = await import("../../../../src/tools/index.js");
		const matches = getToolsForAgentTypes(["search"], TOOLS);
		assert.ok(!matches.includes("poppy"), "poppy should NOT be classified for search");
	});
});

describe("poppy - buildToolConfig permission gating", () => {
	it("registers poppy when network:outbound is enabled", async () => {
		const { buildToolConfig } = await import("../../../../src/tools/index.js");
		const tools = await buildToolConfig({
			permissions: ["filesystem:read", "network:outbound"],
			maxReadSize: 1024 * 1024,
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(toolNames.includes("poppy"), "poppy should register with network:outbound");
	});

	it("does not register poppy when network:outbound is disabled", async () => {
		const { buildToolConfig } = await import("../../../../src/tools/index.js");
		const tools = await buildToolConfig({
			permissions: ["filesystem:read"],
			maxReadSize: 1024 * 1024,
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(!toolNames.includes("poppy"), "poppy should NOT register without network:outbound");
	});
});
