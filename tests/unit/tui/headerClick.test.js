import { describe, it } from "node:test";
import assert from "node:assert";
import {
	isCellInRect,
	applyScrollOffset,
	hitHeader,
	FULL_SCREEN_REF,
} from "../../../src/tui/headerClick.js";

/** Build a fake Ink node with a computed layout (no parent). */
function node(left, top, width, height) {
	return {
		parentNode: null,
		yogaNode: { getComputedLayout: () => ({ left, top, width, height }) },
	};
}

describe("headerClick", () => {
	describe("isCellInRect", () => {
		const rect = { left: 2, top: 3, right: 6, bottom: 4 };
		it("is inclusive of left/top and exclusive of right/bottom", () => {
			assert.strictEqual(isCellInRect(2, 3, rect), true);
			assert.strictEqual(isCellInRect(5, 3, rect), true);
			assert.strictEqual(isCellInRect(6, 3, rect), false);
			assert.strictEqual(isCellInRect(2, 4, rect), false);
		});
		it("returns false for a missing rect", () => {
			assert.strictEqual(isCellInRect(1, 1, undefined), false);
		});
	});

	describe("applyScrollOffset", () => {
		it("shifts a rect up by the scroll offset", () => {
			const r = applyScrollOffset({ left: 1, top: 10, right: 5, bottom: 11 }, 4);
			assert.deepStrictEqual(r, { left: 1, top: 6, right: 5, bottom: 7 });
		});
		it("defaults the offset to zero", () => {
			const r = { left: 1, top: 2, right: 3, bottom: 4 };
			assert.deepStrictEqual(applyScrollOffset(r), r);
		});
	});

	describe("hitHeader", () => {
		// Terminal coords are 1-indexed, so a node at layout (0,0) occupies (1,1).
		const headers = [
			{ kind: "reasoning", node: node(0, 0, 10, 1) },
			{ kind: "tool", node: node(0, 3, 10, 1) },
		];

		it("returns the kind of the clicked header", () => {
			assert.strictEqual(hitHeader({ x: 2, y: 1 }, headers), "reasoning");
			assert.strictEqual(hitHeader({ x: 2, y: 4 }, headers), "tool");
		});

		it("returns null for a click outside any header", () => {
			assert.strictEqual(hitHeader({ x: 2, y: 2 }, headers), null);
			assert.strictEqual(hitHeader({ x: 50, y: 1 }, headers), null);
		});

		it("compensates for the scroll offset", () => {
			assert.strictEqual(hitHeader({ x: 2, y: 1 }, headers, { offset: 3 }), "tool");
			assert.strictEqual(hitHeader({ x: 2, y: 4 }, headers, { offset: 3 }), null);
		});

		it("ignores clicks outside the visible viewport", () => {
			const viewport = { left: 1, top: 2, right: 20, bottom: 10 };
			assert.strictEqual(hitHeader({ x: 2, y: 1 }, headers, { viewport }), null);
			assert.strictEqual(hitHeader({ x: 2, y: 4 }, headers, { viewport }), "tool");
		});

		it("rejects invalid coordinates", () => {
			assert.strictEqual(hitHeader(null, headers), null);
			assert.strictEqual(hitHeader({ x: NaN, y: 1 }, headers), null);
		});

		it("skips headers whose node has no layout", () => {
			assert.strictEqual(hitHeader({ x: 1, y: 1 }, [{ kind: "tool", node: null }]), null);
		});
	});

	it("FULL_SCREEN_REF covers the whole terminal", () => {
		const layout = FULL_SCREEN_REF.current.yogaNode.getComputedLayout();
		assert.ok(layout.width > 1000 && layout.height > 1000);
	});
});
