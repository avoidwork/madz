/**
 * Tests for the messages module.
 * @see {@link src/tui/messages.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { getRoleLabel } from "../../../src/tui/messages.js";

describe("getRoleLabel", () => {
	it("returns 'You' for user role", () => {
		assert.strictEqual(getRoleLabel("user"), "You");
	});

	it("returns 'Assistant' for assistant role", () => {
		assert.strictEqual(getRoleLabel("assistant"), "Assistant");
	});

	it("returns custom name for assistant role", () => {
		assert.strictEqual(getRoleLabel("assistant", "Mads"), "Mads");
	});

	it("returns 'System' for system role", () => {
		assert.strictEqual(getRoleLabel("system"), "System");
	});

	it("returns role string for unknown role", () => {
		assert.strictEqual(getRoleLabel("tool"), "tool");
	});

	it("returns 'Unknown' for falsy role", () => {
		assert.strictEqual(getRoleLabel(""), "Unknown");
	});
});
