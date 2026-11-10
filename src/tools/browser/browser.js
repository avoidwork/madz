import { existsSync } from "node:fs";
import { filterUrl } from "../../sandbox/urlFilter.js";
import { loadConfig } from "../../config/loader.js";
import { logger } from "../../shared/logger.js";

// Default Chromium executable path in the container (installed via apt-get).
const DEFAULT_CHROMIUM_PATH = "/usr/bin/chromium";

/** Schemes that never touch the network, so the allowlist does not apply to them. */
const LOCAL_SCHEMES = new Set(["data:", "blob:", "about:"]);

/**
 * Resolve the system Chromium executable path.
 * Prefers the `CHROMIUM_PATH` env var, then the container default, then
 * `PUPPETEER_EXECUTABLE_PATH` (set by the PDF tooling), then falls back to the
 * container default. Returns `null` if no candidate exists on disk.
 * @returns {string|null} The resolved Chromium executable path, or null
 */
export function resolveChromiumPath() {
	const candidates = [
		process.env.CHROMIUM_PATH,
		DEFAULT_CHROMIUM_PATH,
		process.env.PUPPETEER_EXECUTABLE_PATH,
	].filter(Boolean);

	for (const candidate of candidates) {
		if (existsSync(candidate)) {
			return candidate;
		}
	}

	return null;
}

/**
 * Launch a headless Chromium browser via puppeteer-core against the system
 * Chromium. Applies the container-required `--no-sandbox --disable-dev-shm-usage`
 * flags and a per-call timeout. Callers MUST close the returned browser.
 * @param {object} [options] - Launch options
 * @param {number} [options.timeout] - Per-call timeout in milliseconds (default: `browser.timeoutMs`)
 * @returns {Promise<import("puppeteer-core").Browser>} The launched browser
 */
export async function launchBrowser(options = {}) {
	const { timeout = loadConfig().browser.timeoutMs } = options;
	const { default: puppeteer } = await import("puppeteer-core");

	const executablePath = resolveChromiumPath();
	if (!executablePath) {
		throw new Error("System Chromium not found. Install chromium or set CHROMIUM_PATH.");
	}

	const browser = await puppeteer.launch({
		executablePath,
		headless: true,
		args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-setuid-sandbox"],
		timeout,
	});

	return browser;
}

/**
 * Open a new page in the browser with a per-call navigation timeout.
 * @param {import("puppeteer-core").Browser} browser - The launched browser
 * @param {number} [timeout] - Navigation timeout in milliseconds (default: `browser.timeoutMs`)
 * @param {{width: number, height: number}} [viewport] - Viewport size; Puppeteer's 800x600 default when omitted
 * @returns {Promise<import("puppeteer-core").Page>} The opened page
 */
export async function openPage(browser, timeout = loadConfig().browser.timeoutMs, viewport) {
	const page = await browser.newPage();
	if (viewport) await page.setViewport(viewport);
	page.setDefaultNavigationTimeout(timeout);
	page.setDefaultTimeout(timeout);
	return page;
}

/**
 * Whether a URL points at a local scheme (`data:`, `blob:`, `about:`).
 * @param {string} url - The request URL
 * @returns {boolean}
 */
function isLocalUrl(url) {
	return LOCAL_SCHEMES.has(url.slice(0, url.indexOf(":") + 1).toLowerCase());
}

/**
 * Check every request the page makes — navigations, redirects and sub-resources
 * — against the allowlist, aborting any that is blocked. Puppeteer's request
 * interception does not cover WebSocket connections.
 * @param {import("puppeteer-core").Page} page - The opened page
 * @param {string[]} allowlist - Allowed hosts/URLs (empty allows any host; blocked schemes still apply)
 * @returns {Promise<void>}
 */
export async function guardRequests(page, allowlist) {
	await page.setRequestInterception(true);
	page.on("request", (request) => {
		const url = request.url();
		const allowed = isLocalUrl(url) || filterUrl(url, allowlist).allowed;
		const settled = allowed ? request.continue() : request.abort("blockedbyclient");
		settled.catch((err) => logger.debug(`browser: request handling failed: ${err.message}`));
	});
}
