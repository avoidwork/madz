import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { browserImpl, BrowserToolSchema } from "../../../src/tools/browser/index.js";

const makePage = (overrides = {}) => {
	const calls = { actions: [] };
	const page = {
		goto: async (url) => {
			calls.actions.push({ type: "goto", url });
		},
		click: async (selector) => {
			calls.actions.push({ type: "click", selector });
		},
		type: async (selector, text) => {
			calls.actions.push({ type: "type", selector, text });
		},
		$eval: async (selector, fn) => {
			calls.actions.push({ type: "$eval", selector });
			return fn({ value: "old" });
		},
		keyboard: {
			press: async (key) => {
				calls.actions.push({ type: "press", key });
			},
		},
		screenshot: async (opts) => {
			calls.actions.push({ type: "screenshot", opts });
			return "base64data";
		},
		evaluate: async (fn) => {
			calls.actions.push({ type: "evaluate" });
			return typeof fn === "function" ? fn() : "evaluated";
		},
		waitForSelector: async (selector) => {
			calls.actions.push({ type: "waitForSelector", selector });
		},
		waitForNetworkIdle: async (opts) => {
			calls.actions.push({ type: "waitForNetworkIdle", opts });
		},
		close: async () => {
			calls.actions.push({ type: "close" });
		},
		...overrides,
	};
	return { page, calls };
};

const makeBrowser = (page) => ({
	browser: { close: async () => {} },
	page,
});

const launch = async () => makeBrowser().browser;

describe("BrowserToolSchema", () => {
	it("accepts a navigate action", () => {
		const result = BrowserToolSchema.safeParse({ action: "navigate", url: "https://example.com" });
		assert.strictEqual(result.success, true);
	});

	it("accepts a click action", () => {
		const result = BrowserToolSchema.safeParse({ action: "click", selector: "#submit" });
		assert.strictEqual(result.success, true);
	});

	it("accepts a type action", () => {
		const result = BrowserToolSchema.safeParse({
			action: "type",
			selector: "#input",
			text: "hello",
		});
		assert.strictEqual(result.success, true);
	});

	it("accepts a fill action", () => {
		const result = BrowserToolSchema.safeParse({
			action: "fill",
			selector: "#input",
			text: "hello",
		});
		assert.strictEqual(result.success, true);
	});

	it("accepts a press action", () => {
		const result = BrowserToolSchema.safeParse({ action: "press", key: "Enter" });
		assert.strictEqual(result.success, true);
	});

	it("accepts a screenshot action", () => {
		const result = BrowserToolSchema.safeParse({ action: "screenshot" });
		assert.strictEqual(result.success, true);
	});

	it("accepts an extract action", () => {
		const result = BrowserToolSchema.safeParse({ action: "extract" });
		assert.strictEqual(result.success, true);
	});

	it("accepts a waitFor action with a selector", () => {
		const result = BrowserToolSchema.safeParse({ action: "waitFor", selector: "#content" });
		assert.strictEqual(result.success, true);
	});

	it("accepts a waitFor action with a waitUntil", () => {
		const result = BrowserToolSchema.safeParse({ action: "waitFor", waitUntil: "networkidle" });
		assert.strictEqual(result.success, true);
	});

	it("accepts an evaluate action", () => {
		const result = BrowserToolSchema.safeParse({ action: "evaluate", fn: "() => document.title" });
		assert.strictEqual(result.success, true);
	});

	it("rejects an unknown action", () => {
		const result = BrowserToolSchema.safeParse({ action: "unknown" });
		assert.strictEqual(result.success, false);
	});

	it("rejects a navigate action without a URL", () => {
		const result = BrowserToolSchema.safeParse({ action: "navigate" });
		assert.strictEqual(result.success, false);
	});

	it("rejects a click action without a selector", () => {
		const result = BrowserToolSchema.safeParse({ action: "click" });
		assert.strictEqual(result.success, false);
	});

	it("rejects a type action without text", () => {
		const result = BrowserToolSchema.safeParse({ action: "type", selector: "#input" });
		assert.strictEqual(result.success, false);
	});
});

