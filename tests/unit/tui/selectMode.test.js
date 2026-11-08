/**
 * Unit tests for select-mode helpers (Tab toggle, printable-key exit,
 * per-mode key routing, mouse gate).
 * @module tests/unit/tui/selectMode.test
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import {
	isPrintableKey,
	routeNavKey,
	isMouseEnabled,
	shouldHandleClick,
} from "../../../src/tui/selectMode.js";

describe("isPrintableKey", () => {
	it("accepts plain characters and pasted text", () => {
		assert.strictEqual(isPrintableKey("a", {}), true);
		assert.strictEqual(isPrintableKey("hello world", {}), true);
		assert.strictEqual(isPrintableKey("é", {}), true);
	});

	it("rejects empty and non-string input", () => {
		assert.strictEqual(isPrintableKey("", {}), false);
		assert.strictEqual(isPrintableKey(undefined, {}), false);
	});

	it("rejects chords and special keys", () => {
		for (const flag of [
			"ctrl",
			"meta",
			"escape",
			"return",
			"tab",
			"upArrow",
			"downArrow",
			"leftArrow",
			"rightArrow",
			"pageUp",
			"pageDown",
			"home",
			"end",
			"backspace",
			"delete",
		]) {
			assert.strictEqual(isPrintableKey("x", { [flag]: true }), false, flag);
		}
	});

	it("rejects control characters and leftover mouse sequences", () => {
		assert.strictEqual(isPrintableKey("\t", {}), false);
		assert.strictEqual(isPrintableKey("\r", {}), false);
		assert.strictEqual(isPrintableKey("[<64;10;5M", {}), false);
		assert.strictEqual(isPrintableKey("[<0;3;4m", {}), false);
	});

	it("accepts text that merely contains brackets", () => {
		assert.strictEqual(isPrintableKey("[<a>]", {}), true);
	});

	it("defaults key to an empty object", () => {
		assert.strictEqual(isPrintableKey("a"), true);
	});
});

describe("routeNavKey", () => {
	it("default mode: Up/Down browse history", () => {
		assert.deepStrictEqual(routeNavKey(false, { upArrow: true }), {
			type: "history",
			direction: "up",
		});
		assert.deepStrictEqual(routeNavKey(false, { downArrow: true }), {
			type: "history",
			direction: "down",
		});
	});

	it("default mode: PageUp/PageDown scroll a page", () => {
		assert.deepStrictEqual(routeNavKey(false, { pageUp: true }), {
			type: "scroll",
			unit: "page",
			direction: -1,
		});
		assert.deepStrictEqual(routeNavKey(false, { pageDown: true }), {
			type: "scroll",
			unit: "page",
			direction: 1,
		});
	});

	it("select mode: all four keys scroll", () => {
		assert.deepStrictEqual(routeNavKey(true, { upArrow: true }), {
			type: "scroll",
			unit: "line",
			direction: -1,
		});
		assert.deepStrictEqual(routeNavKey(true, { downArrow: true }), {
			type: "scroll",
			unit: "line",
			direction: 1,
		});
		assert.strictEqual(routeNavKey(true, { pageUp: true }).unit, "page");
		assert.strictEqual(routeNavKey(true, { pageDown: true }).direction, 1);
	});

	it("returns null for other keys", () => {
		assert.strictEqual(routeNavKey(false, {}), null);
		assert.strictEqual(routeNavKey(true, { leftArrow: true }), null);
		assert.strictEqual(routeNavKey(true), null);
	});
});

describe("mouse gate", () => {
	it("is on by default and off in select mode", () => {
		assert.strictEqual(isMouseEnabled(false), true);
		assert.strictEqual(isMouseEnabled(true), false);
	});

	it("Tab toggle flips the gate and a second Tab restores it", () => {
		let selectMode = false;
		selectMode = !selectMode;
		assert.strictEqual(isMouseEnabled(selectMode), false);
		selectMode = !selectMode;
		assert.strictEqual(isMouseEnabled(selectMode), true);
	});

	it("click handling requires default mode and the conversation view", () => {
		assert.strictEqual(shouldHandleClick(false, true), true);
		assert.strictEqual(shouldHandleClick(true, true), false);
		assert.strictEqual(shouldHandleClick(false, false), false);
		assert.strictEqual(shouldHandleClick(true, false), false);
	});
});
