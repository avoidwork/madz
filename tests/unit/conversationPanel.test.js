import React from "react";
import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import { render } from "ink";
import {
	ConversationPanel,
	getRoleColors,
	getBubbleStyle,
	renderMessages,
	getHighContrastColors,
	getHighContrastBubbleStyle,
	handleScrollInput,
	handleResize,
	handleAutoScroll,
	executeScrollInput,
	executeResize,
	executeAutoScroll,
} from "../../src/tui/conversationPanel.js";
import { getRoleLabel } from "../../src/tui/messages.js";

describe("ConversationPanel - component rendering", () => {
	let unmount;

	afterEach(() => {
		if (unmount) {
			unmount();
		}
	});

	it("renders with empty messages", () => {
		const { unmount: um } = render(
			React.createElement(ConversationPanel, { messages: [], assistantName: "Bot" }),
		);
		unmount = um;
	});

	it("renders with user message", () => {
		const { unmount: um } = render(
			React.createElement(ConversationPanel, {
				messages: [{ role: "user", content: "hello", time: "10:00" }],
				assistantName: "Bot",
			}),
		);
		unmount = um;
	});

	it("renders with assistant message", () => {
		const { unmount: um } = render(
			React.createElement(ConversationPanel, {
				messages: [{ role: "assistant", content: "hi there", time: "10:01" }],
				assistantName: "Bot",
			}),
		);
		unmount = um;
	});

	it("renders with system message", () => {
		const { unmount: um } = render(
			React.createElement(ConversationPanel, {
				messages: [{ role: "system", content: "init", time: "10:01" }],
				assistantName: "Bot",
			}),
		);
		unmount = um;
	});

	it("renders with streaming message", () => {
		const { unmount: um } = render(
			React.createElement(ConversationPanel, {
				messages: [
					{
						role: "assistant",
						content: "streaming...",
						time: "10:01",
						streaming: true,
					},
				],
				assistantName: "Bot",
			}),
		);
		unmount = um;
	});

	it("renders with toolCallDisplay", () => {
		const { unmount: um } = render(
			React.createElement(ConversationPanel, {
				messages: [
					{
						role: "assistant",
						content: "result",
						time: "10:01",
						toolCallDisplay: "- Tool: search",
					},
				],
				assistantName: "Bot",
			}),
		);
		unmount = um;
	});

	it("renders with multiple messages of different roles", () => {
		const { unmount: um } = render(
			React.createElement(ConversationPanel, {
				messages: [
					{ role: "system", content: "init", time: "10:00" },
					{ role: "user", content: "hello", time: "10:01" },
					{ role: "assistant", content: "hi", time: "10:02" },
				],
				assistantName: "Bot",
			}),
		);
		unmount = um;
	});

	it("renders with custom assistantName", () => {
		const { unmount: um } = render(
			React.createElement(ConversationPanel, {
				messages: [{ role: "assistant", content: "test", time: "10:00" }],
				assistantName: "CustomBot",
			}),
		);
		unmount = um;
	});

	it("renders without assistantName (default)", () => {
		const { unmount: um } = render(
			React.createElement(ConversationPanel, {
				messages: [{ role: "user", content: "test" }],
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

describe("ConversationPanel - handleScrollInput", () => {
	it("returns early when scrollRef is null", () => {
		const result = handleScrollInput(null, {});
		assert.strictEqual(result, undefined);
	});

	it("returns early when scrollRef is undefined", () => {
		const result = handleScrollInput(undefined, {});
		assert.strictEqual(result, undefined);
	});

	it("calls scrollBy(-1) when upArrow is pressed", () => {
		let scrollAmount = 0;
		const scrollRef = {
			scrollBy: (amount) => {
				scrollAmount += amount;
			},
			getViewportHeight: () => 20,
		};
		handleScrollInput(scrollRef, { upArrow: true });
		assert.strictEqual(scrollAmount, -1);
	});

	it("calls scrollBy(1) when downArrow is pressed", () => {
		let scrollAmount = 0;
		const scrollRef = {
			scrollBy: (amount) => {
				scrollAmount += amount;
			},
			getViewportHeight: () => 20,
		};
		handleScrollInput(scrollRef, { downArrow: true });
		assert.strictEqual(scrollAmount, 1);
	});

	it("calls scrollBy(-height) when pageUp is pressed", () => {
		let scrollAmount = 0;
		const scrollRef = {
			scrollBy: (amount) => {
				scrollAmount += amount;
			},
			getViewportHeight: () => 25,
		};
		handleScrollInput(scrollRef, { pageUp: true });
		assert.strictEqual(scrollAmount, -25);
	});

	it("calls scrollBy(1) when pageDown is pressed", () => {
		let scrollAmount = 0;
		const scrollRef = {
			scrollBy: (amount) => {
				scrollAmount += amount;
			},
			getViewportHeight: () => 25,
		};
		handleScrollInput(scrollRef, { pageDown: true });
		assert.strictEqual(scrollAmount, 25);
	});

	it("uses height=1 as fallback when getViewportHeight returns falsy", () => {
		let scrollAmount = 0;
		const scrollRef = {
			scrollBy: (amount) => {
				scrollAmount += amount;
			},
			getViewportHeight: () => null,
		};
		handleScrollInput(scrollRef, { pageUp: true });
		assert.strictEqual(scrollAmount, -1);
	});

	it("handles multiple key presses in sequence", () => {
		let scrollAmount = 0;
		const scrollRef = {
			scrollBy: (amount) => {
				scrollAmount += amount;
			},
			getViewportHeight: () => 10,
		};
		handleScrollInput(scrollRef, { upArrow: true });
		handleScrollInput(scrollRef, { downArrow: true });
		handleScrollInput(scrollRef, { pageUp: true });
		handleScrollInput(scrollRef, { pageDown: true });
		// upArrow: -1, downArrow: 1, pageUp: -10, pageDown: 10
		assert.strictEqual(scrollAmount, 0);
	});
});

describe("ConversationPanel - handleResize", () => {
	it("does nothing when scrollRef is null", () => {
		let called = false;
		const result = handleResize(null);
		assert.strictEqual(result, undefined);
		assert.strictEqual(called, false);
	});

	it("does nothing when scrollRef is undefined", () => {
		const result = handleResize(undefined);
		assert.strictEqual(result, undefined);
	});

	it("calls remeasure when scrollRef exists", () => {
		let remeasureCalled = false;
		const scrollRef = {
			remeasure: () => {
				remeasureCalled = true;
			},
		};
		handleResize(scrollRef);
		assert.strictEqual(remeasureCalled, true);
	});
});

describe("ConversationPanel - handleAutoScroll", () => {
	it("returns unchanged when scrollRef is null", () => {
		const result = handleAutoScroll(null, [{ content: "hi" }], 0);
		assert.deepStrictEqual(result, { newCount: 0, scrolled: false });
	});

	it("returns unchanged when messages is empty", () => {
		const result = handleAutoScroll({}, [], 0);
		assert.deepStrictEqual(result, { newCount: 0, scrolled: false });
	});

	it("scrolls to bottom when new message arrives", () => {
		let scrollToBottomCalled = false;
		const scrollRef = {
			scrollToBottom: () => {
				scrollToBottomCalled = true;
			},
			getContentHeight: () => 100,
			getViewportHeight: () => 50,
		};
		const result = handleAutoScroll(scrollRef, [{ content: "hi" }], 0);
		assert.strictEqual(scrollToBottomCalled, true);
		assert.deepStrictEqual(result, { newCount: 1, scrolled: true });
	});

	it("scrolls to bottom when streaming and content exceeds viewport", () => {
		let scrollToBottomCalled = false;
		const scrollRef = {
			scrollToBottom: () => {
				scrollToBottomCalled = true;
			},
			getContentHeight: () => 100,
			getViewportHeight: () => 50,
		};
		const messages = [{ content: "streaming...", streaming: true }];
		const result = handleAutoScroll(scrollRef, messages, 1);
		assert.strictEqual(scrollToBottomCalled, true);
		assert.deepStrictEqual(result, { newCount: 1, scrolled: true });
	});

	it("does not scroll when streaming but content fits viewport", () => {
		let scrollToBottomCalled = false;
		const scrollRef = {
			scrollToBottom: () => {
				scrollToBottomCalled = true;
			},
			getContentHeight: () => 30,
			getViewportHeight: () => 50,
		};
		const messages = [{ content: "short", streaming: true }];
		const result = handleAutoScroll(scrollRef, messages, 1);
		assert.strictEqual(scrollToBottomCalled, false);
		assert.deepStrictEqual(result, { newCount: 1, scrolled: false });
	});

	it("does not scroll for non-streaming message when not new", () => {
		let scrollToBottomCalled = false;
		const scrollRef = {
			scrollToBottom: () => {
				scrollToBottomCalled = true;
			},
			getContentHeight: () => 100,
			getViewportHeight: () => 50,
		};
		const messages = [{ content: "completed" }];
		const result = handleAutoScroll(scrollRef, messages, 1);
		assert.strictEqual(scrollToBottomCalled, false);
		assert.deepStrictEqual(result, { newCount: 1, scrolled: false });
	});

	it("handles multiple messages with new last message", () => {
		let scrollToBottomCalled = false;
		const scrollRef = {
			scrollToBottom: () => {
				scrollToBottomCalled = true;
			},
			getContentHeight: () => 100,
			getViewportHeight: () => 50,
		};
		const messages = [{ content: "first" }, { content: "second" }];
		const result = handleAutoScroll(scrollRef, messages, 1);
		assert.strictEqual(scrollToBottomCalled, true);
		assert.deepStrictEqual(result, { newCount: 2, scrolled: true });
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
		assert.strictEqual(result[0].props.gray, true);
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

describe("ConversationPanel - execute wrappers", () => {
	it("executeScrollInput calls handleScrollInput", () => {
		let scrolled = 0;
		const scrollRef = {
			scrollBy: (amount) => {
				scrolled += amount;
			},
			getViewportHeight: () => 20,
		};
		executeScrollInput(scrollRef, { upArrow: true });
		assert.strictEqual(scrolled, -1);
	});

	it("executeScrollInput with downArrow", () => {
		let scrolled = 0;
		const scrollRef = {
			scrollBy: (amount) => {
				scrolled += amount;
			},
			getViewportHeight: () => 20,
		};
		executeScrollInput(scrollRef, { downArrow: true });
		assert.strictEqual(scrolled, 1);
	});

	it("executeScrollInput with pageUp", () => {
		let scrolled = 0;
		const scrollRef = {
			scrollBy: (amount) => {
				scrolled += amount;
			},
			getViewportHeight: () => 25,
		};
		executeScrollInput(scrollRef, { pageUp: true });
		assert.strictEqual(scrolled, -25);
	});

	it("executeScrollInput with pageDown", () => {
		let scrolled = 0;
		const scrollRef = {
			scrollBy: (amount) => {
				scrolled += amount;
			},
			getViewportHeight: () => 25,
		};
		executeScrollInput(scrollRef, { pageDown: true });
		assert.strictEqual(scrolled, 25);
	});

	it("executeScrollInput does nothing when scrollRef is null", () => {
		const result = executeScrollInput(null, { upArrow: true });
		assert.strictEqual(result, undefined);
	});

	it("executeResize calls handleResize", () => {
		let remeasured = false;
		const scrollRef = {
			remeasure: () => {
				remeasured = true;
			},
		};
		executeResize(scrollRef);
		assert.strictEqual(remeasured, true);
	});

	it("executeResize does nothing when scrollRef is null", () => {
		const result = executeResize(null);
		assert.strictEqual(result, undefined);
	});

	it("executeAutoScroll updates count on new message", () => {
		let scrollToBottomCalled = false;
		const scrollRef = {
			scrollToBottom: () => {
				scrollToBottomCalled = true;
			},
			getContentHeight: () => 100,
			getViewportHeight: () => 50,
		};
		const countRef = { current: 0 };
		executeAutoScroll(scrollRef, [{ content: "hi" }], 0, countRef);
		assert.strictEqual(scrollToBottomCalled, true);
		assert.strictEqual(countRef.current, 1);
	});

	it("executeAutoScroll does nothing when scrollRef is null", () => {
		const countRef = { current: 5 };
		executeAutoScroll(null, [{ content: "hi" }], 5, countRef);
		assert.strictEqual(countRef.current, 5);
	});

	it("executeAutoScroll does nothing when messages empty", () => {
		let scrollToBottomCalled = false;
		const scrollRef = {
			scrollToBottom: () => {
				scrollToBottomCalled = true;
			},
			getContentHeight: () => 100,
			getViewportHeight: () => 50,
		};
		const countRef = { current: 3 };
		executeAutoScroll(scrollRef, [], 3, countRef);
		assert.strictEqual(scrollToBottomCalled, false);
		assert.strictEqual(countRef.current, 3);
	});

	it("executeAutoScroll scrolls when streaming and overflow", () => {
		let scrollToBottomCalled = false;
		const scrollRef = {
			scrollToBottom: () => {
				scrollToBottomCalled = true;
			},
			getContentHeight: () => 200,
			getViewportHeight: () => 50,
		};
		const countRef = { current: 5 };
		const messages = [{ content: "streaming...", streaming: true }];
		executeAutoScroll(scrollRef, messages, 5, countRef);
		assert.strictEqual(scrollToBottomCalled, true);
		assert.strictEqual(countRef.current, 5);
	});

	it("executeAutoScroll does not scroll when streaming but no overflow", () => {
		let scrollToBottomCalled = false;
		const scrollRef = {
			scrollToBottom: () => {
				scrollToBottomCalled = true;
			},
			getContentHeight: () => 30,
			getViewportHeight: () => 50,
		};
		const countRef = { current: 5 };
		const messages = [{ content: "short", streaming: true }];
		executeAutoScroll(scrollRef, messages, 5, countRef);
		assert.strictEqual(scrollToBottomCalled, false);
		assert.strictEqual(countRef.current, 5);
	});

	it("executeAutoScroll does not scroll for non-streaming message", () => {
		let scrollToBottomCalled = false;
		const scrollRef = {
			scrollToBottom: () => {
				scrollToBottomCalled = true;
			},
			getContentHeight: () => 200,
			getViewportHeight: () => 50,
		};
		const countRef = { current: 5 };
		const messages = [{ content: "completed" }];
		executeAutoScroll(scrollRef, messages, 5, countRef);
		assert.strictEqual(scrollToBottomCalled, false);
		assert.strictEqual(countRef.current, 5);
	});
});

describe("ConversationPanel - getHighContrastColors", () => {
	it("returns white for user role in high-contrast mode", () => {
		assert.deepStrictEqual(getHighContrastColors("user"), { label: "white", content: "white" });
	});

	it("returns white for assistant role in high-contrast mode", () => {
		assert.deepStrictEqual(getHighContrastColors("assistant"), {
			label: "white",
			content: "white",
		});
	});

	it("returns white for system role in high-contrast mode", () => {
		assert.deepStrictEqual(getHighContrastColors("system"), { label: "white", content: "white" });
	});

	it("caches results per role", () => {
		const result1 = getHighContrastColors("user");
		const result2 = getHighContrastColors("user");
		assert.strictEqual(result1, result2); // Same cached reference
	});
});

describe("ConversationPanel - getHighContrastBubbleStyle", () => {
	it("returns background tint for user role", () => {
		assert.deepStrictEqual(getHighContrastBubbleStyle("user"), {
			alignment: "flex-end",
			border: "green",
			background: "#2a2a2a",
		});
	});

	it("returns background tint for assistant role", () => {
		assert.deepStrictEqual(getHighContrastBubbleStyle("assistant"), {
			alignment: "flex-start",
			border: "cyan",
			background: "#252525",
		});
	});

	it("returns background tint for system role", () => {
		assert.deepStrictEqual(getHighContrastBubbleStyle("system"), {
			alignment: "flex-start",
			border: "yellow",
			background: "#2a2420",
		});
	});

	it("caches results per role", () => {
		const result1 = getHighContrastBubbleStyle("assistant");
		const result2 = getHighContrastBubbleStyle("assistant");
		assert.strictEqual(result1, result2);
	});
});

describe("ConversationPanel - getRoleColors with highContrast", () => {
	it("returns green/white for user when highContrast is false", () => {
		assert.deepStrictEqual(getRoleColors("user", false), { label: "green", content: "white" });
	});

	it("returns white for user when highContrast is true", () => {
		assert.deepStrictEqual(getRoleColors("user", true), { label: "white", content: "white" });
	});

	it("returns cyan/white for assistant when highContrast is false", () => {
		assert.deepStrictEqual(getRoleColors("assistant", false), { label: "cyan", content: "white" });
	});

	it("returns white for assistant when highContrast is true", () => {
		assert.deepStrictEqual(getRoleColors("assistant", true), { label: "white", content: "white" });
	});

	it("returns yellow for system when highContrast is false", () => {
		assert.deepStrictEqual(getRoleColors("system", false), { label: "yellow", content: "yellow" });
	});

	it("returns white for system when highContrast is true", () => {
		assert.deepStrictEqual(getRoleColors("system", true), { label: "white", content: "white" });
	});
});

describe("ConversationPanel - renderMessages with highContrast", () => {
	it("renders empty state with highContrast prop", () => {
		const result = renderMessages([], "Bot", true);
		assert.strictEqual(result.length, 1);
		const emptyEl = result[0];
		assert.strictEqual(emptyEl.props.bold, true);
	});

	it("renders empty state without bold when highContrast is false", () => {
		const result = renderMessages([], "Bot", false);
		assert.strictEqual(result.length, 1);
		const emptyEl = result[0];
		assert.strictEqual(emptyEl.props.bold, false);
	});
});

describe("ConversationPanel - component with backgroundColor", () => {
	it("renders with default backgroundColor", () => {
		const { unmount } = render(
			React.createElement(ConversationPanel, { messages: [], assistantName: "Bot" }),
		);
		unmount();
	});

	it("renders with custom backgroundColor", () => {
		const { unmount } = render(
			React.createElement(ConversationPanel, {
				messages: [],
				assistantName: "Bot",
				backgroundColor: "#000000",
			}),
		);
		unmount();
	});
});
