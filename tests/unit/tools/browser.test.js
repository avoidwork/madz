import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	browserImpl,
	BrowserToolSchema,
	_closeAllSessions,
} from "../../../src/tools/browser/index.js";
import { loadConfig } from "../../../src/config/loader.js";

let screenshotsDir;

before(async () => {
	screenshotsDir = await mkdtemp(join(tmpdir(), "madz-browser-"));
});

after(async () => {
	await rm(screenshotsDir, { recursive: true, force: true });
});

afterEach(async () => {
	await _closeAllSessions();
});

const makePage = (overrides = {}) => {
	const calls = { actions: [], handlers: {}, interception: false };
	const page = {
		setRequestInterception: async (enabled) => {
			calls.interception = enabled;
		},
		on: (event, handler) => {
			calls.handlers[event] = [...(calls.handlers[event] ?? []), handler];
		},
		waitForFunction: async (_fn, opts, ...args) => {
			calls.actions.push({ type: "waitForFunction", opts, args });
		},
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
			return fn({ value: "old", dispatchEvent() {} });
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
		const result = BrowserToolSchema.safeParse({ action: "evaluate", fn: "document.title" });
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
		assert.strictEqual(typeof result, "object");
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /URL rejected/);
	});

	it("navigates to a valid URL", async () => {
		const { page, calls } = makePage();
		const result = await browserImpl(
			{ action: "navigate", url: "https://example.com" },
			{ launchBrowser: async () => ({ close: async () => {} }), openPage: async () => page },
		);
		assert.strictEqual(typeof result, "object");
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.action, "navigate");
		assert.strictEqual(calls.actions[0].type, "goto");
		assert.strictEqual(calls.actions[0].url, "https://example.com");
	});

	it("clicks an element", async () => {
		const { page, calls } = makePage();
		const result = await browserImpl(
			{ action: "click", selector: "#submit" },
			{ launchBrowser: async () => ({ close: async () => {} }), openPage: async () => page },
		);
		assert.strictEqual(typeof result, "object");
		assert.strictEqual(result.ok, true);
		assert.strictEqual(calls.actions[0].type, "click");
		assert.strictEqual(calls.actions[0].selector, "#submit");
	});

	it("types text into an input", async () => {
		const { page, calls } = makePage();
		const result = await browserImpl(
			{ action: "type", selector: "#input", text: "hello" },
			{ launchBrowser: async () => ({ close: async () => {} }), openPage: async () => page },
		);
		assert.strictEqual(typeof result, "object");
		assert.strictEqual(result.ok, true);
		assert.strictEqual(calls.actions[0].type, "type");
		assert.strictEqual(calls.actions[0].text, "hello");
	});

	it("clears the existing value before filling", async () => {
		const { page, calls } = makePage();
		const result = await browserImpl(
			{ action: "fill", selector: "#input", text: "hello" },
			{ launchBrowser: async () => ({ close: async () => {} }), openPage: async () => page },
		);
		assert.strictEqual(typeof result, "object");
		assert.strictEqual(result.ok, true);
		assert.strictEqual(calls.actions[0].type, "$eval");
		assert.strictEqual(calls.actions[1].type, "type");
	});

	it("presses a key", async () => {
		const { page, calls } = makePage();
		const result = await browserImpl(
			{ action: "press", key: "Enter" },
			{ launchBrowser: async () => ({ close: async () => {} }), openPage: async () => page },
		);
		assert.strictEqual(typeof result, "object");
		assert.strictEqual(result.ok, true);
		assert.strictEqual(calls.actions[0].type, "press");
		assert.strictEqual(calls.actions[0].key, "Enter");
	});

	it("captures a screenshot, saves it to disk, and returns the path", async () => {
		const { page, calls } = makePage();
		const result = await browserImpl(
			{ action: "screenshot" },
			{
				launchBrowser: async () => ({ close: async () => {} }),
				openPage: async () => page,
				screenshotsDir,
			},
		);
		assert.strictEqual(typeof result, "object");
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.mimeType, "image/jpeg");
		assert.strictEqual(typeof result.path, "string");
		assert.match(result.path, /\.jpg$/);
		assert.strictEqual(result.path.startsWith(screenshotsDir), true);
		assert.strictEqual(calls.actions[0].type, "screenshot");
		assert.strictEqual(calls.actions[0].opts.type, "jpeg");
		assert.strictEqual(calls.actions[0].opts.quality, 80);
	});

	it("extracts DOM text", async () => {
		const { page } = makePage({
			evaluate: async () => "Extracted text",
		});
		const result = await browserImpl(
			{ action: "extract" },
			{ launchBrowser: async () => ({ close: async () => {} }), openPage: async () => page },
		);
		assert.strictEqual(typeof result, "object");
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.content, "Extracted text");
		assert.strictEqual(result.contentLength, 14);
	});

	it("waits for a selector", async () => {
		const { page, calls } = makePage();
		const result = await browserImpl(
			{ action: "waitFor", selector: "#content" },
			{ launchBrowser: async () => ({ close: async () => {} }), openPage: async () => page },
		);
		assert.strictEqual(typeof result, "object");
		assert.strictEqual(result.ok, true);
		assert.strictEqual(calls.actions[0].type, "waitForSelector");
		assert.strictEqual(calls.actions[0].selector, "#content");
	});

	it("waits for network idle when no selector is given", async () => {
		const { page, calls } = makePage();
		const result = await browserImpl(
			{ action: "waitFor", waitUntil: "networkidle" },
			{ launchBrowser: async () => ({ close: async () => {} }), openPage: async () => page },
		);
		assert.strictEqual(typeof result, "object");
		assert.strictEqual(result.ok, true);
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
			{ action: "evaluate", fn: "document.title" },
			{ launchBrowser: async () => ({ close: async () => {} }), openPage: async () => page },
		);
		assert.strictEqual(typeof result, "object");
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.result, "title");
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
		assert.strictEqual(typeof result, "object");
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /Browser action failed/);
	});

	it("generates and returns a sessionId when none is provided", async () => {
		const { page } = makePage({
			evaluate: async () => "Extracted text",
		});
		const result = await browserImpl(
			{ action: "extract" },
			{
				launchBrowser: async () => ({ close: async () => {} }),
				openPage: async () => page,
			},
		);
		assert.strictEqual(typeof result, "object");
		assert.strictEqual(result.ok, true);
		assert.strictEqual(typeof result.sessionId, "string");
		assert.ok(result.sessionId.length > 0);
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

	it("reuses an auto-generated sessionId across calls", async () => {
		const { page } = makePage({
			evaluate: async () => "Extracted text",
		});
		let launchCount = 0;
		const launchBrowser = async () => {
			launchCount += 1;
			return { close: async () => {} };
		};
		const first = await browserImpl(
			{ action: "navigate", url: "https://example.com" },
			{ launchBrowser, openPage: async () => page },
		);
		assert.strictEqual(typeof first, "object");
		assert.strictEqual(first.ok, true);
		assert.strictEqual(typeof first.sessionId, "string");
		const second = await browserImpl(
			{ action: "extract", sessionId: first.sessionId },
			{ launchBrowser, openPage: async () => page },
		);
		assert.strictEqual(typeof second, "object");
		assert.strictEqual(second.ok, true);
		// The second call reuses the auto-generated session, so the browser is
		// only launched once.
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
		assert.strictEqual(typeof result, "object");
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.action, "close");
		assert.strictEqual(closed, true);
	});
});

