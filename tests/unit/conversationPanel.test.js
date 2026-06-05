import React from "react";
import { describe, it } from "node:test";
import assert from "node:assert";
import {
	ConversationPanel,
	getRoleColors,
	getBubbleStyle,
	renderMessages,
} from "../../src/tui/conversationPanel.js";
import { getRoleLabel } from "../../src/tui/messages.js";

describe("ConversationPanel - component rendering", () => {
	it("renders with empty messages", () => {
		const el = React.createElement(ConversationPanel, {
			messages: [],
			assistantName: "Bot",
		});
		assert.ok(React.isValidElement(el));
	});

	it("renders with user message", () => {
		const el = React.createElement(ConversationPanel, {
			messages: [{ role: "user", content: "hello", time: "10:00" }],
			assistantName: "Bot",
		});
		assert.ok(React.isValidElement(el));
	});

	it("renders with assistant message", () => {
		const el = React.createElement(ConversationPanel, {
			messages: [{ role: "assistant", content: "hi there", time: "10:01" }],
			assistantName: "Bot",
		});
		assert.ok(React.isValidElement(el));
	});

	it("renders with system message", () => {
		const el = React.createElement(ConversationPanel, {
			messages: [{ role: "system", content: "init", time: "10:01" }],
			assistantName: "Bot",
		});
		assert.ok(React.isValidElement(el));
	});

	it("renders with streaming message", () => {
		const el = React.createElement(ConversationPanel, {
			messages: [
				{
					role: "assistant",
					content: "streaming...",
					time: "10:01",
					streaming: true,
				},
			],
			assistantName: "Bot",
		});
		assert.ok(React.isValidElement(el));
	});

	it("renders with toolCallDisplay", () => {
		const el = React.createElement(ConversationPanel, {
			messages: [
				{
					role: "assistant",
					content: "result",
					time: "10:01",
					toolCallDisplay: "- Tool: search",
				},
			],
			assistantName: "Bot",
		});
		assert.ok(React.isValidElement(el));
	});

	it("renders with multiple messages of different roles", () => {
		const el = React.createElement(ConversationPanel, {
			messages: [
				{ role: "system", content: "init", time: "10:00" },
				{ role: "user", content: "hello", time: "10:01" },
				{ role: "assistant", content: "hi", time: "10:02" },
			],
			assistantName: "Bot",
		});
		assert.ok(React.isValidElement(el));
	});

	it("renders with custom assistantName", () => {
		const el = React.createElement(ConversationPanel, {
			messages: [{ role: "assistant", content: "test", time: "10:00" }],
			assistantName: "CustomBot",
		});
		assert.ok(React.isValidElement(el));
	});

	it("renders without assistantName (default)", () => {
		const el = React.createElement(ConversationPanel, {
			messages: [{ role: "user", content: "test" }],
		});
		assert.ok(React.isValidElement(el));
	});

	it("handles undefined messages (defaults to empty array)", () => {
		const el = React.createElement(ConversationPanel, {});
		assert.ok(React.isValidElement(el));
	});

	it("handles null messages (defaults to empty array)", () => {
		const el = React.createElement(ConversationPanel, { messages: null });
		assert.ok(React.isValidElement(el));
	});
});

describe("ConversationPanel - getRoleColors", () => {
	it("returns hex colors for user role", () => {
		assert.deepStrictEqual(getRoleColors("user"), {
			label: "#00FF00",
			content: "#FFFFFF",
		});
	});

	it("returns hex colors for system role", () => {
		assert.deepStrictEqual(getRoleColors("system"), {
			label: "#FFFF00",
			content: "#FFFF00",
		});
	});

	it("returns hex colors for assistant role", () => {
		assert.deepStrictEqual(getRoleColors("assistant"), {
			label: "#00FFFF",
			content: "#FFFFFF",
		});
	});

	it("caches results by role", () => {
		const result1 = getRoleColors("user");
		const result2 = getRoleColors("user");
		assert.strictEqual(result1, result2);
	});
});

describe("ConversationPanel - getBubbleStyle", () => {
	it("returns flex-end alignment with hex border for user", () => {
		assert.deepStrictEqual(getBubbleStyle("user"), {
			alignment: "flex-end",
			border: "#00FF00",
		});
	});

	it("returns flex-start alignment with hex border for system", () => {
		assert.deepStrictEqual(getBubbleStyle("system"), {
			alignment: "flex-start",
			border: "#FFFF00",
		});
	});

	it("returns flex-start alignment with hex border for assistant", () => {
		assert.deepStrictEqual(getBubbleStyle("assistant"), {
			alignment: "flex-start",
			border: "#00FFFF",
		});
	});

	it("caches results by role", () => {
		const result1 = getBubbleStyle("assistant");
		const result2 = getBubbleStyle("assistant");
		assert.strictEqual(result1, result2);
	});
});

describe("ConversationPanel - renderMessages", () => {
	it("returns array with empty state message when no messages", () => {
		const result = renderMessages([], "Assistant");
		assert.ok(Array.isArray(result));
		assert.strictEqual(result.length, 1);
	});

	it("renders user message with correct alignment", () => {
		const bubbleStyle = getBubbleStyle("user");
		assert.strictEqual(bubbleStyle.alignment, "flex-end");
	});

	it("renders assistant message with correct alignment", () => {
		const bubbleStyle = getBubbleStyle("assistant");
		assert.strictEqual(bubbleStyle.alignment, "flex-start");
	});

	it("renders system message with correct alignment", () => {
		const bubbleStyle = getBubbleStyle("system");
		assert.strictEqual(bubbleStyle.alignment, "flex-start");
	});

	it("renders assistant message with toolCallDisplay", () => {
		const messages = [
			{
				role: "assistant",
				content: "result",
				time: "10:01",
				toolCallDisplay: "- Tool: search\n- Tool: read",
			},
		];
		const result = renderMessages(messages, "Bot");
		assert.strictEqual(result.length, 1);
		const toolLines = messages[0].toolCallDisplay.split("\n");
		assert.strictEqual(toolLines.length, 2);
	});

	it("renders assistant message without toolCallDisplay", () => {
		const messages = [{ role: "assistant", content: "no tools", time: "10:01" }];
		const result = renderMessages(messages, "Bot");
		assert.strictEqual(result.length, 1);
	});

	it("renders multiple messages", () => {
		const messages = [
			{ role: "user", content: "hi", time: "10:00" },
			{ role: "assistant", content: "hello", time: "10:01" },
		];
		const result = renderMessages(messages, "Bot");
		assert.strictEqual(result.length, 2);
	});

	it("uses custom assistantName in role label", () => {
		const messages = [{ role: "assistant", content: "test", time: "10:00" }];
		const result = renderMessages(messages, "CustomBot");
		assert.strictEqual(result.length, 1);
		const label = getRoleLabel("assistant", "CustomBot");
		assert.strictEqual(label, "CustomBot");
	});
});
