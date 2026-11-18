import { test, describe } from "node:test";
import assert from "node:assert";
import { SummarizationSchema } from "../../../src/config/schemas/summarization.js";

describe("SummarizationSchema", () => {
	describe("defaults", () => {
		test("absent section parses to documented defaults", () => {
			const result = SummarizationSchema.parse({});
			assert.strictEqual(result.keepMessages, undefined);
			assert.strictEqual(result.contextFraction, 0.8);
		});
	});

	describe("rejection", () => {
		test("rejects unknown keys in the section", () => {
			assert.strictEqual(SummarizationSchema.safeParse({ foo: 1 }).success, false);
		});

		test("rejects the removed middleware keys", () => {
			assert.strictEqual(SummarizationSchema.safeParse({ enabled: true }).success, false);
			assert.strictEqual(
				SummarizationSchema.safeParse({ trigger: { type: "tokens", value: 1000 } }).success,
				false,
			);
			assert.strictEqual(
				SummarizationSchema.safeParse({ keep: { type: "messages", value: 5 } }).success,
				false,
			);
		});
	});

	describe("contextFraction", () => {
		test("accepts values in (0, 1]", () => {
			assert.strictEqual(SummarizationSchema.parse({ contextFraction: 0.5 }).contextFraction, 0.5);
			assert.strictEqual(SummarizationSchema.parse({ contextFraction: 1 }).contextFraction, 1);
		});

		test("rejects zero and values above 1", () => {
			assert.throws(() => SummarizationSchema.parse({ contextFraction: 0 }));
			assert.throws(() => SummarizationSchema.parse({ contextFraction: 1.5 }));
		});
	});

	describe("keepMessages", () => {
		test("is optional and unset by default", () => {
			assert.strictEqual(SummarizationSchema.parse({}).keepMessages, undefined);
		});

		test("accepts zero and positive integers", () => {
			assert.strictEqual(SummarizationSchema.parse({ keepMessages: 0 }).keepMessages, 0);
			assert.strictEqual(SummarizationSchema.parse({ keepMessages: 5 }).keepMessages, 5);
		});

		test("rejects negative and non-integer values", () => {
			assert.throws(() => SummarizationSchema.parse({ keepMessages: -1 }));
			assert.throws(() => SummarizationSchema.parse({ keepMessages: 2.5 }));
		});
	});
});
