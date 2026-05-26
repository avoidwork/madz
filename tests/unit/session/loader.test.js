import { describe, it } from "node:test";
import assert from "node:assert";
import { listThreadIds } from "../../../src/session/loader.js";

describe("listThreadIds", () => {
	it("returns empty array for a saver with no checkpoints", async () => {
		const mockSaver = {
			list: () => ({ [Symbol.asyncIterator]: () => iter([]) }),
		};
		const result = await listThreadIds(mockSaver);
		assert.deepStrictEqual(result, []);
	});

	it("returns unique thread IDs", async () => {
		const items = [
			{ config: { configurable: { thread_id: "aaa" } } },
			{ config: { configurable: { thread_id: "bbb" } } },
			{ config: { configurable: { thread_id: "aaa" } } },
			{ config: { configurable: { thread_id: "ccc" } } },
		];
		const mockSaver = {
			list: () => ({ [Symbol.asyncIterator]: () => iter(items) }),
		};
		const result = await listThreadIds(mockSaver);
		assert.strictEqual(result.length, 3);
		assert.ok(result.includes("aaa"));
		assert.ok(result.includes("bbb"));
		assert.ok(result.includes("ccc"));
	});

	it("skips entries without thread_id", async () => {
		const items = [
			{ config: { configurable: { thread_id: "1" } } },
			{ config: { configurable: {} } },
			{},
			{ config: null },
			{ config: { configurable: { thread_id: "2" } } },
		];
		const mockSaver = {
			list: () => ({ [Symbol.asyncIterator]: () => iter(items) }),
		};
		const result = await listThreadIds(mockSaver);
		assert.strictEqual(result.length, 2);
		assert.ok(result.includes("1"));
		assert.ok(result.includes("2"));
	});

	it("handles errors on list gracefully", async () => {
		const mockSaver = {
			list: () => {
				throw new Error("DB not ready");
			},
		};
		const result = await listThreadIds(mockSaver);
		assert.deepStrictEqual(result, []);
	});

	/**
	 * Helper to create an async iterable from an array.
	 * @param {unknown[]} items
	 * @returns {AsyncIterable<unknown>}
	 */
	function iter(items) {
		let i = 0;
		return {
			next() {
				if (i < items.length) {
					return Promise.resolve({ value: items[i++], done: false });
				}
				return Promise.resolve({ done: true });
			},
		};
	}
});
