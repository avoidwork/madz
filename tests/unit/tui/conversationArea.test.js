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

describe("countToolMessageTokens", () => {
	it("should return 0 for empty text", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		assert.strictEqual(await mod.countToolMessageTokens({}, ""), 0);
	});

	it("should return 0 when the model has no tokenizer", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		assert.strictEqual(await mod.countToolMessageTokens({}, "some tool text"), 0);
	});

	it("should count tokens via the model tokenizer", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		const model = {
			getNumTokensFromMessages: async (_messages) => ({ totalCount: 42 }),
		};
		assert.strictEqual(await mod.countToolMessageTokens(model, "tool output"), 42);
	});

	it("should return 0 when the model tokenizer returns no totalCount", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		const model = {
			getNumTokensFromMessages: async () => ({}),
		};
		assert.strictEqual(await mod.countToolMessageTokens(model, "tool output"), 0);
	});
});
