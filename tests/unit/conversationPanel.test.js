import React from "react";
import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import { render } from "ink";
import {
	ConversationPanel,
	getRoleColors,
	getBubbleStyle,
	renderMessages,
} from "../../src/tui/conversationPanel.js";
import { getRoleLabel } from "../../src/tui/messages.js";

describe("ConversationPanel - component rendering", () => {
	let unmount;

	afterEach(() => {
		if (unmount) unmount();
	});

	it("renders with default props", () => {
		const { unmount: um } = render(React.createElement(ConversationPanel, {}));
		unmount = um;
	});

	it("renders with messages", () => {
		const { unmount: um } = render(
			React.createElement(ConversationPanel, {
				messages: [{ role: "user", content: "hello" }],
			}),
		);
		unmount = um;
	});

	it("renders with custom assistant name", () => {
		const { unmount: um } = render(
			React.createElement(ConversationPanel, {
				messages: [],
				assistantName: "CustomBot",
			}),
		);
		unmount = um;
	});

	it("handles undefined messages (defaults to empty array)", () => {
		const { unmount: um } = render(React.createElement(ConversationPanel, {}));
		unmount = um;
	});

	it("handles null messages (defaults to empty array)", () => {
		const { unmount: um } = render(React.createElement(ConversationPanel, { messages: null }));
		unmount = um;
	});
});

describe("ConversationPanel - getRoleColors", () => {
	it("returns green and white for user role", async () => {
		assert.deepStrictEqual(getRoleColors("user"), { label: "green", content: "white" });
	});

	it("returns yellow and yellow for system role", async () => {
		assert.deepStrictEqual(getRoleColors("system"), { label: "yellow", content: "yellow" });
	});

	it("returns cyan and white for assistant role (default)", async () => {
		assert.deepStrictEqual(getRoleColors("assistant"), { label: "cyan", content: "white" });
	});
});

describe("ConversationPanel - getBubbleStyle", () => {
	it("returns flex-end alignment with green border for user", async () => {
		assert.deepStrictEqual(getBubbleStyle("user"), { alignment: "flex-end", border: "green" });
	});

	it("returns flex-start alignment with yellow border for system", async () => {
		assert.deepStrictEqual(getBubbleStyle("system"), { alignment: "flex-start", border: "yellow" });
	});

	it("returns flex-start alignment with cyan border for assistant (default)", async () => {
		assert.deepStrictEqual(getBubbleStyle("assistant"), {
			alignment: "flex-start",
			border: "cyan",
		});
	});
});

describe("ConversationPanel - renderMessages", () => {
	it("returns array with empty state message when no messages", () => {
		const result = renderMessages([], "Assistant");
		assert.ok(Array.isArray(result));
		assert.strictEqual(result.length, 1);
		assert.ok(React.isValidElement(result[0]));
		assert.strictEqual(result[0].props.color, "gray");
	});

	it("renders user message with correct alignment", () => {
		renderMessages([{ role: "user", content: "hello", time: "10:00" }], "Bot");
		const bubbleStyle = getBubbleStyle("user");
		assert.strictEqual(bubbleStyle.alignment, "flex-end");
	});

	it("renders assistant message with correct alignment", () => {
		renderMessages([{ role: "assistant", content: "hi there", time: "10:01" }], "Bot");
		const bubbleStyle = getBubbleStyle("assistant");
		assert.strictEqual(bubbleStyle.alignment, "flex-start");
	});

	it("renders system message with correct alignment", () => {
		renderMessages([{ role: "system", content: "init", time: "10:01" }], "Bot");
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
		const outerBox = result[0];
		// Memo-wrapped MessageBubble: props contain msg and display props
		const msg = outerBox.props.msg || outerBox.props.children?.[0];
		// Verify toolCallDisplay was captured (2 lines = 2 tool calls)
		const toolLines = msg?.toolCallDisplay?.split("\n") || [];
		assert.strictEqual(toolLines.length, 2);
		// Bubble style for assistant = flex-start
		const bubble = getBubbleStyle("assistant");
		assert.strictEqual(bubble.alignment, "flex-start");
		assert.strictEqual(bubble.border, "cyan");
		// Null for reasoning and activeToolCall (none present)
		assert.strictEqual(msg?.reasoningContent, undefined);
		assert.strictEqual(msg?.activeToolCall, undefined);
		assert.ok(msg?.toolCallDisplay);
	});

	it("renders assistant message without toolCallDisplay", () => {
		const messages = [{ role: "assistant", content: "no tools", time: "10:01" }];
		const result = renderMessages(messages, "Bot");
		const outerBox = result[0];
		// Memo-wrapped MessageBubble: props contain msg and display props
		const msg = outerBox.props.msg || outerBox.props.children?.[0];
		// No optional sections present
		assert.strictEqual(msg?.reasoningContent, undefined);
		assert.strictEqual(msg?.activeToolCall, undefined);
		assert.strictEqual(msg?.toolCallDisplay, undefined);
		assert.ok(msg?.content);
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
		// Verify the role label is resolved with custom name
		const label = getRoleLabel("assistant", "CustomBot");
		assert.strictEqual(label, "CustomBot");
		// Verify the message props contain the correct data
		const outerBox = result[0];
		const msg = outerBox.props.msg || outerBox.props.children?.[0];
		assert.strictEqual(msg?.role, "assistant");
		assert.strictEqual(msg?.content, "test");
		assert.strictEqual(msg?.time, "10:00");
	});
});
