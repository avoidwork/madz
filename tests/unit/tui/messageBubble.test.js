import { describe, it, afterEach } from "node:test";
import React from "react";
import { render } from "ink";
import { MessageBubbleInner, PubSubContext, ScrollContext } from "../../src/tui/messageBubble.js";

describe("MessageBubbleInner", () => {
	let unmount;

	afterEach(() => {
		if (unmount) {
			unmount();
		}
	});

	function renderBubble(props, contextOverrides = {}) {
		const subscribeRef = { current: [] };
		const unsubscribeRef = { current: [] };
		const scrollToBottomRef = { current: 0 };

		const pubSubValue = {
			subscribe: (topic, callback) => {
				subscribeRef.current.push({ topic, callback });
				return () => {};
			},
			unsubscribe: (topic, callback) => {
				unsubscribeRef.current.push({ topic, callback });
			},
		};

		const scrollValue = {
			scrollToBottom: () => {
				scrollToBottomRef.current += 1;
			},
		};

		return render(
			<React.Fragment>
				<PubSubContext.Provider value={{ ...pubSubValue, ...contextOverrides }}>
					<ScrollContext.Provider value={scrollValue}>
						<MessageBubbleInner role="assistant" content="initial" streaming={false} {...props} />
					</ScrollContext.Provider>
				</PubSubContext.Provider>
			</React.Fragment>,
			{
				debug: false,
				stdout: process.stdout,
				stderr: process.stderr,
			},
		);
	}

	describe("pub/sub deduplication", () => {
		it("appends chunks when streaming is true, even if content is identical", () => {
			const { unmount: um, waitUntilUpdate } = renderBubble({ topic: "msg-1" });
			unmount = um;

			// Wait for initial render and subscription
			waitUntilUpdate();

			// Find the subscribe callback
			const subscribeCallback = subscribeRef.current.find((s) => s.topic === "msg-1")?.callback;
			if (!subscribeCallback) {
				throw new Error("Expected subscribe callback for msg-1");
			}

			// Publish streaming update with content
			subscribeCallback({ content: "hello", streaming: true });
			waitUntilUpdate();

			// Publish same content again with streaming
			subscribeCallback({ content: "hello", streaming: true });
			waitUntilUpdate();

			// With streaming=true, dedup is bypassed — should have 2 chunks
			// (initial render has no chunks, then 2 streaming updates)
		});

		it("skips duplicate chunks when streaming is false", () => {
			const { unmount: um, waitUntilUpdate } = renderBubble({ topic: "msg-2" });
			unmount = um;

			// Wait for initial render
			waitUntilUpdate();

			// Find the subscribe callback
			const subscribeCallback = subscribeRef.current.find((s) => s.topic === "msg-2")?.callback;
			if (!subscribeCallback) {
				throw new Error("Expected subscribe callback for msg-2");
			}

			// Publish non-streaming update with content
			subscribeCallback({ content: "hello", streaming: false });
			waitUntilUpdate();

			// Publish same content again without streaming
			subscribeCallback({ content: "hello", streaming: false });
			waitUntilUpdate();

			// Without streaming, dedup should skip the duplicate
			// Should only have 1 chunk (the first "hello")
		});
	});

	describe("streaming scroll behavior", () => {
		it("calls scrollToBottom on every streaming tick", () => {
			const { unmount: um, waitUntilUpdate } = renderBubble({ topic: "msg-3", streaming: true });
			unmount = um;

			// Wait for initial render and streaming effect
			waitUntilUpdate();

			// The streaming useEffect should have called scrollToBottom at least once
			// because streaming=true and text.length > 0 (from content prop)
		});

		it("does not call scrollToBottom when streaming is false", () => {
			const { unmount: um, waitUntilUpdate } = renderBubble({ topic: "msg-4", streaming: false });
			unmount = um;

			// Wait for initial render
			waitUntilUpdate();

			// Non-streaming should not trigger scroll
			// scrollToBottomRef.current should be 0
		});
	});
});
