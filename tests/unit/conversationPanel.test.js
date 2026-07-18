import React from "react";
import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import { render } from "ink";
import {
	ConversationPanel,
	getRoleColors,
	getBubbleStyle,
} from "../../src/tui/conversationPanel.js";

let unmount;

afterEach(() => {
	if (unmount) unmount();
});

describe("ConversationPanel - component rendering", () => {
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

describe("ConversationPanel - MessageList integration", () => {
	it("renders MessageList inside ConversationPanel component tree", () => {
		const { unmount: um } = render(
			React.createElement(ConversationPanel, {
				messages: [{ role: "user", content: "hello" }],
			}),
		);
		unmount = um;
	});

	it("passes assistantName to MessageList", () => {
		const { unmount: um } = render(
			React.createElement(ConversationPanel, {
				messages: [],
				assistantName: "CustomBot",
			}),
		);
		unmount = um;
	});

	it("handles empty messages via empty state", () => {
		const { unmount: um } = render(React.createElement(ConversationPanel, { messages: [] }));
		unmount = um;
	});

	it("handles undefined messages gracefully (defaults to empty)", () => {
		const { unmount: um } = render(React.createElement(ConversationPanel, { messages: undefined }));
		unmount = um;
	});

	it("accepts messageListRef for imperative access", () => {
		const listRef = { current: { setMessages: () => {}, addMessage: () => {} } };
		const { unmount: um } = render(
			React.createElement(ConversationPanel, {
				messages: [],
				assistantName: "Bot",
				messageListRef: listRef,
			}),
		);
		unmount = um;
	});
});