describe("browserImpl", () => {
	it("returns an error for an invalid URL on navigate", async () => {
		const result = await browserImpl(
			{ action: "navigate", url: "file:///etc/passwd" },
			{ launchBrowser: launch },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.match(parsed.error, /URL rejected/);
	});

	it("returns an error for an internal host on navigate", async () => {
		const result = await browserImpl(
			{ action: "navigate", url: "http://127.0.0.1/" },
			{ launchBrowser: launch },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.match(parsed.error, /URL rejected/);
	});

	it("navigates to a valid URL", async () => {
		const { page, calls } = makePage();
		const result = await browserImpl(
			{ action: "navigate", url: "https://example.com" },
			{ launchBrowser: async () => ({ close: async () => {} }), openPage: async () => page },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.action, "navigate");
		assert.strictEqual(calls.actions[0].type, "goto");
		assert.strictEqual(calls.actions[0].url, "https://example.com");
	});

	it("clicks an element", async () => {
		const { page, calls } = makePage();
		const result = await browserImpl(
			{ action: "click", selector: "#submit" },
			{ launchBrowser: async () => ({ close: async () => {} }), openPage: async () => page },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(calls.actions[0].type, "click");
		assert.strictEqual(calls.actions[0].selector, "#submit");
	});

	it("types text into an input", async () => {
		const { page, calls } = makePage();
		const result = await browserImpl(
			{ action: "type", selector: "#input", text: "hello" },
			{ launchBrowser: async () => ({ close: async () => {} }), openPage: async () => page },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(calls.actions[0].type, "type");
		assert.strictEqual(calls.actions[0].text, "hello");
	});

	it("clears the existing value before filling", async () => {
		const { page, calls } = makePage();
		const result = await browserImpl(
			{ action: "fill", selector: "#input", text: "hello" },
			{ launchBrowser: async () => ({ close: async () => {} }), openPage: async () => page },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(calls.actions[0].type, "$eval");
		assert.strictEqual(calls.actions[1].type, "type");
	});

	it("presses a key", async () => {
		const { page, calls } = makePage();
		const result = await browserImpl(
			{ action: "press", key: "Enter" },
			{ launchBrowser: async () => ({ close: async () => {} }), openPage: async () => page },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(calls.actions[0].type, "press");
		assert.strictEqual(calls.actions[0].key, "Enter");
	});

	it("captures a screenshot as base64", async () => {
		const { page, calls } = makePage();
		const result = await browserImpl(
			{ action: "screenshot" },
			{ launchBrowser: async () => ({ close: async () => {} }), openPage: async () => page },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.mimeType, "image/png");
		assert.strictEqual(parsed.data, "base64data");
		assert.strictEqual(calls.actions[0].type, "screenshot");
	});

	it("extracts DOM text", async () => {
		const { page } = makePage({
			evaluate: async () => "Extracted text",
		});
		const result = await browserImpl(
			{ action: "extract" },
			{ launchBrowser: async () => ({ close: async () => {} }), openPage: async () => page },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.content, "Extracted text");
		assert.strictEqual(parsed.contentLength, 14);
	});

	it("waits for a selector", async () => {
		const { page, calls } = makePage();
		const result = await browserImpl(
			{ action: "waitFor", selector: "#content" },
			{ launchBrowser: async () => ({ close: async () => {} }), openPage: async () => page },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(calls.actions[0].type, "waitForSelector");
		assert.strictEqual(calls.actions[0].selector, "#content");
	});

	it("waits for network idle when no selector is given", async () => {
		const { page, calls } = makePage();
		const result = await browserImpl(
			{ action: "waitFor", waitUntil: "networkidle" },
			{ launchBrowser: async () => ({ close: async () => {} }), openPage: async () => page },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(calls.actions[0].type, "waitForNetworkIdle");
	});

	it("evaluates JavaScript in page context", async () => {
		const { page, calls } = makePage({
			evaluate: async () => {
				calls.actions.push({ type: "evaluate" });
				return "title";
			},
		});
		const result = await browserImpl(
			{ action: "evaluate", fn: "() => document.title" },
			{ launchBrowser: async () => ({ close: async () => {} }), openPage: async () => page },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.result, "title");
		assert.strictEqual(calls.actions[0].type, "evaluate");
	});

	it("returns an error when the action fails", async () => {
		const { page } = makePage({
			click: async () => {
				throw new Error("No element found");
			},
		});
		const result = await browserImpl(
			{ action: "click", selector: "#missing" },
			{ launchBrowser: async () => ({ close: async () => {} }), openPage: async () => page },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.match(parsed.error, /Browser action failed/);
	});

	it("closes the browser in a finally block", async () => {
		let closed = false;
		const { page } = makePage({
			evaluate: async () => "Extracted text",
		});
		const result = await browserImpl(
			{ action: "extract" },
			{
				launchBrowser: async () => ({
					close: async () => {
						closed = true;
					},
				}),
				openPage: async () => page,
			},
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(closed, true);
	});

	it("reuses a persistent session when a sessionId is provided", async () => {
		const { page } = makePage({
			evaluate: async () => "Extracted text",
		});
		let launchCount = 0;
		const launchBrowser = async () => {
			launchCount += 1;
			return { close: async () => {} };
		};
		await browserImpl(
			{ action: "navigate", url: "https://example.com", sessionId: "s1" },
			{ launchBrowser, openPage: async () => page },
		);
		await browserImpl(
			{ action: "extract", sessionId: "s1" },
			{ launchBrowser, openPage: async () => page },
		);
		// The second call reuses the session, so the browser is only launched once.
		assert.strictEqual(launchCount, 1);
	});

	it("closes a persistent session on the close action", async () => {
		let closed = false;
		const { page } = makePage();
		const launchBrowser = async () => ({
			close: async () => {
				closed = true;
			},
		});
		await browserImpl(
			{ action: "navigate", url: "https://example.com", sessionId: "s2" },
			{ launchBrowser, openPage: async () => page },
		);
		const result = await browserImpl(
			{ action: "close", sessionId: "s2" },
			{ launchBrowser, openPage: async () => page },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.action, "close");
		assert.strictEqual(closed, true);
	});
});
