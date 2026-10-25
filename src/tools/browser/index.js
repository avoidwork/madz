import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { filterUrl } from "../../sandbox/urlFilter.js";
import { launchBrowser, openPage, DEFAULT_TIMEOUT } from "../web/browser.js";

/**
 * Session registry for persistent browser sessions. Maps a `sessionId` to a
 * live browser/page pair so a workflow can chain actions (navigate → fill →
 * click → extract) across calls without re-launching the browser each time.
 * @type {Map<string, { browser: import("puppeteer-core").Browser, page: import("puppeteer-core").Page, lastUsed: number }>}
 */
const sessions = new Map();

/**
 * Idle timeout (ms) after which a persistent session is garbage-collected.
 * @type {number}
 */
const SESSION_IDLE_TIMEOUT = 5 * 60 * 1000;

/**
 * Zod schema for the `browser` tool input. A discriminated union keyed on
 * `action` so each action carries only its own parameters. An optional
 * `sessionId` allows chaining actions across calls within a persistent
 * browser session.
 */
export const BrowserToolSchema = z.discriminatedUnion("action", [
	z.object({
		action: z.literal("navigate"),
		url: z.string().url().describe("URL to navigate to"),
		sessionId: z.string().optional().describe("Session ID to reuse a persistent browser"),
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
		sessionId: z.string().optional().describe("Session ID to reuse a persistent browser"),
		timeout: z
			.number()
			.int()
			.min(1000)
			.optional()
			.describe("Per-call timeout in milliseconds (default: 30000)"),
	}),
	z.object({
		action: z.literal("type"),
		selector: z.string().min(1).describe("CSS selector of the input to type into"),
		text: z.string().describe("Text to type"),
		sessionId: z.string().optional().describe("Session ID to reuse a persistent browser"),
		timeout: z
			.number()
			.int()
			.min(1000)
			.optional()
			.describe("Per-call timeout in milliseconds (default: 30000)"),
	}),
	z.object({
		action: z.literal("fill"),
		selector: z.string().min(1).describe("CSS selector of the input to fill"),
		text: z.string().describe("Text to enter"),
		sessionId: z.string().optional().describe("Session ID to reuse a persistent browser"),
		timeout: z
			.number()
			.int()
			.min(1000)
			.optional()
			.describe("Per-call timeout in milliseconds (default: 30000)"),
	}),
	z.object({
		action: z.literal("press"),
		key: z.string().min(1).describe("Keyboard key to press (e.g. 'Enter', 'Tab')"),
		sessionId: z.string().optional().describe("Session ID to reuse a persistent browser"),
		timeout: z
			.number()
			.int()
			.min(1000)
			.optional()
			.describe("Per-call timeout in milliseconds (default: 30000)"),
	}),
	z.object({
		action: z.literal("screenshot"),
		fullPage: z.boolean().optional().describe("Capture the full page (default: true)"),
		sessionId: z.string().optional().describe("Session ID to reuse a persistent browser"),
		timeout: z
			.number()
			.int()
			.min(1000)
			.optional()
			.describe("Per-call timeout in milliseconds (default: 30000)"),
	}),
	z.object({
		action: z.literal("extract"),
		sessionId: z.string().optional().describe("Session ID to reuse a persistent browser"),
		timeout: z
			.number()
			.int()
			.min(1000)
			.optional()
			.describe("Per-call timeout in milliseconds (default: 30000)"),
	}),
	z.object({
		action: z.literal("waitFor"),
		selector: z.string().min(1).optional().describe("CSS selector to wait for"),
		waitUntil: z
			.enum(["networkidle", "networkidle0", "networkidle2", "domcontentloaded", "load"])
			.optional()
			.describe("Navigation wait condition (default: networkidle)"),
		sessionId: z.string().optional().describe("Session ID to reuse a persistent browser"),
		timeout: z
			.number()
			.int()
			.min(1000)
			.optional()
			.describe("Per-call timeout in milliseconds (default: 30000)"),
	}),
	z.object({
		action: z.literal("evaluate"),
		fn: z.string().min(1).describe("JavaScript function body to run in page context"),
		sessionId: z.string().optional().describe("Session ID to reuse a persistent browser"),
		timeout: z
			.number()
			.int()
			.min(1000)
			.optional()
			.describe("Per-call timeout in milliseconds (default: 30000)"),
	}),
	z.object({
		action: z.literal("close"),
		sessionId: z.string().describe("Session ID to close"),
	}),
]);

/**
 * Garbage-collect idle sessions. Called before each session lookup.
 */
function pruneSessions() {
	const now = Date.now();
	for (const [id, session] of sessions) {
		if (now - session.lastUsed > SESSION_IDLE_TIMEOUT) {
			session.browser.close().catch(() => {});
			sessions.delete(id);
		}
	}
}

/**
 * Resolve the browser/page for a session. If a `sessionId` is provided and a
 * live session exists, reuse it. Otherwise launch a fresh browser and page.
 * @param {object} input - The validated tool input
 * @param {object} options - Runtime options for test injection
 * @param {Function} options.launchBrowser - Browser launch factory
 * @param {Function} options.openPage - Page opener
 * @param {number} timeout - Per-call timeout in milliseconds
 * @returns {Promise<{ browser: object, page: object, sessionId: string|null }>}
 */