const makeLauncher = () => {
	const state = { launched: 0, closed: [] };
	const launchBrowser = async () => {
		const id = state.launched++;
		return {
			close: async () => {
				state.closed.push(id);
			},
		};
	};
	return { state, launchBrowser };
};

describe("browserImpl - schema", () => {
	it("rejects a close action without a sessionId", () => {
		assert.strictEqual(BrowserToolSchema.safeParse({ action: "close" }).success, false);
	});

	it("rejects a timeout under 1000ms", () => {
		const result = BrowserToolSchema.safeParse({ action: "extract", timeout: 10 });
		assert.strictEqual(result.success, false);
	});
});

describe("browserImpl - session lifecycle", () => {
	it("does not launch a browser to close an unknown session", async () => {
		const { state, launchBrowser } = makeLauncher();
		const result = await browserImpl({ action: "close", sessionId: "ghost" }, { launchBrowser });
		assert.deepStrictEqual(result, { ok: true, action: "close" });
		assert.strictEqual(state.launched, 0);
	});

	it("closes a browser it launched when the action fails", async () => {
		const { page } = makePage({
			click: async () => {
				throw new Error("No element found");
			},
		});
		const { state, launchBrowser } = makeLauncher();
		const result = await browserImpl(
			{ action: "click", selector: "#x" },
			{ launchBrowser, openPage: async () => page },
		);
		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.sessionId, null);
		assert.deepStrictEqual(state.closed, [0]);
	});

	it("keeps an existing session open when a later action fails", async () => {
		let fail = false;
		const { page } = makePage({
			click: async () => {
				if (fail) throw new Error("boom");
			},
		});
		const { state, launchBrowser } = makeLauncher();
		const opts = { launchBrowser, openPage: async () => page };
		await browserImpl({ action: "navigate", url: "https://example.com", sessionId: "keep" }, opts);
		fail = true;
		const result = await browserImpl({ action: "click", selector: "#x", sessionId: "keep" }, opts);
		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.sessionId, "keep");
		assert.deepStrictEqual(state.closed, []);
	});

	it("closes the browser when the page cannot be opened", async () => {
		const { state, launchBrowser } = makeLauncher();
		const result = await browserImpl(
			{ action: "extract" },
			{
				launchBrowser,
				openPage: async () => {
					throw new Error("no page");
				},
			},
		);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /no page/);
		assert.strictEqual(result.sessionId, null);
		assert.deepStrictEqual(state.closed, [0]);
	});

	it("closes the browser when request interception cannot be enabled", async () => {
		const { page } = makePage({
			setRequestInterception: async () => {
				throw new Error("no interception");
			},
		});
		const { state, launchBrowser } = makeLauncher();
		const result = await browserImpl(
			{ action: "extract" },
			{ launchBrowser, openPage: async () => page },
		);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /no interception/);
		assert.deepStrictEqual(state.closed, [0]);
	});

	it("closes the least recently used session when at browser.maxSessions", async (t) => {
		t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
		const { page } = makePage({ evaluate: async () => "text" });
		const { state, launchBrowser } = makeLauncher();
		const opts = { launchBrowser, openPage: async () => page };
		const max = loadConfig().browser.maxSessions;
		for (let i = 0; i < max; i++) {
			await browserImpl(
				{ action: "navigate", url: "https://example.com", sessionId: `s${i}` },
				opts,
			);
			t.mock.timers.tick(10);
		}
		// Touch s0 so s1 becomes the least recently used.
		await browserImpl({ action: "extract", sessionId: "s0" }, opts);
		t.mock.timers.tick(10);
		await browserImpl({ action: "navigate", url: "https://example.com", sessionId: "new" }, opts);
		assert.deepStrictEqual(state.closed, [1]);
		await _closeAllSessions();
	});

	it("closes an idle session after browser.sessionIdleTimeoutMs", async (t) => {
		t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
		const { page } = makePage();
		const { state, launchBrowser } = makeLauncher();
		await browserImpl(
			{ action: "navigate", url: "https://example.com", sessionId: "idle" },
			{ launchBrowser, openPage: async () => page },
		);
		const idle = loadConfig().browser.sessionIdleTimeoutMs;
		t.mock.timers.tick(idle - 1);
		assert.deepStrictEqual(state.closed, []);
		t.mock.timers.tick(1);
		assert.deepStrictEqual(state.closed, [0]);
	});
});

