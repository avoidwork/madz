import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { filterUrl } from "../../sandbox/urlFilter.js";
import { loadConfig } from "../../config/loader.js";
import { logger } from "../../shared/logger.js";
import { launchBrowser, openPage, guardRequests } from "./browser.js";

/**
 * Session registry for persistent browser sessions. Maps a `sessionId` to a
 * live browser/page pair so a workflow can chain actions (navigate → fill →
 * click → extract) across calls without re-launching the browser each time.
 * Each session carries an idle timer that closes it, so abandoned browsers are
 * reclaimed without waiting for another call.
 * @type {Map<string, { browser: import("puppeteer-core").Browser, page: import("puppeteer-core").Page, lastUsed: number, timer: NodeJS.Timeout }>}
 */
const sessions = new Map();

/** `networkidle*` values for `waitFor`, mapped to the allowed number of open connections. */
const IDLE_CONCURRENCY = { networkidle: 0, networkidle0: 0, networkidle2: 2 };

/** `load` / `domcontentloaded` values for `waitFor`, mapped to the `document.readyState`s that satisfy them. */
const READY_STATES = { domcontentloaded: ["interactive", "complete"], load: ["complete"] };

const sessionId = z.string().optional().describe("Session ID to reuse a persistent browser");
const timeout = z
	.number()
	.int()
	.min(1000)
	.optional()
	.describe("Per-call timeout in milliseconds (default: browser.timeoutMs from config)");
const common = { sessionId, timeout };

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
		...common,
	}),
	z.object({
		action: z.literal("click"),
		selector: z.string().min(1).describe("CSS selector of the element to click"),
		...common,
	}),
	z.object({
		action: z.literal("type"),
		selector: z.string().min(1).describe("CSS selector of the input to type into"),
		text: z.string().describe("Text to type"),
		...common,
	}),
	z.object({
		action: z.literal("fill"),
		selector: z.string().min(1).describe("CSS selector of the input to fill"),
		text: z.string().describe("Text to enter"),
		...common,
	}),
	z.object({
		action: z.literal("press"),
		key: z.string().min(1).describe("Keyboard key to press (e.g. 'Enter', 'Tab')"),
		...common,
	}),
	z.object({
		action: z.literal("screenshot"),
		fullPage: z.boolean().optional().describe("Capture the full page (default: true)"),
		...common,
	}),
	z.object({ action: z.literal("extract"), ...common }),
	z.object({
		action: z.literal("waitFor"),
		selector: z.string().min(1).optional().describe("CSS selector to wait for"),
		waitUntil: z
			.enum(["networkidle", "networkidle0", "networkidle2", "domcontentloaded", "load"])
			.optional()
			.describe("Page state to wait for when no selector is given (default: networkidle)"),
		...common,
	}),
	z.object({
		action: z.literal("evaluate"),
		fn: z.string().min(1).describe("JavaScript expression to evaluate in page context"),
		...common,
	}),
	z.object({
		action: z.literal("close"),
		sessionId: z.string().describe("Session ID to close"),
	}),
]);

/**
 * Close a browser, logging rather than swallowing a failure.
 * @param {import("puppeteer-core").Browser} browser - The browser to close
 * @returns {Promise<void>}
 */
function closeBrowser(browser) {
	return browser.close().catch((err) => logger.warn(`browser: close failed: ${err.message}`));
}

/**
 * Close a registered session and drop it from the registry. A no-op for an
 * unknown id.
 * @param {string} id - Session ID
 * @returns {Promise<void>}
 */
function closeSession(id) {
	const entry = sessions.get(id);
	if (!entry) return Promise.resolve();
	sessions.delete(id);
	clearTimeout(entry.timer);
	return closeBrowser(entry.browser);
}

/**
 * Mark a session as just used and (re)arm its idle timer. The timer is
 * unref'd so it never keeps the process alive.
 * @param {string} id - Session ID
 * @param {{ lastUsed: number, timer: NodeJS.Timeout }} entry - The registry entry
 */
function touch(id, entry) {
	clearTimeout(entry.timer);
	entry.lastUsed = Date.now();
	entry.timer = setTimeout(() => closeSession(id), loadConfig().browser.sessionIdleTimeoutMs);
	entry.timer.unref();
}

/**
 * The least recently used session.
 * @returns {string|undefined} Its ID, or undefined when there are no sessions
 */
function leastRecentlyUsed() {
	let oldestId;
	let oldest = Infinity;
	for (const [id, entry] of sessions) {
		if (entry.lastUsed < oldest) {
			oldest = entry.lastUsed;
			oldestId = id;
		}
	}
	return oldestId;
}

