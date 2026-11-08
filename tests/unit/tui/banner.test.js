/**
 * Tests for the Banner component.
 * @see {@link src/tui/banner.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import React from "react";
import { renderToString } from "ink";
import { Banner, BANNER_ART, TAB_HINT, TAB_HINT_DETAIL } from "../../../src/tui/banner.js";

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

	it("describes Tab as select mode, not read-only mode", () => {
		assert.ok(TAB_HINT.includes("select mode"));
		assert.ok(!TAB_HINT.includes("read-only"));
	});

	it("explains what select mode does and how to leave it", () => {
		assert.ok(TAB_HINT.includes("select mode"));
		assert.ok(TAB_HINT.includes("copy"));
		assert.ok(TAB_HINT_DETAIL.includes("mouse"));
		assert.ok(TAB_HINT_DETAIL.includes("Tab or typing returns"));
		const result = renderToString(React.createElement(Banner, { onDismiss: () => {} }));
		assert.ok(result.includes(TAB_HINT_DETAIL), "detail line rendered");
	});

	it("shows the Tab hint above the command menu", () => {
		const result = renderToString(React.createElement(Banner, { onDismiss: () => {} }));
		const hintAt = result.indexOf(TAB_HINT);
		assert.ok(hintAt >= 0, "hint rendered");
		assert.ok(hintAt < result.indexOf("Press any key"), "hint above footer");
		const firstGroup = result.indexOf("Chat:");
		if (firstGroup >= 0) assert.ok(hintAt < firstGroup, "hint above menu");
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
