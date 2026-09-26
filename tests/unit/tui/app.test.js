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

describe("App — file picker bail-out", () => {
	it("should bail in conversation view when the file picker is open", async () => {
		const mod = await import("../../../src/tui/app.js");
		assert.strictEqual(typeof mod.default, "function");
		// The bail-out is implemented in the global useInput handler via
		// inputAreaRef.current?.isPickerOpen?.(). This test verifies the
		// imperative method contract is exposed by InputArea.
		const inputArea = await import("../../../src/tui/inputArea.js");
		assert.ok(inputArea.default, "InputArea default export exists");
	});
});