/**
 * Close every open session. For tests, so state does not leak between them.
 * @internal
 * @returns {Promise<void>}
 */
export async function _closeAllSessions() {
	await Promise.all([...sessions.keys()].map(closeSession));
}

/**
 * Resolve the browser/page for a call. If a `sessionId` is provided and a live
 * session exists, reuse it. Otherwise launch a fresh browser (closing the
 * least recently used session first when at `browser.maxSessions`), guard its
 * requests against the allowlist, and register it.
 * @param {object} input - The validated tool input
 * @param {object} options - Launch factories and the request allowlist
 * @param {Function} options.launchBrowser - Browser launch factory
 * @param {Function} options.openPage - Page opener
 * @param {string[]} options.allowlist - Allowed hosts/URLs for every request
 * @param {number} callTimeout - Per-call timeout in milliseconds
 * @returns {Promise<{ id: string, entry: object, created: boolean }>}
 */
async function resolveSession(input, options, callTimeout) {
	const existing = input.sessionId && sessions.get(input.sessionId);
	if (existing) {
		touch(input.sessionId, existing);
		return { id: input.sessionId, entry: existing, created: false };
	}

	while (sessions.size >= loadConfig().browser.maxSessions) {
		await closeSession(leastRecentlyUsed());
	}

	const browser = await options.launchBrowser({ timeout: callTimeout });
	let page;
	try {
		page = await options.openPage(browser, callTimeout);
		await guardRequests(page, options.allowlist);
	} catch (err) {
		await closeBrowser(browser);
		throw err;
	}

	const id = input.sessionId || randomUUID();
	const entry = { browser, page, lastUsed: 0, timer: undefined };
	sessions.set(id, entry);
	touch(id, entry);
	return { id, entry, created: true };
}

/**
 * Reject if a promise does not settle within the time limit.
 * @param {Promise<T>} promise - The pending work
 * @param {number} ms - Time limit in milliseconds
 * @param {string} label - Name used in the timeout error
 * @returns {Promise<T>}
 * @template T
 */
function withTimeout(promise, ms, label) {
	let timer;
	const limit = new Promise((_, reject) => {
		timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
	});
	return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

/**
 * Bound a value to a character budget. Non-strings are measured by their JSON form.
 * @param {unknown} value - The value to bound
 * @param {number} max - Maximum characters
 * @returns {{ value: unknown, truncated?: true }} The value, cut to `max` characters when over
 */
function boundContent(value, max) {
	const text = typeof value === "string" ? value : JSON.stringify(value);
	if (text === undefined || text.length <= max) return { value };
	return { value: text.slice(0, max), truncated: true };
}

/**
 * Wait for a page state.
 * @param {import("puppeteer-core").Page} page - The opened page
 * @param {string} waitUntil - One of the `waitFor` `waitUntil` values
 * @param {object} ctx - Action context (timeout, config)
 */
async function waitForState(page, waitUntil, ctx) {
	if (Object.hasOwn(READY_STATES, waitUntil)) {
		await page.waitForFunction(
			(states) => states.includes(document.readyState),
			{
				timeout: ctx.timeout,
			},
			READY_STATES[waitUntil],
		);
		return;
	}
	await page.waitForNetworkIdle({
		idleTime: ctx.config.browser.networkIdleMs,
		concurrency: IDLE_CONCURRENCY[waitUntil],
		timeout: ctx.timeout,
	});
}

/**
 * Execute a single browser action against an open page.
 * @param {import("puppeteer-core").Page} page - The opened page
 * @param {object} input - The validated tool input
 * @param {object} ctx - Action context
 * @param {number} ctx.timeout - Per-call timeout in milliseconds
 * @param {object} ctx.config - The resolved config
 * @param {string} [ctx.screenshotsDir] - Directory to save screenshots to (defaults to config)
 * @returns {Promise<object>} The action result
 */
async function runAction(page, input, ctx) {
	const { timeout: limit, config } = ctx;
	switch (input.action) {
		case "navigate": {
			await page.goto(input.url, { waitUntil: "load", timeout: limit });
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
				if ("value" in el) el.value = "";
				else el.textContent = "";
				el.dispatchEvent(new Event("input", { bubbles: true }));
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
				type: "jpeg",
				quality: 80,
			});
			const dir = ctx.screenshotsDir || join(config.cwd, config.memory.screenshotsDir);
			await mkdir(dir, { recursive: true });
			const path = join(dir, `screenshot-${Date.now()}-${randomUUID()}.jpg`);
			await writeFile(path, Buffer.from(data, "base64"));
			return { ok: true, action: "screenshot", mimeType: "image/jpeg", path };
		}
		case "extract": {
			const text = await page.evaluate(() => document.body?.innerText || "");
			const { value: content, truncated } = boundContent(text, config.browser.maxContentChars);
			return {
				ok: true,
				action: "extract",
				contentLength: text.length,
				content,
				...(truncated && { truncated }),
			};
		}
		case "waitFor": {
			if (input.selector) {
				await page.waitForSelector(input.selector, { timeout: limit });
			} else {
				await waitForState(page, input.waitUntil ?? "networkidle", ctx);
			}
			return { ok: true, action: "waitFor", selector: input.selector ?? null };
		}
		case "evaluate": {
			const raw = await page.evaluate(input.fn);
			const { value: result, truncated } = boundContent(raw, config.browser.maxContentChars);
			return { ok: true, action: "evaluate", result, ...(truncated && { truncated }) };
		}
		default: {
			throw new Error(`Unknown action: ${input.action}`);
		}
	}
}

