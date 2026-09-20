/**
 * Tests for the ConversationArea component.
 * @see {@link src/tui/conversationArea.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";

describe("ConversationArea module", () => {
	it("should have a default export", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		assert.ok(mod.default);
	});
});

describe("shouldAutoContinue", () => {
	it("should return true when reasoning is present and no message", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		const segments = [{ type: "reasoning", content: "Thinking..." }];
		assert.strictEqual(mod.shouldAutoContinue(segments), true);
	});

	it("should return false when a message segment is present", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		const segments = [
			{ type: "reasoning", content: "Thinking..." },
			{ type: "message", content: "The answer is 42." },
		];
		assert.strictEqual(mod.shouldAutoContinue(segments), false);
	});

	it("should return false when only reasoning is absent", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		const segments = [{ type: "message", content: "Hello." }];
		assert.strictEqual(mod.shouldAutoContinue(segments), false);
	});

	it("should return false for empty or undefined segments", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		assert.strictEqual(mod.shouldAutoContinue([]), false);
		assert.strictEqual(mod.shouldAutoContinue(undefined), false);
	});

	it("should return false when no segments exist", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		assert.strictEqual(mod.shouldAutoContinue(null), false);
	});
});
