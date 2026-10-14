import { describe, it } from "node:test";
import assert from "node:assert";
import { getPanelOrder, nextPanel, prevPanel, PANELS } from "../../../src/tui/panels.js";

describe("getPanelOrder", () => {
	it("returns the panel order array", () => {
		const order = getPanelOrder();
		assert.ok(Array.isArray(order));
		assert.strictEqual(order.length, 7);
		assert.strictEqual(order[0], PANELS.CONVERSATION);
		assert.strictEqual(order[order.length - 1], PANELS.SUBAGENTS);
	});
});

describe("nextPanel", () => {
	it("cycles to the next panel", () => {
		assert.strictEqual(nextPanel(PANELS.CONVERSATION), PANELS.SKILLS);
		assert.strictEqual(nextPanel(PANELS.SKILLS), PANELS.MEMORIES);
		assert.strictEqual(nextPanel(PANELS.MEMORIES), PANELS.SETTINGS);
		assert.strictEqual(nextPanel(PANELS.SETTINGS), PANELS.SESSIONS);
		assert.strictEqual(nextPanel(PANELS.SESSIONS), PANELS.PROJECTS);
		assert.strictEqual(nextPanel(PANELS.PROJECTS), PANELS.SUBAGENTS);
	});

	it("wraps around from last to first", () => {
		assert.strictEqual(nextPanel(PANELS.SUBAGENTS), PANELS.CONVERSATION);
	});

	it("handles unknown panel by wrapping to first", () => {
		const result = nextPanel("unknown");
		assert.strictEqual(result, PANELS.CONVERSATION);
	});
});

describe("prevPanel", () => {
	it("cycles to the previous panel", () => {
		assert.strictEqual(prevPanel(PANELS.SUBAGENTS), PANELS.PROJECTS);
		assert.strictEqual(prevPanel(PANELS.PROJECTS), PANELS.SESSIONS);
		assert.strictEqual(prevPanel(PANELS.SESSIONS), PANELS.SETTINGS);
		assert.strictEqual(prevPanel(PANELS.SETTINGS), PANELS.MEMORIES);
		assert.strictEqual(prevPanel(PANELS.MEMORIES), PANELS.SKILLS);
		assert.strictEqual(prevPanel(PANELS.SKILLS), PANELS.CONVERSATION);
	});

	it("wraps around from first to last", () => {
		assert.strictEqual(prevPanel(PANELS.CONVERSATION), PANELS.SUBAGENTS);
	});

	it("handles unknown panel by wrapping to last", () => {
		const result = prevPanel("unknown");
		assert.strictEqual(result, PANELS.PROJECTS);
	});
});
