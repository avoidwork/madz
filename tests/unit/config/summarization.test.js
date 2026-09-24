import { test, describe } from "node:test";
import assert from "node:assert";
import { SummarizationSchema } from "../../../src/config/schemas/summarization.js";

describe("SummarizationSchema", () => {
	describe("defaults", () => {
		test("absent section parses to documented defaults (enabled false)", () => {
			const result = SummarizationSchema.parse({});
			assert.strictEqual(result.enabled, false);
			assert.strictEqual(result.trigger, undefined);
			assert.strictEqual(result.keep, undefined);
		});

		test("empty object parses to enabled false", () => {
			const result = SummarizationSchema.parse({ enabled: false });
			assert.strictEqual(result.enabled, false);
		});
	});

	describe("trigger types", () => {
		test("accepts a tokens trigger with a positive integer value", () => {
			const result = SummarizationSchema.parse({
				enabled: true,
				trigger: { type: "tokens", value: 28000 },
				keep: { type: "messages", value: 10 },
			});
			assert.strictEqual(result.trigger.type, "tokens");
			assert.strictEqual(result.trigger.value, 28000);
		});

		test("accepts a messages trigger with a positive integer value", () => {
			const result = SummarizationSchema.parse({
				enabled: true,
				trigger: { type: "messages", value: 20 },
				keep: { type: "messages", value: 6 },
			});
			assert.strictEqual(result.trigger.type, "messages");
			assert.strictEqual(result.trigger.value, 20);
		});

		test("accepts a fraction trigger with a value between 0 and 1", () => {
			const result = SummarizationSchema.parse({
				enabled: true,
				trigger: { type: "fraction", value: 0.85 },
				keep: { type: "fraction", value: 0.1 },
			});
			assert.strictEqual(result.trigger.type, "fraction");
			assert.strictEqual(result.trigger.value, 0.85);
		});
	});

	describe("rejection", () => {
		test("rejects a zero token trigger value", () => {
			const result = SummarizationSchema.safeParse({
				enabled: true,
				trigger: { type: "tokens", value: 0 },
			});
			assert.strictEqual(result.success, false);
		});

		test("rejects a negative messages trigger value", () => {
			const result = SummarizationSchema.safeParse({
				enabled: true,
				trigger: { type: "messages", value: -1 },
			});
			assert.strictEqual(result.success, false);
		});

		test("rejects a fraction trigger above 1", () => {
			const result = SummarizationSchema.safeParse({
				enabled: true,
				trigger: { type: "fraction", value: 1.5 },
			});
			assert.strictEqual(result.success, false);
		});

		test("rejects a non-integer token trigger value", () => {
			const result = SummarizationSchema.safeParse({
				enabled: true,
				trigger: { type: "tokens", value: 1.5 },
			});
			assert.strictEqual(result.success, false);
		});

		test("rejects a wrong-typed trigger value", () => {
			const result = SummarizationSchema.safeParse({
				enabled: true,
				trigger: { type: "tokens", value: "abc" },
			});
			assert.strictEqual(result.success, false);
		});

		test("rejects an unknown trigger type", () => {
			const result = SummarizationSchema.safeParse({
				enabled: true,
				trigger: { type: "bytes", value: 100 },
			});
			assert.strictEqual(result.success, false);
		});

		test("rejects unknown keys in the section", () => {
			const result = SummarizationSchema.safeParse({
				enabled: true,
				foo: 1,
			});
			assert.strictEqual(result.success, false);
		});
	});

	describe("historyPathPrefix", () => {
		test("accepts an optional historyPathPrefix", () => {
			const result = SummarizationSchema.parse({
				enabled: true,
				trigger: { type: "tokens", value: 28000 },
				keep: { type: "messages", value: 10 },
				historyPathPrefix: "/conversation_history",
			});
			assert.strictEqual(result.historyPathPrefix, "/conversation_history");
		});
	});
});
