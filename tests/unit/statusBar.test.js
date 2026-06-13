import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import React from "react";
import { render } from "ink";
import { StatusBar, formatNumber } from "../../src/tui/statusBar.js";

describe("formatNumber", () => {
	it("formats small numbers without separators", () => {
		assert.strictEqual(formatNumber(0), "0");
		assert.strictEqual(formatNumber(1), "1");
		assert.strictEqual(formatNumber(999), "999");
	});

	it("formats numbers with locale-aware separators", () => {
		const result = formatNumber(1000);
		// Should have a separator (comma, period, space, etc.)
		assert.ok(result !== "1000", "Should format 1000 with separator");
		assert.ok(result.includes(","), "Should use comma separator for US locale");
	});

	it("formats large numbers correctly", () => {
		const result = formatNumber(1234567);
		assert.ok(result !== "1234567", "Should format large number");
		// Should have separators
		assert.ok(result.includes(",") || result.includes(".") || result.includes(" "), "Should have thousands separator");
	});

	it("handles negative numbers", () => {
		const result = formatNumber(-1000);
		assert.ok(result.startsWith("-"), "Should preserve negative sign");
	});

	it("handles floating point numbers", () => {
		const result = formatNumber(1234.567);
		assert.strictEqual(result, "1,235", "Should round to nearest integer");
	});

	it("returns string for non-numeric input", () => {
		const result = formatNumber("test");
		assert.strictEqual(result, "test", "Should return string as-is");
	});
});

describe("StatusBar", () => {
	let unmount;

	afterEach(() => {
		if (unmount) unmount();
	});

	it("renders with default props", () => {
		const { unmount: um } = render(React.createElement(StatusBar, {}));
		unmount = um;
	});

	it("renders with contextSize prop", () => {
		const { unmount: um } = render(
			React.createElement(StatusBar, {
				contextSize: 42,
				messageCount: 10,
				skillCount: 3,
			}),
		);
		unmount = um;
	});

	it("renders with isCompacting=true", () => {
		const { unmount: um } = render(
			React.createElement(StatusBar, {
				contextSize: 10,
				isCompacting: true,
			}),
		);
		unmount = um;
	});

	it("renders with isCompacting=false", () => {
		const { unmount: um } = render(
			React.createElement(StatusBar, {
				contextSize: 10,
				isCompacting: false,
			}),
		);
		unmount = um;
	});

	it("renders context:0 by default", () => {
		const { unmount: um } = render(React.createElement(StatusBar, {}));
		unmount = um;
	});

	it("renders all props together", () => {
		const { unmount: um } = render(
			React.createElement(StatusBar, {
				statusMessage: "Ready",
				skillCount: 5,
				messageCount: 20,
				contextSize: 50,
				isCompacting: false,
			}),
		);
		unmount = um;
	});

	it("renders compacting state with all props", () => {
		const { unmount: um } = render(
			React.createElement(StatusBar, {
				statusMessage: "Streaming...",
				skillCount: 5,
				messageCount: 20,
				contextSize: 50,
				isCompacting: true,
			}),
		);
		unmount = um;
	});
});
