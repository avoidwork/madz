import { describe, it } from "node:test";
import { deepStrictEqual, ok } from "node:assert";

import {
	ORCHESTRATOR_TOOLS,
	TOOL_CLASSIFICATIONS,
	getToolsForAgentTypes,
} from "../../src/tools/index.js";

// Import TOOLS dynamically since it depends on runtime config
let TOOLS;
async function loadTools() {
	if (!TOOLS) {
		const mod = await import("../../src/tools/index.js");
		TOOLS = mod.TOOLS;
	}
	return TOOLS;
}

describe("orchestrator - cronJob access", () => {
	it("ORCHESTRATOR_TOOLS should include cronJob", () => {
		ok(ORCHESTRATOR_TOOLS.includes("cronJob"), "ORCHESTRATOR_TOOLS should include cronJob");
	});

	it("ORCHESTRATOR_TOOLS should be an array of strings", () => {
		deepStrictEqual(
			typeof ORCHESTRATOR_TOOLS,
			"object",
			"ORCHESTRATOR_TOOLS should be an object (array)",
		);
		deepStrictEqual(
			Array.isArray(ORCHESTRATOR_TOOLS),
			true,
			"ORCHESTRATOR_TOOLS should be an array",
		);
		ORCHESTRATOR_TOOLS.forEach((tool) => {
			deepStrictEqual(typeof tool, "string", `Each tool should be a string, got ${typeof tool}`);
		});
	});

	it("cronJob should be classified for orchestrator", () => {
		ok(TOOL_CLASSIFICATIONS.cronJob, "cronJob should have a TOOL_CLASSIFICATIONS entry");
		ok(
			TOOL_CLASSIFICATIONS.cronJob.includes("orchestrator"),
			"cronJob should include orchestrator in its classifications",
		);
	});

	it("cronJob should retain its existing classifications", () => {
		ok(
			TOOL_CLASSIFICATIONS.cronJob.includes("security-audit"),
			"cronJob should still include security-audit",
		);
		ok(
			TOOL_CLASSIFICATIONS.cronJob.includes("performance"),
			"cronJob should still include performance",
		);
	});

	it("getToolsForAgentTypes should return cronJob for orchestrator type", async () => {
		const tools = await loadTools();
		const toolsForOrchestrator = getToolsForAgentTypes(["orchestrator"], tools);
		ok(
			toolsForOrchestrator.includes("cronJob"),
			"getToolsForAgentTypes(['orchestrator']) should include cronJob",
		);
	});

	it("getToolsForAgentTypes should return cronJob for security-audit type", async () => {
		const tools = await loadTools();
		const toolsForSecurity = getToolsForAgentTypes(["security-audit"], tools);
		ok(
			toolsForSecurity.includes("cronJob"),
			"getToolsForAgentTypes(['security-audit']) should include cronJob",
		);
	});

	it("getToolsForAgentTypes should return cronJob for performance type", async () => {
		const tools = await loadTools();
		const toolsForPerformance = getToolsForAgentTypes(["performance"], tools);
		ok(
			toolsForPerformance.includes("cronJob"),
			"getToolsForAgentTypes(['performance']) should include cronJob",
		);
	});
});
