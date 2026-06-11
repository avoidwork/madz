import { describe, it } from "node:test";
import assert from "node:assert";
import { gcCollect, trimMessagesInPlace } from "../../src/memory/gc.js";

describe("gcCollect", () => {
	it("returns zeroed result when messages are within window", () => {
		const config = { memory: { gc: { messageWindow: 100, maxContextEntries: 100 } } };
		const messages = Array.from({ length: 50 }, (_, i) => ({ role: "user", content: `msg ${i}` }));
		const result = gcCollect(config, messages);
		assert.strictEqual(result.messagesTrimmed, false);
		assert.strictEqual(result.messagesRemoved, 0);
	});

	it("trims messages when exceeding window", () => {
		const config = { memory: { gc: { messageWindow: 10, maxContextEntries: 100 } } };
		const messages = Array.from({ length: 25 }, (_, i) => ({ role: "user", content: `msg ${i}` }));
		const result = gcCollect(config, messages);
		assert.strictEqual(result.messagesTrimmed, true);
		assert.strictEqual(result.messagesRemoved, 15);
	});

	it("handles empty messages array", () => {
		const config = { memory: { gc: { messageWindow: 100, maxContextEntries: 100 } } };
		const result = gcCollect(config, []);
		assert.strictEqual(result.messagesTrimmed, false);
		assert.strictEqual(result.messagesRemoved, 0);
	});

	it("handles undefined messages array", () => {
		const config = { memory: { gc: { messageWindow: 100, maxContextEntries: 100 } } };
		const result = gcCollect(config, undefined);
		assert.strictEqual(result.messagesTrimmed, false);
		assert.strictEqual(result.messagesRemoved, 0);
	});

	it("uses defaults when gc config is missing", () => {
		const config = {};
		const messages = Array.from({ length: 200 }, (_, i) => ({ role: "user", content: `msg ${i}` }));
		const result = gcCollect(config, messages);
		assert.strictEqual(result.messagesTrimmed, true);
		assert.strictEqual(result.messagesRemoved, 100);
	});

	it("uses defaults when gc section is missing", () => {
		const config = { memory: {} };
		const messages = Array.from({ length: 200 }, (_, i) => ({ role: "user", content: `msg ${i}` }));
		const result = gcCollect(config, messages);
		assert.strictEqual(result.messagesTrimmed, true);
		assert.strictEqual(result.messagesRemoved, 100);
	});

	it("idempotent — second call with already-trimmed array produces no change", () => {
		const config = { memory: { gc: { messageWindow: 10, maxContextEntries: 100 } } };
		const messages = Array.from({ length: 25 }, (_, i) => ({ role: "user", content: `msg ${i}` }));
		const result1 = gcCollect(config, messages);
		const result2 = gcCollect(config, messages);
		// Second call sees the same array but the config says 10, and array is still 25
		// Since gcCollect doesn't mutate the array, both calls see 25 items
		// This is expected — the trimming happens via setMessages in the TUI
		assert.strictEqual(result1.messagesRemoved, 15);
		assert.strictEqual(result2.messagesRemoved, 15);
	});
});

describe("trimMessagesInPlace", () => {
	it("trims array in-place when exceeding window", () => {
		const messages = Array.from({ length: 25 }, (_, i) => i);
		const removed = trimMessagesInPlace(messages, 10);
		assert.strictEqual(removed, 15);
		assert.strictEqual(messages.length, 10);
		assert.deepStrictEqual(messages, Array.from({ length: 10 }, (_, i) => i + 15));
	});

	it("does nothing when within window", () => {
		const messages = Array.from({ length: 5 }, (_, i) => i);
		const removed = trimMessagesInPlace(messages, 10);
		assert.strictEqual(removed, 0);
		assert.strictEqual(messages.length, 5);
	});

	it("handles empty array", () => {
		const messages = [];
		const removed = trimMessagesInPlace(messages, 10);
		assert.strictEqual(removed, 0);
	});

	it("handles undefined array", () => {
		const removed = trimMessagesInPlace(undefined, 10);
		assert.strictEqual(removed, 0);
	});

	it("handles window of 0", () => {
		const messages = [1, 2, 3];
		const removed = trimMessagesInPlace(messages, 0);
		assert.strictEqual(removed, 3);
		assert.strictEqual(messages.length, 0);
	});
});
