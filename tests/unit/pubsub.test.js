import { createPubSub } from "../../src/tui/messageBubble.js";
import { describe, it } from "node:test";
import assert from "node:assert";

describe("pubsub - createPubSub", () => {
	it("subscribes and receives published messages", () => {
		const { subscribe, publish } = createPubSub();
		let received = null;
		subscribe("test", (data) => {
			received = data;
		});
		publish("test", { hello: "world" });
		assert.deepStrictEqual(received, { hello: "world" });
	});

	it("invokes all subscribers for a topic", () => {
		const { subscribe, publish } = createPubSub();
		let calls = [];
		subscribe("a", (d) => calls.push(d));
		subscribe("a", (d) => calls.push(d * 2));
		publish("a", 5);
		assert.deepStrictEqual(calls, [5, 10]);
	});

	it("returns subscribe count from publish", () => {
		const pubsub = createPubSub();
		pubsub.subscribe("x", () => {});
		pubsub.subscribe("x", () => {});
		const count = pubsub.publish("x", 1);
		assert.strictEqual(count, 2);
	});

	it("returns 0 when publishing to unknown topic", () => {
		const { publish } = createPubSub();
		assert.strictEqual(publish("nope", 1), 0);
	});

	it("unsubscribes callback correctly", () => {
		const { subscribe, unsubscribe, publish } = createPubSub();
		let count = 0;
		const cb = () => count++;
		subscribe("unsub-test", cb);
		publish("unsub-test", 1);
		assert.strictEqual(count, 1);

		unsubscribe("unsub-test", cb);
		publish("unsub-test", 2);
		assert.strictEqual(count, 1);
	});

	it("unsubscribe() returns an unsubscribe function", () => {
		const { subscribe, publish } = createPubSub();
		let count = 0;
		const cb = () => count++;
		const sub = subscribe("fn-test", cb);
		publish("fn-test", 1);
		assert.strictEqual(count, 1);

		sub(); // call the returned function
		publish("fn-test", 2);
		assert.strictEqual(count, 1);
	});

	it("does not duplicate callbacks on repeated subscribe", () => {
		const { subscribe, getSubscribers } = createPubSub();
		const cb = () => {};
		subscribe("dup", cb);
		subscribe("dup", cb);
		subscribe("dup", cb);
		assert.strictEqual(getSubscribers("dup").length, 1);
	});

	it("supports multiple independent topics", () => {
		const { subscribe, publish } = createPubSub();
		let a = 0,
			b = 0;
		subscribe("topic-a", () => a++);
		subscribe("topic-b", () => b++);
		publish("topic-a", 1);
		assert.strictEqual(a, 1);
		assert.strictEqual(b, 0);
		publish("topic-b", 2);
		assert.strictEqual(a, 1);
		assert.strictEqual(b, 1);
	});

	it("handles publish with undefined data", () => {
		const { subscribe, publish } = createPubSub();
		let received;
		subscribe("undef", (d) => {
			received = d;
		});
		publish("undef", undefined);
		assert.strictEqual(received, undefined);
	});

	it("handles publish with null data", () => {
		const { subscribe, publish } = createPubSub();
		let received;
		subscribe("null-data", (d) => {
			received = d;
		});
		publish("null-data", null);
		assert.strictEqual(received, null);
	});

	it("getSubscribers returns empty array for unknown topic", () => {
		const { getSubscribers } = createPubSub();
		assert.deepStrictEqual(getSubscribers("nonexistent"), []);
	});

	it("creates independent pubsub instances", () => {
		const ps1 = createPubSub();
		const ps2 = createPubSub();
		let called = false;
		ps1.subscribe("isolated", () => {
			called = true;
		});
		ps2.publish("isolated", 1);
		assert.strictEqual(called, false);
	});
});
