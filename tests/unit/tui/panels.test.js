import { describe, it } from "node:test";
import assert from "node:assert";
import { getPanelOrder, nextPanel, prevPanel, PANELS } from "../../../src/tui/panels.js";

describe("getPanelOrder", () => {
	it("returns the panel order array", () => {
		const order = getPanelOrder();
		assert.ok(Array.isArray(order));
		assert.strictEqual(order.length, 4);
		assert.strictEqual(order[0], PANELS.CONVERSATION);
	});
});

describe("nextPanel", () => {
	it("cycles to the next panel", () => {
		assert.strictEqual(nextPanel(PANELS.CONVERSATION), PANELS.SKILLS);
		assert.strictEqual(nextPanel(PANELS.SKILLS), PANELS.MEMORY);
		assert.strictEqual(nextPanel(PANELS.MEMORY), PANELS.SETTINGS);
	});

	it("wraps around from last to first", () => {
		assert.strictEqual(nextPanel(PANELS.SETTINGS), PANELS.CONVERSATION);
	});

	it("handles unknown panel by wrapping to first", () => {
		const result = nextPanel("unknown");
		assert.strictEqual(result, PANELS.CONVERSATION);
	});
});

describe("prevPanel", () => {
	it("cycles to the previous panel", () => {
		assert.strictEqual(prevPanel(PANELS.SETTINGS), PANELS.MEMORY);
		assert.strictEqual(prevPanel(PANELS.MEMORY), PANELS.SKILLS);
		assert.strictEqual(prevPanel(PANELS.SKILLS), PANELS.CONVERSATION);
	});

	it("wraps around from first to last", () => {
		assert.strictEqual(prevPanel(PANELS.CONVERSATION), PANELS.SETTINGS);
	});

	it("handles unknown panel by wrapping to last", () => {
		const result = prevPanel("unknown");
		assert.strictEqual(result, PANELS.MEMORY);
	});
});
