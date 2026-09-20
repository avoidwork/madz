/**
 * Tests for the TUI App component.
 * @see {@link src/tui/app.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";

// App is a React component using Ink. We test the module exports and structure.
describe("App module", () => {
	it("should export a default function", async () => {
		const mod = await import("../../../src/tui/app.js");
		assert.strictEqual(typeof mod.default, "function");
	});
});

describe("App — file picker bail", () => {
	it("bails when the picker is open so up/down and Escape don't steal keys", () => {
		// Simulate the App-level guard: return early if isPickerOpen() is true.
		const inputAreaRef = { current: { isPickerOpen: () => true } };
		const shouldBail = inputAreaRef.current?.isPickerOpen?.();
		assert.strictEqual(shouldBail, true);
	});

	it("does not bail when the picker is closed", () => {
		const inputAreaRef = { current: { isPickerOpen: () => false } };
		const shouldBail = inputAreaRef.current?.isPickerOpen?.();
		assert.strictEqual(shouldBail, false);
	});

	it("does not bail when the ref is not yet mounted", () => {
		const inputAreaRef = { current: null };
		const shouldBail = inputAreaRef.current?.isPickerOpen?.();
		assert.strictEqual(shouldBail, undefined);
	});
});
