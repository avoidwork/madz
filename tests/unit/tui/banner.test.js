/**
 * Tests for the Banner component.
 * @see {@link src/tui/banner.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import React from "react";
import { renderToString } from "ink";
import { Banner, BANNER_ART } from "../../../src/tui/banner.js";
import { COMMAND_GROUPS } from "../../../src/tui/commandHelp.js";

describe("Banner", () => {
	it("renders ASCII art and command help", () => {
		const result = renderToString(React.createElement(Banner, { onDismiss: () => {} }));
		assert.ok(typeof result === "string");
		assert.ok(result.length > 0);
	});

	it("renders version string when provided", () => {
		const result = renderToString(
			React.createElement(Banner, { onDismiss: () => {}, version: "1.0.0" }),
		);
		assert.ok(typeof result === "string");
	});

	it("lists Tab as the fourth Toggles entry for select mode", () => {
		const toggles = COMMAND_GROUPS.find((g) => g.group === "Toggles:");
		assert.ok(toggles, "Toggles group exists");
		assert.strictEqual(toggles.items.length, 4);
		assert.strictEqual(toggles.items[3], "Tab - toggle select mode");
	});

	it("renders the Tab toggle entry and no separate Tab hint line", () => {
		const result = renderToString(React.createElement(Banner, { onDismiss: () => {} }));
		assert.ok(result.includes("Tab - toggle select mode"), "Tab entry rendered");
		assert.ok(!result.includes("Tab: toggle select mode"), "old hint line removed");
		assert.ok(!result.includes("read-only"));
	});

	it("renders without version", () => {
		const result = renderToString(React.createElement(Banner, { onDismiss: () => {} }));
		assert.ok(typeof result === "string");
	});
});

describe("BANNER_ART", () => {
	it("is an array of strings", () => {
		assert.ok(Array.isArray(BANNER_ART));
		assert.ok(BANNER_ART.length > 0);
	});

	it("contains ASCII art lines", () => {
		const nonEmpty = BANNER_ART.filter((l) => l.trim());
		assert.ok(nonEmpty.length > 0);
	});
});