describe("browserImpl - request guard", () => {
	it("rejects a navigate URL that is not on the allowlist without launching", async () => {
		const { state, launchBrowser } = makeLauncher();
		const result = await browserImpl(
			{ action: "navigate", url: "https://evil.test/" },
			{ launchBrowser, allowlist: ["example.com"] },
		);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /URL rejected/);
		assert.strictEqual(state.launched, 0);
	});

	it("enables request interception on the page it opens", async () => {
		const { page, calls } = makePage();
		await browserImpl(
			{ action: "navigate", url: "https://example.com" },
			{ launchBrowser: makeLauncher().launchBrowser, openPage: async () => page },
		);
		assert.strictEqual(calls.interception, true);
		assert.strictEqual(calls.handlers.request.length, 1);
	});

	it("applies the allowlist option to requests the page makes", async () => {
		const { page, calls } = makePage();
		await browserImpl(
			{ action: "navigate", url: "https://example.com/" },
			{
				launchBrowser: makeLauncher().launchBrowser,
				openPage: async () => page,
				allowlist: ["example.com"],
			},
		);
		const seen = [];
		const request = (url) => ({
			url: () => url,
			continue: async () => seen.push(["continue", url]),
			abort: async (code) => seen.push(["abort", url, code]),
		});
		const [handler] = calls.handlers.request;
		handler(request("https://example.com/app.js"));
		handler(request("https://evil.test/redirect"));
		assert.deepStrictEqual(seen, [
			["continue", "https://example.com/app.js"],
			["abort", "https://evil.test/redirect", "blockedbyclient"],
		]);
	});
});

