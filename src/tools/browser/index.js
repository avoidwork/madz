import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { filterUrl } from "../../sandbox/urlFilter.js";
import { launchBrowser, openPage, DEFAULT_TIMEOUT } from "../web/browser.js";

/**
 * Zod schema for the `browser` tool input. A discriminated union keyed on
 * `action`, so each action carries its own required params.
 */
const BrowserSchema = z.discriminatedUnion("action", [
	z.object({
		action: z.literal("navigate"),
		url: z.string().url().describe("URL to navigate to"),
		timeout: z
			.number()
			.int()
			.min(1000)
			.optional()
			.describe("Per-call timeout in milliseconds (default: 30000)"),
	}),
	z.object({
		action: z.literal("click"),
		selector: z.string().min(1).describe("CSS selector of the element to click"),
	}),
	z.object({
		action: z.literal("type"),
		selector: z.string().min(1).describe("CSS selector of the element to type into"),
		text: z.string().describe("Text to enter"),
	}),
	z.object({
		action: z.literal("fill"),
		selector: z.string().min(1).describe("CSS selector of the element to fill"),
		text: z.string().describe("Text to fill"),
	}),
	z.object({
		action: z.literal("press"),
		key: z.string().min(1).describe("Keyboard key to press (e.g. Enter, Tab)"),
	}),
	z.object({
		action: z.literal("screenshot"),
		fullPage: z.boolean().optional().describe("Capture the full page (default: false)"),
	}),
	z.object({
		action: z.literal("extract"),
		selector: z.string().optional().describe("Optional CSS selector to scope the extraction"),
	}),
	z.object({
		action: z.literal("waitFor"),
		selector: z.string().min(1).describe("CSS selector to wait for"),
		timeout: z
			.number()
			.int()
			.min(1000)
			.optional()
			.describe("Wait timeout in milliseconds (default: 30000)"),
	}),
	z.object({
		action: z.literal("evaluate"),
		expression: z.string().min(1).describe("JavaScript expression to evaluate in page context"),
	}),
	z.object({
		action: z.literal("close"),
	}),
]);

// Module-level browser session. Lazily created on first action and reused
// across calls so a multi-step interaction (navigate → click → extract) works.
let _browser = null;
let _page = null;

/**
 * Get the persistent browser instance, launching it lazily on first use.
 * @param {object} [options] - Runtime options for test injection
 * @param {Function} [options.launchBrowser] - Browser launch factory (defaults to real one)
 * @returns {Promise<import("puppeteer-core").Browser>} The browser instance
 */
async function getBrowser(options = {}) {
	if (!_browser) {
		const launch = options.launchBrowser || launchBrowser;
		_browser = await launch({ timeout: DEFAULT_TIMEOUT });
	}
	return _browser;
}

/**
 * Get the persistent page, opening it lazily on first use. A single page is
 * reused across calls so a multi-step interaction stays on the same document.
 * @param {object} [options] - Runtime options for test injection
 * @param {Function} [options.openPage] - Page opener (defaults to real one)
 * @returns {Promise<import("puppeteer-core").Page>} The page instance
 */
async function getPage(options = {}) {
	if (!_page) {
		const browser = await getBrowser(options);
		const open = options.openPage || openPage;
		_page = await open(browser, DEFAULT_TIMEOUT);
	}
	return _page;
}

/**
 * Run a browser action against a persistent headless Chromium instance.
 * @param {object} input - Tool input
 * @param {string} input.action - The action to perform
 * @param {object} [options] - Runtime options for test injection
 * @param {Function} [options.launchBrowser] - Browser launch factory (defaults to real one)
 * @param {Function} [options.openPage] - Page opener (defaults to real one)
 * @returns {Promise<string>} JSON result string
 */
export async function browserImpl(input, options = {}) {
	const { action } = input;

	try {
		if (action === "close") {
			if (_page) {
				await _page.close().catch(() => {});
				_page = null;
			}
			if (_browser) {
				await _browser.close().catch(() => {});
				_browser = null;
			}
			return JSON.stringify({ ok: true });
		}

		const page = await getPage(options);

		switch (action) {
			case "navigate": {
				const validation = filterUrl(input.url, []);
				if (!validation.allowed) {
					return JSON.stringify({ ok: false, error: `URL rejected: ${validation.reason}` });
				}
				await page.goto(input.url, {
					waitUntil: "domcontentloaded",
					timeout: input.timeout || DEFAULT_TIMEOUT,
				});
				return JSON.stringify({ ok: true, url: input.url });
			}

			case "click": {
				await page.click(input.selector);
				return JSON.stringify({ ok: true });
			}

			case "type":
			case "fill": {
				await page.type(input.selector, input.text);
				return JSON.stringify({ ok: true });
			}

			case "press": {
				await page.keyboard.press(input.key);
				return JSON.stringify({ ok: true });
			}

			case "screenshot": {
				const data = await page.screenshot({
					fullPage: input.fullPage || false,
					encoding: "base64",
				});
				return JSON.stringify({ ok: true, image: data });
			}

			case "extract": {
				const content = input.selector
					? await page.$eval(input.selector, (el) => el.innerText)
					: await page.evaluate(() => document.body?.innerText || "");
				return JSON.stringify({ ok: true, content });
			}

			case "waitFor": {
				await page.waitForSelector(input.selector, { timeout: input.timeout || DEFAULT_TIMEOUT });
				return JSON.stringify({ ok: true });
			}

			case "evaluate": {
				const result = await page.evaluate(input.expression);
				return JSON.stringify({ ok: true, result });
			}

			default:
				return JSON.stringify({ ok: false, error: `Unknown action: ${action}` });
		}
	} catch (err) {
		return JSON.stringify({ ok: false, error: err.message });
	}
}

/**
 * Reset the persistent browser session. Used by tests to isolate state.
 * @returns {void}
 */
export function resetBrowser() {
	_browser = null;
	_page = null;
}

/**
 * @param {z.infer<typeof BrowserSchema>} input - Tool input with action
 * @returns {string} JSON result string
 */
export const browser = tool(browserImpl, {
	name: "browser",
	description:
		"Drive a real headless browser via Puppeteer. Actions: navigate, click, type/fill, press, " +
		"screenshot, extract, waitFor, evaluate, close. Validates outbound URLs against the sandbox " +
		"allowlist. The browser session persists across calls so you can navigate, then click, type, " +
		"and extract in sequence. Use this to act on the web — click buttons, fill forms, log in, or " +
		"extract data from authenticated or JavaScript-heavy pages.",
	schema: BrowserSchema,
});
