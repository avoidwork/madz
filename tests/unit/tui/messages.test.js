import { describe, it } from "node:test";
import assert from "node:assert";
import {
	getRoleLabel,
	formatMessage,
	isStreamingMessage,
	countMessageLines,
	getToolCallLines,
} from "../../../src/tui/messages.js";

describe("getRoleLabel", () => {
	it("returns 'You' for user role", () => {
		assert.strictEqual(getRoleLabel("user"), "You");
	});

	it("returns 'Assistant' for assistant role", () => {
		assert.strictEqual(getRoleLabel("assistant"), "Assistant");
	});

	it("returns custom name for assistant role", () => {
		assert.strictEqual(getRoleLabel("assistant", "Mads"), "Mads");
	});

	it("returns 'System' for system role", () => {
		assert.strictEqual(getRoleLabel("system"), "System");
	});

	it("returns role string for unknown role", () => {
		assert.strictEqual(getRoleLabel("tool"), "tool");
	});

	it("returns 'Unknown' for falsy role", () => {
		assert.strictEqual(getRoleLabel(""), "Unknown");
	});
});

describe("formatMessage", () => {
	it("formats a user message", () => {
		const msg = { role: "user", content: "Hello" };
		const result = formatMessage(msg);
		assert.ok(result.includes("You"));
		assert.ok(result.includes("Hello"));
	});

	it("formats a message with timestamp", () => {
		const msg = { role: "assistant", content: "Hi", timestamp: "12:00" };
		const result = formatMessage(msg);
		assert.ok(result.includes("12:00"));
	});

	it("handles empty content", () => {
		const msg = { role: "user", content: "" };
		const result = formatMessage(msg);
		assert.ok(result.includes("(empty)"));
	});
});

describe("isStreamingMessage", () => {
	it("returns true when streaming is true", () => {
		assert.strictEqual(isStreamingMessage({ streaming: true }), true);
	});

	it("returns false when streaming is false", () => {
		assert.strictEqual(isStreamingMessage({ streaming: false }), false);
	});

	it("returns false when streaming is undefined", () => {
		assert.strictEqual(isStreamingMessage({}), false);
	});
});

describe("countMessageLines", () => {
	it("counts lines for a single message", () => {
		const messages = [{ role: "user", content: "Hello" }];
		const count = countMessageLines(messages);
		// 2 (label + content start) + 1 (content lines) + 1 (separator) = 4
		assert.strictEqual(count, 4);
	});

	it("counts lines for multiple messages", () => {
		const messages = [
			{ role: "user", content: "Hi" },
			{ role: "assistant", content: "Hello there!" },
		];
		const count = countMessageLines(messages);
		assert.strictEqual(count, 8);
	});

	it("handles empty messages array", () => {
		assert.strictEqual(countMessageLines([]), 0);
	});

	it("handles long content with line wrapping", () => {
		const messages = [{ role: "user", content: "A".repeat(200) }];
		const count = countMessageLines(messages, 80);
		// 2 + 3 (ceil(200/80)) + 1 = 6
		assert.strictEqual(count, 6);
	});
});

describe("getToolCallLines", () => {
	it("returns array of lines from tool call display", () => {
		const result = getToolCallLines("line1\nline2\nline3");
		assert.deepStrictEqual(result, ["line1", "line2", "line3"]);
	});

	it("returns empty array for null input", () => {
		assert.deepStrictEqual(getToolCallLines(null), []);
	});

	it("returns empty array for undefined input", () => {
		assert.deepStrictEqual(getToolCallLines(undefined), []);
	});

	it("returns empty array for empty string", () => {
		assert.deepStrictEqual(getToolCallLines(""), []);
	});
});
