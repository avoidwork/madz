/**
 * Integration test for the VirtualScrollView.
 * Confirms that only the windowed subset of items is mounted (via a mount
 * counter), rather than the entire item list.
 * @see {@link src/tui/scrollView.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import React from "react";
import { renderToString, Text } from "ink";
import { VirtualScrollView } from "../../src/tui/scrollView.js";

describe("VirtualScrollView — windowed mounting", () => {
	it("mounts only the visible window plus overscan, not all items", () => {
		let mountCount = 0;
		const items = Array.from({ length: 100 }, (_, i) => ({
			id: `msg-${i}`,
			data: { role: "user", content: `msg ${i}` },
		}));

		renderToString(
			React.createElement(VirtualScrollView, {
				items,
				height: 10,
				overscan: 2,
				estimateHeight: () => 3,
				renderItem: (item) => {
					mountCount++;
					return React.createElement(Text, null, item.id);
				},
				onContentHeightChange: () => {},
				onScroll: () => {},
			}),
		);

		// Viewport 10 rows, each item 3 rows → ~4 items visible. With overscan 2
		// on each side, the mounted set is bounded well below the full 100 items.
		assert.ok(mountCount < 100, `expected windowed mount, got ${mountCount}`);
		assert.ok(mountCount > 0, "expected at least one item mounted");
		assert.ok(mountCount <= 10, `expected bounded mount, got ${mountCount}`);
	});

	it("mounts all items when the total content fits in the viewport", () => {
		let mountCount = 0;
		const items = Array.from({ length: 3 }, (_, i) => ({
			id: `msg-${i}`,
			data: { role: "user", content: `msg ${i}` },
		}));

		renderToString(
			React.createElement(VirtualScrollView, {
				items,
				height: 20,
				overscan: 2,
				estimateHeight: () => 3,
				renderItem: (item) => {
					mountCount++;
					return React.createElement(Text, null, item.id);
				},
				onContentHeightChange: () => {},
				onScroll: () => {},
			}),
		);

		assert.strictEqual(mountCount, 3);
	});

	it("mounts nothing for an empty item list", () => {
		let mountCount = 0;
		renderToString(
			React.createElement(VirtualScrollView, {
				items: [],
				height: 10,
				overscan: 2,
				estimateHeight: () => 3,
				renderItem: (item) => {
					mountCount++;
					return React.createElement(Text, null, item.id);
				},
				onContentHeightChange: () => {},
				onScroll: () => {},
			}),
		);

		assert.strictEqual(mountCount, 0);
	});

	it("mounts a single short message", () => {
		let mountCount = 0;
		const items = [{ id: "msg-0", data: { role: "user", content: "hi" } }];

		renderToString(
			React.createElement(VirtualScrollView, {
				items,
				height: 10,
				overscan: 2,
				estimateHeight: () => 1,
				renderItem: (item) => {
					mountCount++;
					return React.createElement(Text, null, item.id);
				},
				onContentHeightChange: () => {},
				onScroll: () => {},
			}),
		);

		assert.strictEqual(mountCount, 1);
	});
});
