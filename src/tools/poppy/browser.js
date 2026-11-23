import { z } from "zod";
import { fetchJson } from "./common.js";
import { validateUrl } from "./discovery.js";
import { launchBrowser, openPage } from "../browser/browser.js";

/** Poppy protocol version sent as the `Poppy-Version` header. */
const POPPY_VERSION = "1.0";

/** The scope required to send the access token during browser sign-in. */
const BROWSER_SIGN_IN_SCOPE = "poppy:browser-sign-in";

/**
 * Zod schema for the `browser` action input. Required fields: `op` and
 * `endpoint` (the company's `browser_session_endpoint`). Optional fields:
 * `session`, `accessToken`, `scope`, `disabled`, `unscoped`.
 */
export const BrowserInputSchema = z.object({
	op: z.string().min(1),
	endpoint: z.string().min(1),
	session: z.string().optional(),
	accessToken: z.string().optional(),
	scope: z.string().optional(),
	disabled: z.boolean().optional(),
	unscoped: z.boolean().optional(),
});

/**
 * Build the request headers for a browser-session authorize call, including
 * the Poppy-Session, Poppy-Version, and access token headers as needed.
 * @param {object} input - Tool input
 * @param {string} [input.session] - The Poppy-Session JWT
 * @param {string} [input.accessToken] - The access token
 * @returns {object} The request headers
 */
export function buildBrowserHeaders(input) {
	const headers = { "Poppy-Version": POPPY_VERSION };
	if (input.session) {
		headers["Poppy-Session"] = input.session;
	}
	if (input.accessToken) {
		headers.authorization = `Bearer ${input.accessToken}`;
	}
	return headers;
}

/**
 * Validate that an endpoint is present and HTTPS/non-private.
 * @param {string} endpoint - The endpoint URL
 * @returns {{ok: boolean, error?: string}} Validation result
 */
async function validateEndpoint(endpoint) {
	if (!endpoint) {
		return { ok: false, error: "endpoint is required" };
	}
	return validateUrl(endpoint);
}

/**
 * Check whether the granted scope includes `poppy:browser-sign-in`.
 * @param {string} [scope] - The granted scope string
 * @returns {boolean} True when the scope is present
 */
export function hasBrowserSignInScope(scope) {
	return Boolean(scope?.split(/\s+/).includes(BROWSER_SIGN_IN_SCOPE));
}

/**
 * Authorize a one-time code via `POST {endpoint}/authorize`, sending the
 * session header and, if signed in, the access token.
 * @param {object} input - Tool input
 * @param {string} input.endpoint - The browser-session endpoint URL
 * @param {string} input.code - The one-time code from the agent's browser
 * @param {object} [options] - Runtime options
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
export async function authorizeCode(input, options = {}) {
	const validation = await validateEndpoint(input.endpoint);
	if (!validation.ok) {
		return validation;
	}
	if (!input.code) {
		return { ok: false, error: "code is required" };
	}
	const url = `${input.endpoint}/authorize`;
	const result = await fetchJson(url, {
		method: "POST",
		headers: buildBrowserHeaders(input),
		body: JSON.stringify({ code: input.code }),
		...options,
	});
	return result;
}

/**
 * Read the one-time code from the agent's own browser page. The code is
 * extracted from the page's DOM after top-level navigation to the
 * `browser_session_endpoint`. The code is never taken from another source.
 * @param {import("puppeteer-core").Page} page - The opened browser page
 * @returns {Promise<{ok: boolean, code?: string, error?: string}>} Result
 */
export async function readCodeFromPage(page) {
	try {
		const code = await page.evaluate(() => {
			const el = document.querySelector("[data-poppy-code]");
			if (el) {
				return el.getAttribute("data-poppy-code") || el.textContent?.trim() || "";
			}
			const input = document.querySelector("input[name='code']");
			if (input) {
				return input.value || "";
			}
			return "";
		});
		if (!code) {
			return { ok: false, error: "No one-time code found on the browser-session page" };
		}
		return { ok: true, code };
	} catch (err) {
		return { ok: false, error: `Failed to read code from browser: ${err.message}` };
	}
}

