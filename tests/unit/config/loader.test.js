import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";

describe("loadConfig key ordering", () => {
	let loader;

	beforeEach(async () => {
		loader = await import("../../../src/config/loader.js");
		loader._resetConfigCache();
	});

	afterEach(() => {
		loader._resetConfigCache();
	});

	it("returns top-level config keys in alphabetical order", () => {
		const config = loader.loadConfig();
		const keys = Object.keys(config);
		const sorted = [...keys].sort((a, b) => a.localeCompare(b));
		assert.deepStrictEqual(keys, sorted);
	});

	it("returns nested config keys in alphabetical order", () => {
		const config = loader.loadConfig();
		const assertSorted = (obj, path) => {
			if (!obj || typeof obj !== "object" || Array.isArray(obj)) return;
			const keys = Object.keys(obj);
			const sorted = [...keys].sort((a, b) => a.localeCompare(b));
			assert.deepStrictEqual(keys, sorted, `keys not sorted at ${path}`);
			for (const [key, value] of Object.entries(obj)) {
				assertSorted(value, `${path}.${key}`);
			}
		};
		assertSorted(config, "config");
	});
});
