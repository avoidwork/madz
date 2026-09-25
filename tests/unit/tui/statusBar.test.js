import { describe, it } from "node:test";
import assert from "node:assert";
import React from "react";
import { renderToString } from "ink";
import { formatNumber, formatSize, StatusBar } from "../../../src/tui/statusBar.js";
import { QUOTES, getRandomQuoteIndex } from "../../../src/tui/quotes.js";

describe("formatNumber", () => {
	it("formats a number with locale formatting", () => {
		const result = formatNumber(1234567);
		assert.ok(typeof result === "string");
		assert.ok(result.length > 0);
	});

	it("formats zero", () => {
		assert.strictEqual(formatNumber(0), "0");
	});

	it("handles NaN gracefully", () => {
		const result = formatNumber(NaN);
		assert.strictEqual(result, "NaN");
	});

	it("handles negative NaN gracefully", () => {
		// Force a case where formatter returns NaN
		const result = formatNumber(Number.NEGATIVE_INFINITY);
		assert.ok(typeof result === "string");
	});
});

describe("formatSize", () => {
	it("returns 0 for zero bytes", () => {
		assert.strictEqual(formatSize(0), "0");
	});

	it("formats positive byte count", () => {
		const result = formatSize(1024);
		assert.ok(typeof result === "string");
		assert.ok(result.length > 0);
	});
});

describe("QUOTES", () => {
	it("is a frozen array", () => {
		assert.ok(Array.isArray(QUOTES));
		assert.ok(Object.isFrozen(QUOTES));
	});

	it("contains exactly 25 curated quotes", () => {
		assert.strictEqual(QUOTES.length, 25);
	});

	it("contains non-empty string quotes", () => {
		assert.ok(QUOTES.every((q) => typeof q === "string" && q.length > 0));
	});
});

describe("getRandomQuoteIndex", () => {
	it("returns a valid index within bounds", () => {
		for (let i = 0; i < 100; i++) {
			const index = getRandomQuoteIndex(-1, () => Math.random());
			assert.ok(Number.isInteger(index));
			assert.ok(index >= 0 && index < QUOTES.length);
		}
	});

	it("avoids the previous index when the list has more than one element", () => {
		for (let i = 0; i < 100; i++) {
			const previous = Math.floor(Math.random() * QUOTES.length);
			const index = getRandomQuoteIndex(previous, () => Math.random());
			assert.notStrictEqual(index, previous);
		}
	});

	it("returns 0 for a single-element list", () => {
		const single = ["only quote"];
		assert.strictEqual(
			getRandomQuoteIndex(0, () => 0, single),
			0,
		);
	});

	it("returns -1 for an empty list", () => {
		assert.strictEqual(
			getRandomQuoteIndex(-1, () => 0, []),
			-1,
		);
	});
});

describe("StatusBar", () => {
	it("renders the quote to the left of the version", () => {
		const result = renderToString(
			React.createElement(StatusBar, {
				statusMessage: "Ready",
				skillCount: 1,
				messageCount: 2,
				contextSize: 3,
				version: "1.0.0",
				quote: "A test quote",
			}),
		);
		assert.ok(typeof result === "string");
		assert.ok(result.includes("A test quote"));
		assert.ok(result.includes("1.0.0"));
	});

	it("does not render an empty quote element when no quote is provided", () => {
		const result = renderToString(
			React.createElement(StatusBar, {
				statusMessage: "Ready",
				skillCount: 1,
				messageCount: 2,
				contextSize: 3,
				version: "1.0.0",
				quote: "",
			}),
		);
		assert.ok(typeof result === "string");
		assert.ok(result.includes("1.0.0"));
	});

	it("truncates a long quote with an ellipsis instead of wrapping", () => {
		const longQuote = "x".repeat(200);
		const result = renderToString(
			React.createElement(StatusBar, {
				statusMessage: "Ready",
				skillCount: 1,
				messageCount: 2,
				contextSize: 3,
				version: "1.0.0",
				quote: longQuote,
			}),
		);
		assert.ok(typeof result === "string");
		// The quote is truncated with an ellipsis, not wrapped across lines
		assert.ok(result.includes("…"), "should truncate with an ellipsis");
		// The rendered output should not span multiple lines from the quote wrapping
		const lines = result.split("\n");
		assert.ok(lines.length <= 2, `expected ≤2 lines, got ${lines.length}`);
	});
});

describe("StatusBar model display", () => {
	it("renders the model name with the brain glyph when configured", () => {
		const result = renderToString(
			React.createElement(StatusBar, {
				statusMessage: "Ready",
				skillCount: 1,
				messageCount: 2,
				contextSize: 3,
				version: "1.0.0",
				model: "gpt-4o",
			}),
		);
		assert.ok(typeof result === "string");
		assert.ok(result.includes("🧠"), "should render the brain glyph");
		assert.ok(result.includes("gpt-4o"), "should render the model name");
	});

	it("omits the model display when no model is configured", () => {
		const result = renderToString(
			React.createElement(StatusBar, {
				statusMessage: "Ready",
				skillCount: 1,
				messageCount: 2,
				contextSize: 3,
				version: "1.0.0",
				model: "",
			}),
		);
		assert.ok(typeof result === "string");
		assert.ok(!result.includes("🧠"), "should not render the brain glyph");
	});
});
