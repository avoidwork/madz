/**
 * Agent definition tests - validates structure, output formats, and tool mappings.
 */

import { describe, it, before } from "node:test";
import { strictEqual, ok, deepStrictEqual } from "node:assert";
import { getAllAgents } from "../../src/agent/agents/index.js";
import { getToolsForAgentTypes, TOOL_CLASSIFICATIONS } from "../../src/tools/index.js";

// Wait for async prompt loading at module init
function waitForPrompts() {
	return new Promise((resolve) => {
		const check = () => {
			const agents = getAllAgents();
			const allLoaded = agents.every((a) => a.systemPrompt && a.systemPrompt.length > 50);
			if (allLoaded) resolve();
			else setTimeout(check, 10);
		};
		check();
	});
}

const ALL_AGENTS = getAllAgents();
const EXPECTED_AGENT_NAMES = [
	"coding",
	"search",
	"debug",
	"code-review",
	"research",
	"testing",
	"documentation",
	"security-audit",
	"performance",
];

describe("Agent Definitions", () => {
	before(async () => {
		await waitForPrompts();
	});
	describe("getAllAgents", () => {
		it("should return all 9 agent definitions", () => {
			strictEqual(ALL_AGENTS.length, 9, "Should have exactly 9 agents");
		});

		it("should include all expected agent names", () => {
			const names = ALL_AGENTS.map((a) => a.name);
			for (const expected of EXPECTED_AGENT_NAMES) {
				ok(names.includes(expected), `Should include agent: ${expected}`);
			}
		});

		it("should have no duplicate agent names", () => {
			const names = ALL_AGENTS.map((a) => a.name);
			const unique = new Set(names);
			strictEqual(names.length, unique.size, "No duplicate agent names");
		});
	});

	describe("Agent structure", () => {
		it("should have name, description, and systemPrompt for each agent", () => {
			for (const agent of ALL_AGENTS) {
				ok(agent.name, `${agent.name || "unknown"} should have a name`);
				ok(agent.description, `${agent.name} should have a description`);
				ok(agent.systemPrompt, `${agent.name} should have a systemPrompt`);
				strictEqual(typeof agent.name, "string");
				strictEqual(typeof agent.description, "string");
				strictEqual(typeof agent.systemPrompt, "string");
				ok(agent.systemPrompt.length > 50, `${agent.name} systemPrompt should be substantive`);
			}
		});

		it("should have unique descriptions", () => {
			const descriptions = ALL_AGENTS.map((a) => a.description);
			const unique = new Set(descriptions);
			strictEqual(descriptions.length, unique.size, "No duplicate descriptions");
		});
	});

	describe("Unified output format", () => {
		it("should use Status/Summary/Details/Artifacts/Next Steps for all agents", () => {
			for (const agent of ALL_AGENTS) {
				ok(agent.systemPrompt.includes("Status"), `${agent.name} should reference Status`);
				ok(agent.systemPrompt.includes("Summary"), `${agent.name} should reference Summary`);
				ok(agent.systemPrompt.includes("Details"), `${agent.name} should reference Details`);
				ok(agent.systemPrompt.includes("Artifacts"), `${agent.name} should reference Artifacts`);
				ok(agent.systemPrompt.includes("Next Steps"), `${agent.name} should reference Next Steps`);
			}
		});

		it("should have ROLE section for all agents", () => {
			for (const agent of ALL_AGENTS) {
				ok(agent.systemPrompt.includes("### ROLE"), `${agent.name} should have ROLE section`);
			}
		});

		it("should have PERSONALITY section for all agents", () => {
			for (const agent of ALL_AGENTS) {
				ok(
					agent.systemPrompt.includes("### PERSONALITY"),
					`${agent.name} should have PERSONALITY section`,
				);
			}
		});

		it("should have CAPABILITIES section for all agents", () => {
			for (const agent of ALL_AGENTS) {
				ok(
					agent.systemPrompt.includes("### CAPABILITIES"),
					`${agent.name} should have CAPABILITIES section`,
				);
			}
		});

		it("should have RULES section for all agents", () => {
			for (const agent of ALL_AGENTS) {
				ok(agent.systemPrompt.includes("### RULES"), `${agent.name} should have RULES section`);
			}
		});

		it("should have SAFETY section for all agents", () => {
			for (const agent of ALL_AGENTS) {
				ok(agent.systemPrompt.includes("### SAFETY"), `${agent.name} should have SAFETY section`);
			}
		});

		it("should have NOTE section for all agents", () => {
			for (const agent of ALL_AGENTS) {
				ok(agent.systemPrompt.includes("### NOTE"), `${agent.name} should have NOTE section`);
			}
		});

		it("should have domain-specific personality content", () => {
			// Coding agent references engineering/mathematical elegance
			ok(
				ALL_AGENTS[0].systemPrompt.includes("Le Chiffre"),
				"Coding agent should reference Le Chiffre",
			);

			// Debug agent references forensic analysis
			ok(ALL_AGENTS[2].systemPrompt.includes("Hannibal"), "Debug agent should reference Hannibal");

			// Code-review agent references patience/observation
			ok(ALL_AGENTS[3].systemPrompt.includes("Lucas"), "Code-review agent should reference Lucas");

			// Research agent references curiosity/exploration
			ok(ALL_AGENTS[4].systemPrompt.includes("Martin"), "Research agent should reference Martin");

			// Testing agent references engineers/protectors
			ok(ALL_AGENTS[5].systemPrompt.includes("Galen"), "Testing agent should reference Galen");

			// Performance agent references efficiency/silence
			ok(
				ALL_AGENTS[8].systemPrompt.includes("One-Eye"),
				"Performance agent should reference One-Eye",
			);

			// Security agent references patterns/vigilance
			ok(
				ALL_AGENTS[7].systemPrompt.includes("Kaecilius"),
				"Security agent should reference Kaecilius",
			);

			// Search agent references decisiveness/directness
			ok(ALL_AGENTS[1].systemPrompt.includes("Claus"), "Search agent should reference Claus");
		});

		it("should suppress persona for code/diff output (coding agent)", () => {
			const coding = ALL_AGENTS[0];
			ok(
				coding.systemPrompt.includes("suppress"),
				"Coding agent should have persona suppression note",
			);
			ok(
				coding.systemPrompt.includes("code") || coding.systemPrompt.includes("diff"),
				"Coding agent should suppress persona for code output",
			);
		});

		it("should suppress persona for structured data output (debug agent)", () => {
			const debug = ALL_AGENTS[2];
			ok(
				debug.systemPrompt.includes("suppress") || debug.systemPrompt.includes("diffs"),
				"Debug agent should suppress persona for structured output",
			);
		});
	});

	describe("Tool classification mapping", () => {
		it("should have TOOL_CLASSIFICATIONS defined", () => {
			ok(TOOL_CLASSIFICATIONS, "TOOL_CLASSIFICATIONS should be defined");
			ok(
				Object.keys(TOOL_CLASSIFICATIONS).length > 0,
				"Should have at least one tool classification",
			);
		});

		it("should return empty array for unknown agent types", () => {
			const tools = getToolsForAgentTypes(["nonexistent"], {});
			deepStrictEqual(tools, []);
		});

		it("search agent should reference correct tools (webSearch, webExtract, sessionSearch)", () => {
			const search = ALL_AGENTS.find((a) => a.name === "search");
			ok(search.systemPrompt.includes("webSearch"), "Search agent should reference webSearch");
			ok(search.systemPrompt.includes("webExtract"), "Search agent should reference webExtract");
			ok(
				search.systemPrompt.includes("sessionSearch"),
				"Search agent should reference sessionSearch",
			);
		});

		it("debug agent should reference correct tools (executeCode, shell)", () => {
			const debug = ALL_AGENTS.find((a) => a.name === "debug");
			ok(debug.systemPrompt.includes("executeCode"), "Debug agent should reference executeCode");
			ok(debug.systemPrompt.includes("shell"), "Debug agent should reference shell");
		});

		it("code-review agent should reference correct tools (scanAgents, skillView)", () => {
			const review = ALL_AGENTS.find((a) => a.name === "code-review");
			ok(
				review.systemPrompt.includes("scanAgents"),
				"Code review agent should reference scanAgents",
			);
			ok(review.systemPrompt.includes("skillView"), "Code review agent should reference skillView");
		});

		it("testing agent should reference correct tools (executeCode, shell)", () => {
			const testing = ALL_AGENTS.find((a) => a.name === "testing");
			ok(
				testing.systemPrompt.includes("executeCode"),
				"Testing agent should reference executeCode",
			);
			ok(testing.systemPrompt.includes("shell"), "Testing agent should reference shell");
		});

		it("performance agent should reference correct tools (executeCode, cronJob)", () => {
			const perf = ALL_AGENTS.find((a) => a.name === "performance");
			ok(
				perf.systemPrompt.includes("executeCode"),
				"Performance agent should reference executeCode",
			);
			ok(perf.systemPrompt.includes("cronJob"), "Performance agent should reference cronJob");
		});

		it("security-audit agent should reference security-focused tools (scanAgents, cronJob)", () => {
			const security = ALL_AGENTS.find((a) => a.name === "security-audit");
			ok(
				security.systemPrompt.includes("scanAgents"),
				"Security agent should reference scanAgents",
			);
			ok(security.systemPrompt.includes("cronJob"), "Security agent should reference cronJob");
		});

		it("documentation agent should reference doc tools (imageGenerate, textToSpeech)", () => {
			const doc = ALL_AGENTS.find((a) => a.name === "documentation");
			ok(doc.systemPrompt.includes("imageGenerate"), "Doc agent should reference imageGenerate");
			ok(doc.systemPrompt.includes("textToSpeech"), "Doc agent should reference textToSpeech");
		});

		it("coding agent should reference correct tools (visionAnalyze, scanAgents)", () => {
			const coding = ALL_AGENTS.find((a) => a.name === "coding");
			ok(
				coding.systemPrompt.includes("visionAnalyze"),
				"Coding agent should reference visionAnalyze",
			);
			ok(coding.systemPrompt.includes("scanAgents"), "Coding agent should reference scanAgents");
		});
	});

	describe("getToolsForAgentTypes", () => {
		it("should return tools matching agent type classifications", () => {
			const tools = getToolsForAgentTypes(["search"], { webSearch: {}, webExtract: {}, grep: {} });
			ok(Array.isArray(tools), "Should return an array");
		});

		it("should return tools matching multiple agent types", () => {
			const tools = getToolsForAgentTypes(["search", "debug"], {
				webSearch: {},
				webExtract: {},
				grep: {},
				glob: {},
				sessionSearch: {},
				executeCode: {},
				shell: {},
			});
			ok(Array.isArray(tools), "Should return an array");
			ok(tools.length > 0, "Should have at least one tool");
		});

		it("should return empty array for unknown agent types", () => {
			const tools = getToolsForAgentTypes(["nonexistent"], { webSearch: {} });
			deepStrictEqual(tools, []);
		});
	});
});