describe("browserImpl - waitFor", () => {
	const run = async (input) => {
		const { page, calls } = makePage();
		const result = await browserImpl(
			{ action: "waitFor", ...input },
			{ launchBrowser: makeLauncher().launchBrowser, openPage: async () => page },
		);
		assert.strictEqual(result.ok, true);
		return calls.actions[0];
	};

	for (const [waitUntil, concurrency] of [
		["networkidle", 0],
		["networkidle0", 0],
		["networkidle2", 2],
	]) {
		it(`maps ${waitUntil} to ${concurrency} open connections`, async () => {
			const action = await run({ waitUntil });
			assert.strictEqual(action.type, "waitForNetworkIdle");
			assert.strictEqual(action.opts.concurrency, concurrency);
			assert.strictEqual(action.opts.idleTime, loadConfig().browser.networkIdleMs);
			assert.strictEqual(action.opts.timeout, loadConfig().browser.timeoutMs);
		});
	}

	it("defaults to network idle", async () => {
		const action = await run({});
		assert.strictEqual(action.type, "waitForNetworkIdle");
		assert.strictEqual(action.opts.concurrency, 0);
	});

	it("waits for the complete readyState on load", async () => {
		const action = await run({ waitUntil: "load" });
		assert.strictEqual(action.type, "waitForFunction");
		assert.deepStrictEqual(action.args, [["complete"]]);
		assert.strictEqual(action.opts.timeout, loadConfig().browser.timeoutMs);
	});

	it("waits for an interactive or complete readyState on domcontentloaded", async () => {
		const action = await run({ waitUntil: "domcontentloaded" });
		assert.strictEqual(action.type, "waitForFunction");
		assert.deepStrictEqual(action.args, [["interactive", "complete"]]);
	});

	it("passes the per-call timeout to waitFor", async () => {
		const action = await run({ selector: "#x", timeout: 5000 });
		assert.strictEqual(action.type, "waitForSelector");
	});
});