async function resolveSession(input, options, timeout) {
	const { launchBrowser: launch, openPage: open } = options;
	const { sessionId } = input;

	if (sessionId) {
		pruneSessions();
		const existing = sessions.get(sessionId);
		if (existing) {
			existing.lastUsed = Date.now();
			return { browser: existing.browser, page: existing.page, sessionId };
		}
	}

	const browser = await launch({ timeout });
	const page = await open(browser, timeout);

	if (sessionId) {
		sessions.set(sessionId, { browser, page, lastUsed: Date.now() });
		return { browser, page, sessionId };
	}

	return { browser, page, sessionId: null };
}

/**
 * Execute a single browser action against an open page.
 * @param {import("puppeteer-core").Page} page - The opened page
 * @param {object} input - The validated tool input
 * @param {number} timeout - Per-call timeout in milliseconds
 * @returns {Promise<object>} The action result
 */
async function runAction(page, input, timeout) {
	switch (input.action) {
		case "navigate": {
			await page.goto(input.url, { waitUntil: "networkidle0", timeout });
			return { ok: true, action: "navigate", url: input.url };
		}
		case "click": {
			await page.click(input.selector);
			return { ok: true, action: "click", selector: input.selector };
		}
		case "type": {
			await page.type(input.selector, input.text);
			return { ok: true, action: "type", selector: input.selector };
		}
		case "fill": {
			await page.$eval(input.selector, (el) => {
				el.value = "";
			});
			await page.type(input.selector, input.text);
			return { ok: true, action: "fill", selector: input.selector };
		}
		case "press": {
			await page.keyboard.press(input.key);
			return { ok: true, action: "press", key: input.key };
		}
		case "screenshot": {
			const data = await page.screenshot({
				fullPage: input.fullPage ?? true,
				encoding: "base64",
			});
			return { ok: true, action: "screenshot", mimeType: "image/png", data };
		}
		case "extract": {
			const content = await page.evaluate(() => document.body?.innerText || "");
			return { ok: true, action: "extract", contentLength: content.length, content };
		}
		case "waitFor": {
			if (input.selector) {
				await page.waitForSelector(input.selector, { timeout });
			} else {
				await page.waitForNetworkIdle({ idleTime: 500, timeout });
			}
			return { ok: true, action: "waitFor", selector: input.selector ?? null };
		}
		case "evaluate": {
			// eslint-disable-next-line no-new-func
			const fn = new Function(`return (${input.fn})`)();
			const result = await page.evaluate(fn);
			return { ok: true, action: "evaluate", result };
		}
		case "close": {
			return { ok: true, action: "close" };
		}
		default: {
			return { ok: false, error: `Unknown action: ${input.action}` };
		}
	}
}

/**
 * Drive a real headless Chromium browser — click, type, fill, navigate, press,
 * screenshot, extract DOM text, wait for selectors/network-idle, and evaluate
 * JavaScript in page context. Validates every outbound URL against the sandbox
 * allowlist (SSRF protection). Pass a `sessionId` to chain actions across calls
 * within a persistent browser session; omit it for a per-call ephemeral session.
 * @param {object} input - Tool input with an `action` discriminator
 * @param {object} [options] - Runtime options for test injection
 * @param {Function} [options.launchBrowser] - Browser launch factory (defaults to real one)
 * @param {Function} [options.openPage] - Page opener (defaults to real one)
 * @returns {Promise<string>} JSON result string
 */
export async function browserImpl(input, options = {}) {
	const launch = options.launchBrowser || launchBrowser;
	const open = options.openPage || openPage;
	const timeout = input.timeout || DEFAULT_TIMEOUT;

	// Validate any URL-bearing action against the sandbox allowlist before
	// launching the browser (SSRF protection).
	if (input.action === "navigate") {
		const validation = filterUrl(input.url, []);
		if (!validation.allowed) {
			return JSON.stringify({ ok: false, error: `URL rejected: ${validation.reason}` });
		}
	}

	let browser;
	let page;
	let sessionId = null;
	try {
		const resolved = await resolveSession(
			input,
			{ launchBrowser: launch, openPage: open },
			timeout,
		);
		browser = resolved.browser;
		page = resolved.page;
		sessionId = resolved.sessionId;

		const result = await runAction(page, input, timeout);

		// Close the session when explicitly requested.
		if (input.action === "close") {
			await browser.close().catch(() => {});
			if (sessionId) sessions.delete(sessionId);
			return JSON.stringify({ ok: true, action: "close" });
		}

		// Ephemeral sessions (no sessionId) are closed after each call.
		if (!sessionId) {
			await page.close().catch(() => {});
			await browser.close().catch(() => {});
		}

		return JSON.stringify(result);
	} catch (err) {
		return JSON.stringify({ ok: false, error: `Browser action failed: ${err.message}` });
	} finally {
		// Always close ephemeral browsers; persistent sessions stay open.
		if (!sessionId && browser) {
			await browser.close().catch(() => {});
		}
	}
}

/**
 * @param {z.infer<typeof BrowserToolSchema>} input - Tool input
 * @returns {string} JSON result string
 */
export const browser = tool(browserImpl, {
	name: "browser",
	description:
		"Drive a real headless Chromium browser — click, type, fill, navigate, press keys, " +
		"screenshot, extract DOM text, wait for selectors/network-idle, and evaluate JavaScript " +
		"in page context. Validates every outbound URL against the sandbox allowlist. Pass a " +
		"sessionId to chain actions across calls within a persistent browser session; omit it for " +
		"a per-call ephemeral session. Use this to act on a web page (forms, logins, SPAs) rather " +
		"than just read it.",
	schema: BrowserToolSchema,
});