/**
 * Drive a real headless Chromium browser — click, type, fill, navigate, press,
 * screenshot, extract DOM text, wait for selectors/network-idle, and evaluate
 * JavaScript in page context. Every HTTP(S) request the page makes —
 * navigations, redirects and sub-resources — is checked against the
 * `browser.allowlist` config. Every call returns a `sessionId`; pass it back to
 * chain actions across calls within a persistent browser session. Sessions are
 * closed after `browser.sessionIdleTimeoutMs` of inactivity, and at most
 * `browser.maxSessions` are open at once.
 * @param {object} input - Tool input with an `action` discriminator
 * @param {object} [options] - Runtime options for test injection
 * @param {Function} [options.launchBrowser] - Browser launch factory (defaults to real one)
 * @param {Function} [options.openPage] - Page opener (defaults to real one)
 * @param {string[]} [options.allowlist] - Request allowlist (defaults to `browser.allowlist`)
 * @param {string} [options.screenshotsDir] - Directory to save screenshots to (defaults to config)
 * @returns {Promise<object>} Structured result object
 */
export async function browserImpl(input, options = {}) {
	const config = loadConfig();
	const allowlist = options.allowlist ?? config.browser.allowlist;
	const callTimeout = input.timeout || config.browser.timeoutMs;

	// Closing needs no browser, so never launch one just to close it.
	if (input.action === "close") {
		await closeSession(input.sessionId);
		return { ok: true, action: "close" };
	}

	// Reject a disallowed URL before launching a browser. Requests made once the
	// page is open (redirects, sub-resources) are checked by `guardRequests`.
	if (input.action === "navigate") {
		const validation = filterUrl(input.url, allowlist);
		if (!validation.allowed) {
			return { ok: false, error: `URL rejected: ${validation.reason}` };
		}
	}

	let session;
	try {
		session = await resolveSession(
			input,
			{
				launchBrowser: options.launchBrowser || launchBrowser,
				openPage: options.openPage || openPage,
				allowlist,
			},
			callTimeout,
		);
		const result = await withTimeout(
			runAction(session.entry.page, input, {
				timeout: callTimeout,
				config,
				screenshotsDir: options.screenshotsDir,
			}),
			callTimeout,
			input.action,
		);
		touch(session.id, session.entry);
		return { ...result, sessionId: session.id };
	} catch (err) {
		const error = `Browser action failed: ${err.message}`;
		// A session created for this call that failed is unusable and its ID was
		// never handed out, so close it rather than leak it until the idle timer.
		if (session?.created) {
			await closeSession(session.id);
			return { ok: false, error, sessionId: null };
		}
		return { ok: false, error, sessionId: session?.id ?? input.sessionId ?? null };
	}
}

/**
 * @param {z.infer<typeof BrowserToolSchema>} input - Tool input
 * @returns {object} Structured result object
 */
export const browser = tool(browserImpl, {
	name: "browser",
	description:
		"Drive a real headless Chromium browser — click, type, fill, navigate, press keys, " +
		"screenshot, extract DOM text, wait for selectors/network-idle, and evaluate JavaScript " +
		"in page context. The screenshot action captures a JPEG, saves it to memory/screenshots/, " +
		"and returns its path plus MIME type so readImage can read it for vision analysis. " +
		"Every HTTP(S) request the page makes (navigations, redirects, sub-resources) is checked " +
		"against the configured allowlist; WebSocket connections are not. Extract and evaluate " +
		"results are truncated to a configured size. Every call returns a sessionId; pass it back " +
		"to chain actions across calls within a persistent browser session. Idle sessions are " +
		"closed automatically and only a few can be open at once. Use this to act on a web " +
		"page (forms, logins, SPAs) rather than just read it.",
	schema: BrowserToolSchema,
});
