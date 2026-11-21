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

describe("orchestrator - image access", () => {
	it("ORCHESTRATOR_TOOLS should include image", () => {
		ok(ORCHESTRATOR_TOOLS.includes("image"), "ORCHESTRATOR_TOOLS should include image");
	});

	it("image should be classified for subagent types", () => {
		ok(TOOL_CLASSIFICATIONS.image, "image should have a TOOL_CLASSIFICATIONS entry");
		ok(
			TOOL_CLASSIFICATIONS.image.includes("coding"),
			"image should include coding in its classifications",
		);
		ok(
			TOOL_CLASSIFICATIONS.image.includes("documentation"),
			"image should include documentation in its classifications",
		);
	});

	it("getToolsForAgentTypes should return image for coding type", async () => {
		const tools = await loadTools();
		const toolsForCoding = getToolsForAgentTypes(["coding"], tools);
		ok(toolsForCoding.includes("image"), "getToolsForAgentTypes(['coding']) should include image");
	});

	it("ORCHESTRATOR_TOOLS should include generateImage", () => {
		ok(
			ORCHESTRATOR_TOOLS.includes("generateImage"),
			"ORCHESTRATOR_TOOLS should include generateImage",
		);
	});

	it("generateImage should be classified for documentation", () => {
		ok(
			TOOL_CLASSIFICATIONS.generateImage,
			"generateImage should have a TOOL_CLASSIFICATIONS entry",
		);
		ok(
			TOOL_CLASSIFICATIONS.generateImage.includes("documentation"),
			"generateImage should include documentation in its classifications",
		);
	});
});

describe("orchestrator - git access", () => {
	it("ORCHESTRATOR_TOOLS should include git", () => {
		ok(ORCHESTRATOR_TOOLS.includes("git"), "ORCHESTRATOR_TOOLS should include git");
	});

	it("git should be classified for subagent types", () => {
		ok(TOOL_CLASSIFICATIONS.git, "git should have a TOOL_CLASSIFICATIONS entry");
		ok(
			TOOL_CLASSIFICATIONS.git.includes("coding"),
			"git should include coding in its classifications",
		);
	});

	it("getToolsForAgentTypes should return git for coding type", async () => {
		const tools = await loadTools();
		const toolsForCoding = getToolsForAgentTypes(["coding"], tools);
		ok(toolsForCoding.includes("git"), "getToolsForAgentTypes(['coding']) should include git");
	});
});

describe("orchestrator - archive access", () => {
	it("ORCHESTRATOR_TOOLS should include archive", () => {
		ok(ORCHESTRATOR_TOOLS.includes("archive"), "ORCHESTRATOR_TOOLS should include archive");
	});

	it("archive should be classified for subagent types", () => {
		ok(TOOL_CLASSIFICATIONS.archive, "archive should have a TOOL_CLASSIFICATIONS entry");
		ok(
			TOOL_CLASSIFICATIONS.archive.includes("coding"),
			"archive should include coding in its classifications",
		);
	});

	it("getToolsForAgentTypes should return archive for coding type", async () => {
		const tools = await loadTools();
		const toolsForCoding = getToolsForAgentTypes(["coding"], tools);
		ok(
			toolsForCoding.includes("archive"),
			"getToolsForAgentTypes(['coding']) should include archive",
		);
	});
});

describe("orchestrator - diagram access", () => {
	it("ORCHESTRATOR_TOOLS should include diagram", () => {
		ok(ORCHESTRATOR_TOOLS.includes("diagram"), "ORCHESTRATOR_TOOLS should include diagram");
	});

	it("diagram should be classified for subagent types", () => {
		ok(TOOL_CLASSIFICATIONS.diagram, "diagram should have a TOOL_CLASSIFICATIONS entry");
		ok(
			TOOL_CLASSIFICATIONS.diagram.includes("coding"),
			"diagram should include coding in its classifications",
		);
	});

	it("getToolsForAgentTypes should return diagram for coding type", async () => {
		const tools = await loadTools();
		const toolsForCoding = getToolsForAgentTypes(["coding"], tools);
		ok(
			toolsForCoding.includes("diagram"),
			"getToolsForAgentTypes(['coding']) should include diagram",
		);
	});
});

describe("orchestrator - sql access", () => {
	it("ORCHESTRATOR_TOOLS should include sql", () => {
		ok(ORCHESTRATOR_TOOLS.includes("sql"), "ORCHESTRATOR_TOOLS should include sql");
	});

	it("sql should be classified for subagent types", () => {
		ok(TOOL_CLASSIFICATIONS.sql, "sql should have a TOOL_CLASSIFICATIONS entry");
		ok(
			TOOL_CLASSIFICATIONS.sql.includes("coding"),
			"sql should include coding in its classifications",
		);
	});

	it("getToolsForAgentTypes should return sql for coding type", async () => {
		const tools = await loadTools();
		const toolsForCoding = getToolsForAgentTypes(["coding"], tools);
		ok(toolsForCoding.includes("sql"), "getToolsForAgentTypes(['coding']) should include sql");
	});
});

describe("orchestrator - jira access", () => {
	it("ORCHESTRATOR_TOOLS should include jira", () => {
		ok(ORCHESTRATOR_TOOLS.includes("jira"), "ORCHESTRATOR_TOOLS should include jira");
	});

	it("jira should be classified for subagent types", () => {
		ok(TOOL_CLASSIFICATIONS.jira, "jira should have a TOOL_CLASSIFICATIONS entry");
		ok(
			TOOL_CLASSIFICATIONS.jira.includes("coding"),
			"jira should include coding in its classifications",
		);
	});

	it("getToolsForAgentTypes should return jira for coding type", async () => {
		const tools = await loadTools();
		const toolsForCoding = getToolsForAgentTypes(["coding"], tools);
		ok(toolsForCoding.includes("jira"), "getToolsForAgentTypes(['coding']) should include jira");
	});
});

describe("orchestrator - confluence access", () => {
	it("ORCHESTRATOR_TOOLS should include confluence", () => {
		ok(ORCHESTRATOR_TOOLS.includes("confluence"), "ORCHESTRATOR_TOOLS should include confluence");
	});

	it("confluence should be classified for subagent types", () => {
		ok(TOOL_CLASSIFICATIONS.confluence, "confluence should have a TOOL_CLASSIFICATIONS entry");
		ok(
			TOOL_CLASSIFICATIONS.confluence.includes("coding"),
			"confluence should include coding in its classifications",
		);
	});

	it("getToolsForAgentTypes should return confluence for coding type", async () => {
		const tools = await loadTools();
		const toolsForCoding = getToolsForAgentTypes(["coding"], tools);
		ok(
			toolsForCoding.includes("confluence"),
			"getToolsForAgentTypes(['coding']) should include confluence",
		);
	});
});
