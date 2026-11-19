import { describe, it } from "node:test";
import assert from "node:assert";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { getEffectiveMessages } from "../../src/agent/effectiveMessages.js";

describe("getEffectiveMessages", () => {
	const messages = ["a", "b", "c", "d", "e"].map((t, i) =>
		i % 2 ? new AIMessage(t) : new HumanMessage(t),
	);

	it("returns the full history when no summarization event exists", () => {
		assert.deepStrictEqual(getEffectiveMessages({ messages }), messages);
	});

	it("returns [summary, ...messages after cutoff] when an event exists", () => {
		const summaryMessage = new HumanMessage("summary");
		const result = getEffectiveMessages({
			messages,
			_summarizationEvent: { cutoffIndex: 3, summaryMessage, filePath: null },
		});
		assert.strictEqual(result.length, 3);
		assert.strictEqual(result[0], summaryMessage);
		assert.strictEqual(result[1], messages[3]);
		assert.strictEqual(result[2], messages[4]);
	});

	it("handles missing values", () => {
		assert.deepStrictEqual(getEffectiveMessages(undefined), []);
	});
});
