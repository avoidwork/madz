import { describe, it } from "node:test";
import assert from "node:assert";
import { createSummarizationMiddlewareFromConfig } from "../../../src/provider/summarizationMiddleware.js";

describe("createSummarizationMiddlewareFromConfig", () => {
	it("returns null when config is absent", () => {
		assert.strictEqual(createSummarizationMiddlewareFromConfig({ backend: {} }), null);
	});

	it("returns null when enabled is false", () => {
		assert.strictEqual(
			createSummarizationMiddlewareFromConfig({ backend: {}, config: { enabled: false } }),
			null,
		);
	});

	it("returns null when enabled but missing trigger/keep", () => {
		assert.strictEqual(
			createSummarizationMiddlewareFromConfig({ backend: {}, config: { enabled: true } }),
			null,
		);
	});

	it("returns a middleware named SummarizationMiddleware when enabled", () => {
		const mw = createSummarizationMiddlewareFromConfig({
			backend: {},
			config: {
				enabled: true,
				trigger: { type: "tokens", value: 28000 },
				keep: { type: "messages", value: 10 },
			},
		});
		assert.ok(mw, "should return a middleware");
		assert.strictEqual(mw.name, "SummarizationMiddleware");
		assert.strictEqual(typeof mw.wrapModelCall, "function");
	});

	it("supports a messages trigger", () => {
		const mw = createSummarizationMiddlewareFromConfig({
			backend: {},
			config: {
				enabled: true,
				trigger: { type: "messages", value: 20 },
				keep: { type: "messages", value: 6 },
			},
		});
		assert.ok(mw, "should return a middleware");
		assert.strictEqual(mw.name, "SummarizationMiddleware");
	});

	it("supports a fraction trigger", () => {
		const mw = createSummarizationMiddlewareFromConfig({
			backend: {},
			config: {
				enabled: true,
				trigger: { type: "fraction", value: 0.85 },
				keep: { type: "fraction", value: 0.1 },
			},
		});
		assert.ok(mw, "should return a middleware");
		assert.strictEqual(mw.name, "SummarizationMiddleware");
	});
});
