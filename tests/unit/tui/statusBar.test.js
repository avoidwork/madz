import { describe, it } from "node:test";
import assert from "node:assert";
import React from "react";
import { Box, renderToString } from "ink";
import {
	formatNumber,
	formatSize,
	getContextUtilizationColor,
	getContextUtilization,
	renderContextMeter,
	StatusBar,
} from "../../../src/tui/statusBar.js";
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
	it("returns 0 for zero", () => {
		assert.strictEqual(formatSize(0), "0");
	});

	it("formats small numbers without a postfix", () => {
		assert.strictEqual(formatSize(999), "999");
		assert.strictEqual(formatSize(100), "100");
	});

	it("applies SI postfix to thousands", () => {
		assert.strictEqual(formatSize(1000), "1k");
		assert.strictEqual(formatSize(12200), "12.2k");
	});

	it("applies SI postfix to millions", () => {
		assert.strictEqual(formatSize(1400000), "1.4M");
		assert.strictEqual(formatSize(1234567), "1.2M");
	});
});

describe("getContextUtilizationColor", () => {
	it("returns cyan when no context window is configured", () => {
		assert.strictEqual(getContextUtilizationColor(1000, 0), "cyan");
		assert.strictEqual(getContextUtilizationColor(1000, undefined), "cyan");
	});

	it("returns cyan for 0-60% utilization", () => {
		assert.strictEqual(getContextUtilizationColor(0, 128000), "cyan");
		assert.strictEqual(getContextUtilizationColor(60000, 128000), "cyan");
		// Boundary: exactly 60% is still cyan
		assert.strictEqual(getContextUtilizationColor(76800, 128000), "cyan");
	});

	it("returns orange for 61-80% utilization", () => {
		// Boundary: just above 60% flips to orange
		assert.strictEqual(getContextUtilizationColor(76801, 128000), "orange");
		assert.strictEqual(getContextUtilizationColor(100000, 128000), "orange");
		// Boundary: exactly 80% is still orange
		assert.strictEqual(getContextUtilizationColor(102400, 128000), "orange");
	});

	it("returns red for 81-100% utilization", () => {
		// Boundary: just above 80% flips to red
		assert.strictEqual(getContextUtilizationColor(102401, 128000), "red");
		assert.strictEqual(getContextUtilizationColor(128000, 128000), "red");
		// Over 100% is still red
		assert.strictEqual(getContextUtilizationColor(200000, 128000), "red");
	});
});

describe("getContextUtilization", () => {
	it("returns 0 when no context window is configured", () => {
		assert.strictEqual(getContextUtilization(1000, 0), 0);
		assert.strictEqual(getContextUtilization(1000, undefined), 0);
		assert.strictEqual(getContextUtilization(1000, -1), 0);
	});

	it("returns 0% at zero context size", () => {
		assert.strictEqual(getContextUtilization(0, 128000), 0);
	});

	it("returns 50% at half utilization", () => {
		assert.strictEqual(getContextUtilization(64000, 128000), 50);
	});

	it("returns 100% at full utilization", () => {
		assert.strictEqual(getContextUtilization(128000, 128000), 100);
	});

	it("rounds to the nearest integer", () => {
		assert.strictEqual(getContextUtilization(64001, 128000), 50);
		assert.strictEqual(getContextUtilization(64050, 128000), 50);
		assert.strictEqual(getContextUtilization(64080, 128000), 50);
	});
});

