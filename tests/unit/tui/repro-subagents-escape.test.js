import React, { createRef } from "react";
import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import { render } from "ink";
import ConversationArea from "../../../src/tui/conversationArea.js";

let unmount;
afterEach(() => {
	if (unmount) unmount();
});

function renderConversationArea(ref, hidden, messageCountRef) {
	return React.createElement(ConversationArea, {
		ref,
		config: { tui: { name: "Assistant" } },
		registry: null,
		sessionState: null,
		dispatchProvider: null,
		scheduleManager: null,
		onSaveSession: () => {},
		gcManager: null,
		gcTrigger: null,
		compactContext: null,
		getContextMessages: () => [],
		model: null,
		systemPrompt: "",
		messageCountRef,
		hidden,
	});
}

describe("Repro: ConversationArea hidden round-trip preserves message state", () => {
	it("keeps messages when toggling hidden (panel view) and back", async () => {
		const ref = createRef();
		const messageCountRef = { current: 0 };
		const { unmount: um, rerender } = render(renderConversationArea(ref, false, messageCountRef));
		unmount = um;

		// Add a message while visible
		ref.current.addMessage({ role: "user", content: "hello world" });
		assert.strictEqual(messageCountRef.current, 1, "message added while visible");
		assert.strictEqual(ref.current.getSelectionMessages().length, 1, "message list has 1 message");

		// Toggle hidden (panel view active) — the regression path
		rerender(renderConversationArea(ref, true, messageCountRef));

		// Toggle back to visible (Escape returns to conversation)
		rerender(renderConversationArea(ref, false, messageCountRef));

		// The message must survive the round-trip — getSelectionMessages reads
		// from the MessageList's internal dataRef/idsRef, which is destroyed if
		// the subtree unmounts.
		assert.strictEqual(
			ref.current.getSelectionMessages().length,
			1,
			"message survives hidden round-trip",
		);
	});
});
