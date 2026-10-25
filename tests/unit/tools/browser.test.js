import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { browserImpl, resetBrowser } from "../../../src/tools/browser/index.js";

let page;
let calls;

const makePage = () => {
	calls = {
		goto: null,
		click: null,
		type: null,
		press: null,
		screenshot: null,
		evaluate: null,
		waitForSelector: null,
		$eval: null,
	};
	page = {
		setDefaultNavigationTimeout() {},
		setDefaultTimeout() {},
		goto: async (url, opts) => {
			calls.goto = { url, opts };
		},
		click: async (selector) => {
			calls.click = selector;
		},
		type: async (selector, text) => {
			calls.type = { selector, text };
		},
		keyboard: {
			press: async (key) => {
				calls.press = key;
			},
		},
		screenshot: async (opts) => {
			calls.screenshot = opts;
			return "base64image";
		},
		evaluate: async (expr) => {
			calls.evaluate = expr;
			return "evaluated";
		},
		waitForSelector: async (selector, opts) => {
			calls.waitForSelector = { selector, opts };
		},
		$eval: async (selector) => {
			calls.$eval = selector;
			return "scoped text";
		},
		close: async () => {},
	};
};

const makeOptions = () => {
	makePage();
	const browser = { newPage: async () => page, close: async () => {} };
	return {
		options: {
			launchBrowser: async () => browser,
			openPage: async () => page,
		},
	};
};

beforeEach(() => {
	resetBrowser();
});

describe("browserImpl - navigate", () => {
	it("navigates to a valid URL", async () => {
		const { options } = makeOptions();
		const result = await browserImpl({ action: "navigate", url: "https://example.com" }, options);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.url, "https://example.com");
		assert.strictEqual(calls.goto.url, "https://example.com");
	});

	it("rejects a URL blocked by filterUrl", async () => {
		const { options } = makeOptions();
		const result = await browserImpl({ action: "navigate", url: "http://127.0.0.1" }, options);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.match(parsed.error, /URL rejected/);
	});
});

describe("browserImpl - click", () => {
	it("clicks a selector", async () => {
		const { options } = makeOptions();
		const result = await browserImpl({ action: "click", selector: "#submit" }, options);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(calls.click, "#submit");
	});
});

describe("browserImpl - type/fill", () => {
	it("types text into a selector", async () => {
		const { options } = makeOptions();
		const result = await browserImpl({ action: "type", selector: "#name", text: "Jason" }, options);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.deepStrictEqual(calls.type, { selector: "#name", text: "Jason" });
	});

	it("fills text into a selector", async () => {
		const { options } = makeOptions();
		const result = await browserImpl({ action: "fill", selector: "#name", text: "Jason" }, options);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.deepStrictEqual(calls.type, { selector: "#name", text: "Jason" });
	});
});

describe("browserImpl - press", () => {
	it("presses a key", async () => {
		const { options } = makeOptions();
		const result = await browserImpl({ action: "press", key: "Enter" }, options);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(calls.press, "Enter");
	});
});

describe("browserImpl - screenshot", () => {
	it("returns a base64 image", async () => {
		const { options } = makeOptions();
		const result = await browserImpl({ action: "screenshot" }, options);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.image, "base64image");
		assert.deepStrictEqual(calls.screenshot, { fullPage: false, encoding: "base64" });
	});
});

describe("browserImpl - extract", () => {
	it("extracts page text without a selector", async () => {
		const { options } = makeOptions();
		const result = await browserImpl({ action: "extract" }, options);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.content, "evaluated");
	});

	it("extracts scoped text with a selector", async () => {
		const { options } = makeOptions();
		const result = await browserImpl({ action: "extract", selector: "#main" }, options);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.content, "scoped text");
	});
});

describe("browserImpl - waitFor", () => {
	it("waits for a selector", async () => {
		const { options } = makeOptions();
		const result = await browserImpl({ action: "waitFor", selector: "#loaded" }, options);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(calls.waitForSelector.selector, "#loaded");
	});
});

describe("browserImpl - evaluate", () => {
	it("evaluates a JS expression", async () => {
		const { options } = makeOptions();
		const result = await browserImpl({ action: "evaluate", expression: "1 + 1" }, options);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.result, "evaluated");
		assert.strictEqual(calls.evaluate, "1 + 1");
	});
});

describe("browserImpl - close", () => {
	it("closes the persistent browser", async () => {
		const { options } = makeOptions();
		await browserImpl({ action: "navigate", url: "https://example.com" }, options);
		const result = await browserImpl({ action: "close" }, options);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
	});
});

describe("browserImpl - errors", () => {
	it("returns an error when the browser launch fails", async () => {
		const options = {
			launchBrowser: async () => {
				throw new Error("launch failed");
			},
		};
		const result = await browserImpl({ action: "navigate", url: "https://example.com" }, options);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.match(parsed.error, /launch failed/);
	});

	it("returns an error when an action throws", async () => {
		const { options } = makeOptions();
		options.openPage = async () => ({
			setDefaultNavigationTimeout() {},
			setDefaultTimeout() {},
			click: async () => {
				throw new Error("selector not found");
			},
		});
		const result = await browserImpl({ action: "click", selector: "#missing" }, options);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.match(parsed.error, /selector not found/);
	});
});