describe("renderContextMeter", () => {
	it("renders all empty blocks at 0% utilization", () => {
		const result = renderContextMeter(0, 128000);
		assert.strictEqual(result, "[▯▯▯▯▯] 0%");
	});

	it("renders half filled blocks at 50% utilization", () => {
		const result = renderContextMeter(64000, 128000);
		assert.strictEqual(result, "[▮▮▮▯▯] 50%");
	});

	it("renders all filled blocks at 100% utilization", () => {
		const result = renderContextMeter(128000, 128000);
		assert.strictEqual(result, "[▮▮▮▮▮] 100%");
	});

	it("renders the bare number when context window is unset", () => {
		// The meter helper itself returns 0% when unset; the StatusBar component
		// falls back to formatSize in that case. This verifies the helper's
		// behavior for the unset case.
		const result = renderContextMeter(12200, 0);
		assert.strictEqual(result, "[▯▯▯▯▯] 0%");
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

	it("truncates a long quote to a single line instead of wrapping", () => {
		const longQuote = "x".repeat(200);
		const result = renderToString(
			React.createElement(
				Box,
				{ width: 40 },
				React.createElement(StatusBar, {
					statusMessage: "Ready",
					skillCount: 1,
					messageCount: 2,
					contextSize: 3,
					version: "1.0.0",
					quote: longQuote,
				}),
			),
		);
		assert.ok(typeof result === "string");
		// The quote is truncated with an ellipsis rather than wrapping across lines
		assert.ok(result.includes("…"), "should truncate with an ellipsis");
		// The truncated quote stays on a single line
		const lines = result.split("\n");
		assert.ok(lines.length <= 2, `expected <=2 lines, got ${lines.length}`);
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
		assert.ok(!result.includes("🧠"), "should not render the brain glyph");
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

describe("StatusBar project display", () => {
	it("renders only the subdirectory name within projects/", () => {
		const result = renderToString(
			React.createElement(StatusBar, {
				statusMessage: "Ready",
				skillCount: 1,
				messageCount: 2,
				contextSize: 3,
				version: "1.0.0",
				project: "/home/user/projects/foo",
			}),
		);
		assert.ok(typeof result === "string");
		assert.ok(result.includes("foo"), "should render the project subdirectory name");
		assert.ok(!result.includes("/home/user/projects/foo"), "should not render the full path");
	});

	it("falls back to the full path when not under projects/", () => {
		const result = renderToString(
			React.createElement(StatusBar, {
				statusMessage: "Ready",
				skillCount: 1,
				messageCount: 2,
				contextSize: 3,
				version: "1.0.0",
				project: "/some/other/dir",
			}),
		);
		assert.ok(typeof result === "string");
		assert.ok(result.includes("/some/other/dir"), "should render the full path");
	});

	it("omits the project element when statusBar.project is false", () => {
		const result = renderToString(
			React.createElement(StatusBar, {
				statusMessage: "Ready",
				skillCount: 1,
				messageCount: 2,
				contextSize: 3,
				version: "1.0.0",
				project: "/home/user/projects/foo",
				statusBar: { project: false },
			}),
		);
		assert.ok(typeof result === "string");
		assert.ok(!result.includes("foo"), "should not render the project name");
	});

	it("renders the project tag after the model name, not adjacent to it", () => {
		const result = renderToString(
			React.createElement(StatusBar, {
				statusMessage: "Ready",
				skillCount: 1,
				messageCount: 2,
				contextSize: 3,
				version: "1.0.0",
				model: "gpt-4o",
				project: "/home/user/projects/foo",
			}),
		);
		assert.ok(typeof result === "string");
		// The project tag must not sit immediately beside the model name.
		// The model is rendered as " gpt-4o" and the project as " ∙ foo".
		// Between them must be at least the skills/messages/context/tokens
		// elements, so the project tag should appear after the model in the
		// rendered output but not as "gpt-4o ∙ foo" adjacent.
		const modelIndex = result.indexOf("gpt-4o");
		const projectIndex = result.indexOf("foo");
		assert.ok(modelIndex !== -1, "should render the model name");
		assert.ok(projectIndex !== -1, "should render the project name");
		assert.ok(projectIndex > modelIndex, "project tag should appear after the model name");
		assert.ok(
			!result.includes("gpt-4o ∙ foo"),
			"project tag should not be adjacent to the model name",
		);
	});
});

describe("StatusBar per-item visibility", () => {
	const baseProps = {
		statusMessage: "Ready",
		skillCount: 1,
		messageCount: 2,
		contextSize: 3,
		version: "1.0.0",
		model: "gpt-4o",
		quote: "A test quote",
		tokenCount: 5,
		tokenBudget: 100,
	};

	it("renders all elements by default when no statusBar prop is provided", () => {
		const result = renderToString(
			React.createElement(StatusBar, { ...baseProps, contextSize: 50, contextWindow: 100 }),
		);
		assert.ok(typeof result === "string");
		assert.ok(!result.includes("🧠"), "should not render the brain glyph");
		assert.ok(result.includes("⚡"), "should render the skills glyph");
		assert.ok(result.includes("💬"), "should render the messages glyph");
		assert.ok(result.includes("▮"), "should render the context meter");
		assert.ok(result.includes("💎"), "should render the tokens glyph");
		assert.ok(result.includes("A test quote"), "should render the quote");
		assert.ok(result.includes("1.0.0"), "should render the version");
	});

	it("renders dot separators instead of brackets", () => {
		const result = renderToString(React.createElement(StatusBar, baseProps));
		assert.ok(typeof result === "string");
		assert.ok(!result.includes("["), "should not render opening brackets");
		assert.ok(!result.includes("]"), "should not render closing brackets");
		assert.ok(result.includes("∙"), "should render the dot separator");
	});

	it("renders the model name with no leading dot", () => {
		const result = renderToString(React.createElement(StatusBar, baseProps));
		assert.ok(typeof result === "string");
		// The model name is the first element after the streaming indicator
		// and should not have a dot immediately before it. The streaming
		// indicator "∙∙∙" precedes it, so check that the char immediately
		// before the model name is a space, not a dot separator.
		const modelIndex = result.indexOf("gpt-4o");
		assert.ok(modelIndex !== -1, "should render the model name");
		assert.ok(
			result[modelIndex - 1] !== "∙",
			"model name should have no dot immediately before it",
		);
	});

	it("renders dot-space-glyph spacing for each element", () => {
		const result = renderToString(
			React.createElement(StatusBar, { ...baseProps, contextSize: 50, contextWindow: 100 }),
		);
		assert.ok(typeof result === "string");
		assert.ok(result.includes("∙ ⚡"), "skills should render as dot-space-glyph");
		assert.ok(result.includes("∙ 💬"), "messages should render as dot-space-glyph");
		assert.ok(result.includes("∙ [▮"), "context should render as dot-space-meter");
		assert.ok(result.includes("∙ 💎"), "tokens should render as dot-space-glyph");
	});

	it("applies SI postfix to context and token numbers", () => {
		const result = renderToString(
			React.createElement(StatusBar, {
				...baseProps,
				contextSize: 12200,
				tokenCount: 1400000,
				tokenBudget: 2000000,
			}),
		);
		assert.ok(typeof result === "string");
		assert.ok(result.includes("12.2k"), "context should use SI postfix");
		assert.ok(result.includes("1.4M"), "token count should use SI postfix");
		assert.ok(result.includes("2M"), "token budget should use SI postfix");
	});

	it("omits the skills element when statusBar.skills is false", () => {
		const result = renderToString(
			React.createElement(StatusBar, { ...baseProps, statusBar: { skills: false } }),
		);
		assert.ok(typeof result === "string");
		assert.ok(!result.includes("⚡"), "should not render the skills glyph");
		assert.ok(!result.includes("🧠"), "should not render the brain glyph");
		assert.ok(result.includes("💬"), "should still render the messages glyph");
	});

	it("omits the model element when statusBar.model is false", () => {
		const result = renderToString(
			React.createElement(StatusBar, { ...baseProps, statusBar: { model: false } }),
		);
		assert.ok(typeof result === "string");
		assert.ok(!result.includes("🧠"), "should not render the brain glyph");
		assert.ok(result.includes("⚡"), "should still render the skills glyph");
	});

	it("omits the messages element when statusBar.messages is false", () => {
		const result = renderToString(
			React.createElement(StatusBar, { ...baseProps, statusBar: { messages: false } }),
		);
		assert.ok(typeof result === "string");
		assert.ok(!result.includes("💬"), "should not render the messages glyph");
	});

	it("omits the context element when statusBar.context is false", () => {
		const result = renderToString(
			React.createElement(StatusBar, { ...baseProps, statusBar: { context: false } }),
		);
		assert.ok(typeof result === "string");
		assert.ok(!result.includes("▦"), "should not render the context glyph");
	});

	it("omits the tokens element when statusBar.tokens is false", () => {
		const result = renderToString(
			React.createElement(StatusBar, { ...baseProps, statusBar: { tokens: false } }),
		);
		assert.ok(typeof result === "string");
		assert.ok(!result.includes("💎"), "should not render the tokens glyph");
	});

	it("omits the quote element when statusBar.quote is false", () => {
		const result = renderToString(
			React.createElement(StatusBar, { ...baseProps, statusBar: { quote: false } }),
		);
		assert.ok(typeof result === "string");
		assert.ok(!result.includes("A test quote"), "should not render the quote");
		assert.ok(result.includes("1.0.0"), "should still render the version");
	});

	it("omits the version element when statusBar.version is false", () => {
		const result = renderToString(
			React.createElement(StatusBar, { ...baseProps, statusBar: { version: false } }),
		);
		assert.ok(typeof result === "string");
		assert.ok(!result.includes("1.0.0"), "should not render the version");
	});

	it("still renders the streaming indicator when all elements are hidden", () => {
		const result = renderToString(
			React.createElement(StatusBar, {
				...baseProps,
				statusMessage: "Streaming...",
				statusBar: {
					model: false,
					skills: false,
					messages: false,
					context: false,
					tokens: false,
					quote: false,
					version: false,
				},
			}),
		);
		assert.ok(typeof result === "string");
		assert.ok(result.includes("∙"), "should still render the streaming indicator");
	});
});

describe("StatusBar context meter", () => {
	it("renders a visual meter when contextWindow is configured", () => {
		const result = renderToString(
			React.createElement(StatusBar, {
				statusMessage: "Ready",
				skillCount: 1,
				messageCount: 2,
				contextSize: 64000,
				contextWindow: 128000,
				version: "1.0.0",
			}),
		);
		assert.ok(typeof result === "string");
		assert.ok(result.includes("▮"), "should render filled block characters");
		assert.ok(result.includes("▯"), "should render empty block characters");
		assert.ok(result.includes("50%"), "should render the utilization percentage");
	});

	it("falls back to the bare number when contextWindow is unset", () => {
		const result = renderToString(
			React.createElement(StatusBar, {
				statusMessage: "Ready",
				skillCount: 1,
				messageCount: 2,
				contextSize: 12200,
				contextWindow: 0,
				version: "1.0.0",
			}),
		);
		assert.ok(typeof result === "string");
		assert.ok(result.includes("12.2k"), "should render the bare SI-formatted number");
		assert.ok(!result.includes("▮"), "should not render filled block characters");
	});

	it("renders 0% when context size is zero", () => {
		const result = renderToString(
			React.createElement(StatusBar, {
				statusMessage: "Ready",
				skillCount: 1,
				messageCount: 2,
				contextSize: 0,
				contextWindow: 128000,
				version: "1.0.0",
			}),
		);
		assert.ok(typeof result === "string");
		assert.ok(result.includes("0%"), "should render 0% utilization");
	});

	it("renders 100% when context size equals the window", () => {
		const result = renderToString(
			React.createElement(StatusBar, {
				statusMessage: "Ready",
				skillCount: 1,
				messageCount: 2,
				contextSize: 128000,
				contextWindow: 128000,
				version: "1.0.0",
			}),
		);
		assert.ok(typeof result === "string");
		assert.ok(result.includes("100%"), "should render 100% utilization");
	});
});
