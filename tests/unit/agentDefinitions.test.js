/**
 * Agent definition tests - validates structure, output formats, and tool mappings.
 */

import { describe, it } from "node:test";
import { strictEqual, ok, deepStrictEqual } from "node:assert";
import { getAllAgents } from "../../src/agent/agents/index.js";
import { getToolsForAgentTypes, TOOL_CLASSIFICATIONS } from "../../src/tools/index.js";

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

	describe("Output format validation", () => {
		it("search agent should include structured output format", () => {
			const search = ALL_AGENTS.find((a) => a.name === "search");
			ok(search, "Should find search agent");
			ok(search.systemPrompt.includes("Summary"), "Should include Summary section");
			ok(search.systemPrompt.includes("Key Findings"), "Should include Key Findings section");
			ok(search.systemPrompt.includes("Sources"), "Should include Sources section");
			ok(search.systemPrompt.includes("Confidence"), "Should include Confidence section");
		});

		it("debug agent should include error analysis format", () => {
			const debug = ALL_AGENTS.find((a) => a.name === "debug");
			ok(debug, "Should find debug agent");
			ok(debug.systemPrompt.includes("Root Cause"), "Should include Root Cause section");
			ok(debug.systemPrompt.includes("Analysis"), "Should include Analysis section");
			ok(debug.systemPrompt.includes("Proposed Fix"), "Should include Proposed Fix section");
			ok(debug.systemPrompt.includes("Confidence"), "Should include Confidence section");
		});

		it("coding agent should include code editing rules", () => {
			const coding = ALL_AGENTS.find((a) => a.name === "coding");
			ok(coding, "Should find coding agent");
			ok(
				coding.systemPrompt.includes("Read before writing"),
				"Should include read-before-write rule",
			);
			ok(coding.systemPrompt.includes("Ship complete code"), "Should include ship-complete rule");
			ok(
				coding.systemPrompt.includes("Respect project conventions"),
				"Should include conventions rule",
			);
			ok(coding.systemPrompt.includes("No dead code"), "Should include no-dead-code rule");
		});

		it("code-review agent should include severity-rated findings", () => {
			const review = ALL_AGENTS.find((a) => a.name === "code-review");
			ok(review, "Should find code-review agent");
			ok(review.systemPrompt.includes("Critical Issues"), "Should include Critical Issues section");
			ok(review.systemPrompt.includes("High Priority"), "Should include High Priority section");
			ok(review.systemPrompt.includes("Medium Priority"), "Should include Medium Priority section");
			ok(review.systemPrompt.includes("Low Priority"), "Should include Low Priority section");
		});

		it("research agent should include comprehensive report format", () => {
			const research = ALL_AGENTS.find((a) => a.name === "research");
			ok(research, "Should find research agent");
			ok(
				research.systemPrompt.includes("Executive Summary"),
				"Should include Executive Summary section",
			);
			ok(
				research.systemPrompt.includes("Detailed Findings"),
				"Should include Detailed Findings section",
			);
			ok(research.systemPrompt.includes("Sources"), "Should include Sources section");
			ok(
				research.systemPrompt.includes("Recommendations"),
				"Should include Recommendations section",
			);
		});

		it("testing agent should include test generation format", () => {
			const testing = ALL_AGENTS.find((a) => a.name === "testing");
			ok(testing, "Should find testing agent");
			ok(
				testing.systemPrompt.includes("Coverage Analysis"),
				"Should include Coverage Analysis section",
			);
			ok(
				testing.systemPrompt.includes("Generated Tests"),
				"Should include Generated Tests section",
			);
			ok(testing.systemPrompt.includes("Coverage Gaps"), "Should include Coverage Gaps section");
		});

		it("documentation agent should include documentation update format", () => {
			const doc = ALL_AGENTS.find((a) => a.name === "documentation");
			ok(doc, "Should find documentation agent");
			ok(doc.systemPrompt.includes("Changes Made"), "Should include Changes Made section");
			ok(
				doc.systemPrompt.includes("Generated Content"),
				"Should include Generated Content section",
			);
			ok(
				doc.systemPrompt.includes("Consistency Notes"),
				"Should include Consistency Notes section",
			);
		});

		it("security-audit agent should include vulnerability report format", () => {
			const security = ALL_AGENTS.find((a) => a.name === "security-audit");
			ok(security, "Should find security-audit agent");
			ok(
				security.systemPrompt.includes("Critical Vulnerabilities"),
				"Should include Critical Vulnerabilities section",
			);
			ok(security.systemPrompt.includes("High Priority"), "Should include High Priority section");
			ok(
				security.systemPrompt.includes("Remediation Steps"),
				"Should include Remediation Steps section",
			);
		});

		it("performance agent should include benchmark format", () => {
			const perf = ALL_AGENTS.find((a) => a.name === "performance");
			ok(perf, "Should find performance agent");
			ok(
				perf.systemPrompt.includes("Benchmark Results"),
				"Should include Benchmark Results section",
			);
			ok(
				perf.systemPrompt.includes("Identified Bottlenecks"),
				"Should include Identified Bottlenecks section",
			);
			ok(
				perf.systemPrompt.includes("Optimization Recommendations"),
				"Should include Optimization Recommendations section",
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

		it("search agent should have webSearch and webExtract", () => {
			const search = ALL_AGENTS.find((a) => a.name === "search");
			ok(search.systemPrompt.includes("webSearch"), "Search agent should reference webSearch");
			ok(search.systemPrompt.includes("webExtract"), "Search agent should reference webExtract");
		});

		it("debug agent should have executeCode and shell", () => {
			const debug = ALL_AGENTS.find((a) => a.name === "debug");
			ok(debug.systemPrompt.includes("executeCode"), "Debug agent should reference executeCode");
			ok(debug.systemPrompt.includes("shell"), "Debug agent should reference shell");
		});

		it("code-review agent should have grep", () => {
			const review = ALL_AGENTS.find((a) => a.name === "code-review");
			ok(review.systemPrompt.includes("grep"), "Code review agent should reference grep");
		});

		it("documentation agent should reference documentation tools", () => {
			const doc = ALL_AGENTS.find((a) => a.name === "documentation");
			ok(
				doc.systemPrompt.includes("README") || doc.systemPrompt.includes("API"),
				"Documentation agent should reference documentation concepts",
			);
		});

		it("security-audit agent should reference security concepts", () => {
			const security = ALL_AGENTS.find((a) => a.name === "security-audit");
			ok(
				security.systemPrompt.includes("security") || security.systemPrompt.includes("vulnerab"),
				"Security agent should reference security concepts",
			);
		});

		it("performance agent should have executeCode", () => {
			const perf = ALL_AGENTS.find((a) => a.name === "performance");
			ok(
				perf.systemPrompt.includes("executeCode"),
				"Performance agent should reference executeCode",
			);
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