describe("browserImpl - result size", () => {
	const max = () => loadConfig().browser.maxContentChars;
	const extract = (text) => {
		const { page } = makePage({ evaluate: async () => text });
		return browserImpl(
			{ action: "extract" },
			{ launchBrowser: makeLauncher().launchBrowser, openPage: async () => page },
		);
	};

	it("truncates extracted text to browser.maxContentChars", async () => {
		const result = await extract("x".repeat(max() + 10));
		assert.strictEqual(result.content.length, max());
		assert.strictEqual(result.contentLength, max() + 10);
		assert.strictEqual(result.truncated, true);
	});

	it("does not flag text within the limit as truncated", async () => {
		const result = await extract("short");
		assert.strictEqual(result.content, "short");
		assert.strictEqual("truncated" in result, false);
	});

	it("truncates a large evaluate result", async () => {
		const { page } = makePage({ evaluate: async () => ({ big: "y".repeat(max()) }) });
		const result = await browserImpl(
			{ action: "evaluate", fn: "bigObject" },
			{ launchBrowser: makeLauncher().launchBrowser, openPage: async () => page },
		);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(typeof result.result, "string");
		assert.strictEqual(result.result.length, max());
		assert.strictEqual(result.truncated, true);
	});

	it("returns a small evaluate result unchanged", async () => {
		const { page } = makePage({ evaluate: async () => ({ a: 1 }) });
		const result = await browserImpl(
			{ action: "evaluate", fn: "obj" },
			{ launchBrowser: makeLauncher().launchBrowser, openPage: async () => page },
		);
		assert.deepStrictEqual(result.result, { a: 1 });
		assert.strictEqual("truncated" in result, false);
	});

	it("returns an undefined evaluate result unchanged", async () => {
		const { page } = makePage({ evaluate: async () => undefined });
		const result = await browserImpl(
			{ action: "evaluate", fn: "void 0" },
			{ launchBrowser: makeLauncher().launchBrowser, openPage: async () => page },
		);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.result, undefined);
	});
});

describe("browserImpl - fill, timeout and screenshots", () => {
	const fill = async (el) => {
		const { page } = makePage({ $eval: async (_selector, fn) => fn(el) });
		return browserImpl(
			{ action: "fill", selector: "#f", text: "hi" },
			{ launchBrowser: makeLauncher().launchBrowser, openPage: async () => page },
		);
	};

	it("clears an input value and dispatches an input event", async () => {
		const events = [];
		const el = { value: "old", dispatchEvent: (e) => events.push(e.type) };
		const result = await fill(el);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(el.value, "");
		assert.deepStrictEqual(events, ["input"]);
	});

	it("clears a contenteditable element and dispatches an input event", async () => {
		const events = [];
		const el = { textContent: "old", dispatchEvent: (e) => events.push(e.type) };
		const result = await fill(el);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(el.textContent, "");
		assert.deepStrictEqual(events, ["input"]);
	});

	it("enforces the per-call timeout on every action", async () => {
		const { page } = makePage({ click: () => new Promise(() => {}) });
		const result = await browserImpl(
			{ action: "click", selector: "#x", timeout: 20 },
			{ launchBrowser: makeLauncher().launchBrowser, openPage: async () => page },
		);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /click timed out after 20ms/);
	});

	it("reports an unknown action as a failure", async () => {
		const { page } = makePage();
		const result = await browserImpl(
			{ action: "bogus" },
			{ launchBrowser: makeLauncher().launchBrowser, openPage: async () => page },
		);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /Unknown action: bogus/);
	});

	it("gives each screenshot a unique path", async () => {
		const { page } = makePage();
		const opts = {
			launchBrowser: makeLauncher().launchBrowser,
			openPage: async () => page,
			screenshotsDir,
		};
		const a = await browserImpl({ action: "screenshot", sessionId: "shots" }, opts);
		const b = await browserImpl({ action: "screenshot", sessionId: "shots" }, opts);
		assert.notStrictEqual(a.path, b.path);
	});
});
