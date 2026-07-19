/**
 * Agent registry tests.
 */

import { describe, it } from "node:test";
import { strictEqual, ok } from "node:assert";
import { AgentRegistry } from "../../src/agent/agentRegistry.js";

describe("AgentRegistry", () => {
	describe("addAgent", () => {
		it("should add an agent with all required fields", () => {
			const registry = new AgentRegistry();
			const agent = {
				name: "test-agent",
				description: "Test agent",
				systemPrompt: "You are a test agent",
				model: {},
				tools: ["test-tool"],
			};

			registry.addAgent(agent);
			const retrieved = registry.getAgent("test-agent");
			ok(retrieved, "Agent should be retrievable");
			strictEqual(retrieved.name, "test-agent");
		});

		it("should throw error when adding agent without name", () => {
			const registry = new AgentRegistry();
			let threw = false;
			try {
				registry.addAgent({ systemPrompt: "test" });
			} catch (err) {
				threw = true;
				ok(err.message.includes("name and systemPrompt"), "Should mention name and systemPrompt");
			}
			ok(threw, "Should throw error");
		});

		it("should throw error when adding agent without systemPrompt", () => {
			const registry = new AgentRegistry();
			let threw = false;
			try {
				registry.addAgent({ name: "test" });
			} catch (err) {
				threw = true;
				ok(err.message.includes("name and systemPrompt"), "Should mention name and systemPrompt");
			}
			ok(threw, "Should throw error");
		});

		it("should throw error when adding duplicate agent", () => {
			const registry = new AgentRegistry();
			registry.addAgent({ name: "test", systemPrompt: "test" });
			let threw = false;
			try {
				registry.addAgent({ name: "test", systemPrompt: "test" });
			} catch (err) {
				threw = true;
				ok(err.message.includes("already exists"), "Should mention already exists");
			}
			ok(threw, "Should throw error");
		});
	});

	describe("getAgent", () => {
		it("should return agent by name", () => {
			const registry = new AgentRegistry();
			registry.addAgent({ name: "test", systemPrompt: "test" });
			const agent = registry.getAgent("test");
			strictEqual(agent.name, "test");
		});

		it("should return null for non-existent agent", () => {
			const registry = new AgentRegistry();
			strictEqual(registry.getAgent("nonexistent"), null);
		});
	});

	describe("listAgents", () => {
		it("should return all agent names", () => {
			const registry = new AgentRegistry();
			registry.addAgent({ name: "agent1", systemPrompt: "test" });
			registry.addAgent({ name: "agent2", systemPrompt: "test" });
			const agents = registry.listAgents();
			ok(agents.includes("agent1"), "Should contain agent1");
			ok(agents.includes("agent2"), "Should contain agent2");
			strictEqual(agents.length, 2);
		});
	});

	describe("validateAgent", () => {
		it("should validate correct agent", () => {
			const registry = new AgentRegistry();
			const result = registry.validateAgent({
				name: "test",
				systemPrompt: "test",
				model: {},
				tools: [],
			});
			ok(result.isValid, "Should be valid");
			strictEqual(result.errors.length, 0);
		});

		it("should reject agent without name", () => {
			const registry = new AgentRegistry();
			const result = registry.validateAgent({ systemPrompt: "test" });
			ok(!result.isValid, "Should be invalid");
			ok(result.errors.includes("Agent must have a name"), "Should have name error");
		});

		it("should reject agent without systemPrompt", () => {
			const registry = new AgentRegistry();
			const result = registry.validateAgent({ name: "test" });
			ok(!result.isValid, "Should be invalid");
			ok(
				result.errors.includes("Agent must have a systemPrompt"),
				"Should have systemPrompt error",
			);
		});
	});

	describe("clear", () => {
		it("should remove all agents", () => {
			const registry = new AgentRegistry();
			registry.addAgent({ name: "agent1", systemPrompt: "test" });
			registry.addAgent({ name: "agent2", systemPrompt: "test" });
			registry.clear();
			strictEqual(registry.listAgents().length, 0);
		});
	});
});
