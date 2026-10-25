import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { openPage } from "../../../src/tools/browser/browser.js";

const makeBrowser = () => {
	const calls = { viewport: null };
	const page = {
		setDefaultNavigationTimeout() {},
		setDefaultTimeout() {},
		setViewport: async (v) => {
			calls.viewport = v;
		},
	};
	return { browser: { newPage: async () => page }, calls };
};

describe("openPage", () => {
	it("sets the viewport when one is provided", async () => {
		const { browser, calls } = makeBrowser();
		await openPage(browser, 1000, { width: 1920, height: 1080 });
		assert.deepStrictEqual(calls.viewport, { width: 1920, height: 1080 });
	});

	it("leaves the default viewport when none is provided", async () => {
		const { browser, calls } = makeBrowser();
		await openPage(browser, 1000);
		assert.strictEqual(calls.viewport, null);
	});
});
