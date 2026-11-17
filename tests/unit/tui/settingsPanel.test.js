import { describe, it } from "node:test";
import assert from "node:assert";
import React from "react";
import { renderToString } from "ink";
import { SettingsPanel, clampOffset } from "../../../src/tui/settingsPanel.js";

describe("clampOffset", () => {
	it("keeps offset at 0 when the selected row is within the window", () => {
		assert.strictEqual(clampOffset(0, 1, 3, 10), 0);
	});

	it("does not shift the offset when a section expands below the selection", () => {
		// Selected section at index 1, items grow from 3 to 8, limit 10
		assert.strictEqual(clampOffset(0, 1, 8, 10), 0);
	});

	it("clamps offset so the selected row stays visible near the bottom", () => {
		// Selected at index 18 of 20, limit 5 → offset must be 14
		assert.strictEqual(clampOffset(0, 18, 20, 5), 14);
	});

	it("keeps a scrolled offset when the selection is still visible", () => {
		// Selected at 10, offset 8, limit 5 → window 8-12 contains 10
		assert.strictEqual(clampOffset(8, 10, 20, 5), 8);
	});

	it("clamps offset to the maximum when items are fewer than the limit", () => {
		assert.strictEqual(clampOffset(5, 2, 3, 10), 0);
	});
});

describe("SettingsPanel", () => {
	const config = {
		cwd: "/tmp",
		agent: { maxTokensMinute: 100 },
		provider: { name: "openai" },
	};

	it("renders the Settings header", () => {
		const result = renderToString(
			React.createElement(SettingsPanel, {
				config,
				activeView: "settings",
			}),
		);
		assert.ok(result.includes("Settings"));
	});

	it("renders section names", () => {
		const result = renderToString(
			React.createElement(SettingsPanel, {
				config,
				activeView: "settings",
			}),
		);
		assert.ok(result.includes("agent"));
		assert.ok(result.includes("provider"));
	});

	it("does not render the cwd section (internal key)", () => {
		const result = renderToString(
			React.createElement(SettingsPanel, {
				config,
				activeView: "settings",
			}),
		);
		assert.ok(!result.includes("cwd"));
	});

	it("renders a fallback message when no config is provided", () => {
		const result = renderToString(
			React.createElement(SettingsPanel, {
				config: null,
				activeView: "settings",
			}),
		);
		assert.ok(result.includes("No config available."));
	});
});
