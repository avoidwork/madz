import { describe, it } from "node:test";
import assert from "node:assert";
import {
	isCancelledToolMessage,
	isCancelledToolEvent,
} from "../../../src/shared/cancelledToolMessage.js";

const CANCELLED =
	"Tool call read_file with id abc was cancelled - another message came in before it could be completed.";

describe("isCancelledToolMessage", () => {
	it("returns false for a normal tool message", () => {
		assert.strictEqual(isCancelledToolMessage({ status: "success", content: "ok" }), false);
	});
	it("returns true for the synthetic cancelled message", () => {
		assert.strictEqual(isCancelledToolMessage({ status: "error", content: CANCELLED }), true);
	});
	it("returns false for a non-cancelled error", () => {
		assert.strictEqual(isCancelledToolMessage({ status: "error", content: "boom" }), false);
	});
	it("requires error status", () => {
		assert.strictEqual(isCancelledToolMessage({ status: "success", content: CANCELLED }), false);
	});
	it("handles content blocks and nullish input", () => {
		assert.strictEqual(
			isCancelledToolMessage({ status: "error", content: [{ type: "text", text: CANCELLED }] }),
			true,
		);
		assert.strictEqual(isCancelledToolMessage(null), false);
		assert.strictEqual(isCancelledToolMessage({ status: "error", content: 5 }), false);
	});
});

describe("isCancelledToolEvent", () => {
	it("matches text-only events and respects status when present", () => {
		assert.strictEqual(isCancelledToolEvent({ data: { text: CANCELLED } }), true);
		assert.strictEqual(isCancelledToolEvent({ text: CANCELLED, status: "error" }), true);
		assert.strictEqual(isCancelledToolEvent({ text: CANCELLED, status: "success" }), false);
		assert.strictEqual(isCancelledToolEvent({ text: "normal" }), false);
		assert.strictEqual(isCancelledToolEvent(undefined), false);
	});
});
