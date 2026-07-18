import { createPubSub } from "../../src/tui/messageBubble.js";
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";

/**
 * Simulates the imperative API used by MessageList without React.
 * Tests the addMessage, updateMessage, clear, setMessages workflow
 * including pub/sub topic management.
 */
describe("messageList imperative API simulation", () => {
	let pubsub;
	let idsRef;
	let idToIdxRef;
	let dataRef;
	let _lastMsgCountRef;

	function reset() {
		pubsub = createPubSub();
		idsRef = [];
		idToIdxRef = new Map();
		dataRef = new Map();
		_lastMsgCountRef = 0;
	}

	beforeEach(reset);

	function addMessage(role, content, options = {}) {
		const id = (++global._msgIdCounter || (global._msgIdCounter = 0)).toString();
		dataRef.set(id, {
			id,
			role,
			content: content || "",
			time: options.time,
			reasoningContent: options.reasoningContent,
			activeToolCall: options.activeToolCall,
			toolCallDisplay: options.toolCallDisplay,
			streaming: options.streaming || false,
		});
		idsRef.push(id);
		idToIdxRef.set(id, idsRef.length - 1);
		return id;
	}

	function updateMessage(id, updates) {
		const idx = idToIdxRef.get(id);
		if (idx === undefined) return;
		const existing = dataRef.get(id);
		if (existing) {
			dataRef.set(id, { ...existing, ...updates });
		}
		idsRef[idx] = id;
		// Publish to topic for the bubble to receive streaming update
		pubsub.publish(`msg-${id}`, dataRef.get(id));
	}

	function clearMessages() {
		idsRef = [];
		idToIdxRef = new Map();
		dataRef = new Map();
		_lastMsgCountRef = 0;
	}

	/**
	 * Simulates what a MessageBubble does when it receives a pub/sub update:
	 * append new content to chunks array.
	 * Returns a promise that resolves when the next pub/sub update arrives on topic.
	 */
	function simulateBubbleUpdate(pubsubTopic) {
		return new Promise((resolve) => {
			const chunks = [];
			pubsub.subscribe(pubsubTopic, (msg) => {
				chunks.push(msg?.content ?? "");
				resolve(chunks);
			});
		});
	}

	/**
	 * Simulates what a MessageBubble does when it receives sequential pub/sub updates:
	 * append new content to chunks array, deduplicating duplicates.
	 * Returns a promise that resolves after a tick (pubsub is synchronous, so microtask needed).
	 */
	function simulateBubbleStreaming(pubsubTopic) {
		return new Promise((resolve) => {
			const chunks = [];
			pubsub.subscribe(pubsubTopic, (msg) => {
				const content = msg?.content ?? "";
				if (chunks.length > 0 && chunks[chunks.length - 1] === content) return;
				chunks.push(content);
			});
			// pubsub is synchronous; wait one tick for all updates to complete
			setTimeout(() => resolve(chunks), 0);
		});
	}

	it("addMessage creates message in data store", () => {
		const id = addMessage("user", "hello");
		assert.ok(id);
		assert.strictEqual(dataRef.get(id).content, "hello");
		assert.strictEqual(dataRef.get(id).role, "user");
	});

	it("addMessage returns unique IDs", () => {
		const id1 = addMessage("user", "a");
		const id2 = addMessage("user", "b");
		assert.notStrictEqual(id1, id2);
		assert.strictEqual(idsRef.length, 2);
	});

	it("updateMessage pub/sub triggers bubble callbacks", async () => {
		const id = addMessage("assistant", "initial");
		const topic = `msg-${id}`;

		const updatePromise = simulateBubbleUpdate(topic);
		updateMessage(id, { content: "streamed!" });
		const chunks = await updatePromise;
		assert.deepStrictEqual(chunks, ["streamed!"]);
	});

	it("updateMessage with streaming publishes correct data", async () => {
		const id = addMessage("assistant", "waiting");
		const topic = `msg-${id}`;

		const chunksPromise = simulateBubbleStreaming(topic);
		const contentOrder = ["h", "he", "hel", "hell", "hello"];
		for (let i = 0; i < 5; i++) {
			updateMessage(id, { content: contentOrder[i] });
		}
		const chunks = await chunksPromise;
		assert.deepStrictEqual(chunks, contentOrder);
	});

	it("updateMessage deduplicates identical content chunks", async () => {
		const id = addMessage("assistant", "start");
		const topic = `msg-${id}`;

		const chunksPromise = simulateBubbleStreaming(topic);
		for (let i = 0; i < 3; i++) {
			updateMessage(id, { content: "same" });
		}
		const chunks = await chunksPromise;
		assert.deepStrictEqual(chunks, ["same"]);
	});

	it("clearMessage removes all messages", () => {
		addMessage("user", "a");
		addMessage("assistant", "b");
		assert.strictEqual(idsRef.length, 2);
		clearMessages();
		assert.strictEqual(idsRef.length, 0);
		assert.strictEqual(idToIdxRef.size, 0);
		assert.strictEqual(dataRef.size, 0);
	});

	it("updateMessage on unknown id does nothing", () => {
		updateMessage("nonexistent", { content: "nope" });
		assert.strictEqual(idsRef.length, 0);
	});

	it("pubsub topics are scoped per message", () => {
		const id1 = addMessage("user", "msg1");
		const id2 = addMessage("user", "msg2");

		let msg1Data = null;
		let msg2Data = null;

		pubsub.subscribe(`msg-${id1}`, (d) => {
			msg1Data = d;
		});
		pubsub.subscribe(`msg-${id2}`, (d) => {
			msg2Data = d;
		});

		updateMessage(id2, { content: "only msg2" });

		assert.strictEqual(msg1Data, null);
		assert.ok(msg2Data);
		assert.strictEqual(msg2Data.content, "only msg2");
	});

	it("pubsub with undefined content sets empty string in bubble", async () => {
		const id = addMessage("assistant", "start");
		const topic = `msg-${id}`;

		const chunksPromise = simulateBubbleUpdate(topic);
		updateMessage(id, { content: undefined });
		const chunks = await chunksPromise;
		assert.deepStrictEqual(chunks, [""]);
	});

	it("pubsub with null content sets empty string in bubble", async () => {
		const id = addMessage("assistant", "start");
		const topic = `msg-${id}`;

		const chunksPromise = simulateBubbleUpdate(topic);
		updateMessage(id, { content: null });
		const chunks = await chunksPromise;
		assert.deepStrictEqual(chunks, [""]);
	});

	it("handles rapid sequential updates (streaming pattern)", async () => {
		const id = addMessage("assistant", "typing...");
		const topic = `msg-${id}`;

		const streamPromise = simulateBubbleStreaming(topic);
		const contentOrder = ["W", "We", "Wel", "Hell"];
		updateMessage(id, { content: contentOrder[0] });
		updateMessage(id, { content: contentOrder[1] });
		updateMessage(id, { content: contentOrder[2] });
		updateMessage(id, { content: contentOrder[3] });
		const chunks = await streamPromise;
		assert.strictEqual(chunks.length, 4);
		assert.strictEqual(chunks.at(-1), "Hell");
	});
});
