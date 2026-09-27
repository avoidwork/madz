import { existsSync } from "node:fs";

// Default Chromium executable path in the container (installed via apt-get).
const DEFAULT_CHROMIUM_PATH = "/usr/bin/chromium";

// Default per-call timeout for browser launch and page operations (ms).
const DEFAULT_TIMEOUT = 30000;

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
 * @param {number} [options.timeout=30000] - Per-call timeout in milliseconds
 * @returns {Promise<import("puppeteer-core").Browser>} The launched browser
 */
export async function launchBrowser(options = {}) {
	const { timeout = DEFAULT_TIMEOUT } = options;
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
 * @param {number} [timeout=30000] - Navigation timeout in milliseconds
 * @returns {Promise<import("puppeteer-core").Page>} The opened page
 */
export async function openPage(browser, timeout = DEFAULT_TIMEOUT) {
	const page = await browser.newPage();
	page.setDefaultNavigationTimeout(timeout);
	page.setDefaultTimeout(timeout);
	return page;
}

export { DEFAULT_TIMEOUT };