/**
 * Submit the form in the browser that sets the session cookie, then browse the
 * website with the session cookie.
 * @param {import("puppeteer-core").Page} page - The opened browser page
 * @param {string} [websiteUrl] - The website URL to browse after the cookie is set
 * @returns {Promise<{ok: boolean, error?: string}>} Result
 */
export async function submitFormAndBrowse(page, websiteUrl) {
	try {
		await page.evaluate(() => {
			const form = document.querySelector("form");
			if (form) {
				form.submit();
			}
		});
		if (websiteUrl) {
			await page.goto(websiteUrl, { waitUntil: "load" });
		}
		return { ok: true };
	} catch (err) {
		return { ok: false, error: `Failed to submit form or browse: ${err.message}` };
	}
}

/**
 * Join a company's browser session. Loads the `browser_session_endpoint` in
 * the agent's browser, reads the one-time code, authorizes it, submits the
 * form to set the session cookie, and browses the website with the cookie.
 * @param {object} input - Tool input
 * @param {string} input.op - The browser operation to perform
 * @param {string} input.endpoint - The browser-session endpoint URL
 * @param {string} [input.session] - The Poppy-Session JWT
 * @param {string} [input.accessToken] - The access token
 * @param {string} [input.scope] - The granted scope
 * @param {boolean} [input.disabled] - Whether web browsing is disabled
 * @param {boolean} [input.unscoped] - Whether the web channel is unscoped
 * @param {object} [options] - Runtime options
 * @param {Function} [options.launchBrowser] - Browser launch factory (defaults to real one)
 * @param {Function} [options.openPage] - Page opener (defaults to real one)
 * @param {string} [options.websiteUrl] - The website URL to browse after the cookie is set
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
export async function joinBrowserSession(input, options = {}) {
	const validation = await validateEndpoint(input.endpoint);
	if (!validation.ok) {
		return validation;
	}
	if (input.disabled) {
		return { ok: false, error: "Web browsing is disabled for this company" };
	}
	if (input.accessToken && !input.unscoped && !hasBrowserSignInScope(input.scope)) {
		return {
			ok: false,
			error: `Missing '${BROWSER_SIGN_IN_SCOPE}' scope required to send the access token`,
		};
	}

	const launch = options.launchBrowser ?? launchBrowser;
	const open = options.openPage ?? openPage;
	let browser;
	try {
		browser = await launch({});
		const page = await open(browser);
		await page.goto(input.endpoint, { waitUntil: "load" });

		const codeResult = await readCodeFromPage(page);
		if (!codeResult.ok) {
			return codeResult;
		}

		const authResult = await authorizeCode({ ...input, code: codeResult.code }, options);
		if (!authResult.ok) {
			return authResult;
		}

		const formResult = await submitFormAndBrowse(page, options.websiteUrl);
		if (!formResult.ok) {
			return formResult;
		}

		return { ok: true, data: { joined: true, endpoint: input.endpoint } };
	} catch (err) {
		return { ok: false, error: `Browser session join failed: ${err.message}` };
	} finally {
		if (browser) {
			await browser.close().catch(() => {});
		}
	}
}

/**
 * Dispatch the `browser` action on its `op` field.
 * @param {object} input - Tool input
 * @param {object} [options] - Runtime options
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
export async function execute(input, options = {}) {
	const parsed = BrowserInputSchema.safeParse(input);
	if (!parsed.success) {
		return {
			ok: false,
			error: `Invalid browser input: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
		};
	}
	const data = parsed.data;
	switch (data.op) {
		case "join":
			return joinBrowserSession(data, options);
		default:
			return { ok: false, error: `Unknown browser operation: ${data.op}` };
	}
}
