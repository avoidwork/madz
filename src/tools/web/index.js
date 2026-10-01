import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { filterUrl } from "../../sandbox/urlFilter.js";
import { loadConfig } from "../../config/loader.js";
import { ensureScreenshotsDir } from "../../memory/index.js";
import { launchBrowser, openPage, DEFAULT_TIMEOUT } from "./browser.js";

const config = loadConfig();

/**
 * Resize and re-encode a base64 PNG screenshot so it fits within a max width
 * and stays consumable by readImage (which enforces image.maxSize).
 * Uses sharp (native, fast) for the resize. Returns the base64 PNG.
 *
 * If `maxSize` is provided, the output is re-encoded at progressively smaller
 * widths and PNG quality until it fits under the byte budget. This closes the
 * loop with readImage: a screenshot produced here can never exceed the size
 * limit readImage enforces.
 * @param {string} data - Base64-encoded PNG
 * @param {number} maxWidth - Maximum width in pixels
 * @param {number} [maxSize] - Byte budget. Optional.
 * @returns {Promise<string>} Base64-encoded resized PNG
 */
export async function resizeScreenshot(data, maxWidth, maxSize) {
	const { default: sharp } = await import("sharp");
	const buffer = Buffer.from(data, "base64");
	const metadata = await sharp(buffer).metadata();

	const widthLimit = metadata.width && metadata.width > maxWidth ? maxWidth : metadata.width;
	const sizeLimit = maxSize || 0;

	let resized = buffer;
	if (widthLimit && widthLimit < buffer.length) {
		resized = await sharp(buffer)
			.resize({ width: widthLimit, withoutEnlargement: true })
			.png()
			.toBuffer();
	}

	// If a byte budget is set and the resized image still exceeds it, re-encode
	// at progressively smaller widths and PNG quality until it fits.
	if (sizeLimit > 0 && resized.length > sizeLimit) {
		const qualitySteps = [80, 60, 40, 20];
		for (const quality of qualitySteps) {
			const candidate = await sharp(buffer)
				.resize({ width: widthLimit, withoutEnlargement: true })
				.png({ quality })
				.toBuffer();
			if (candidate.length <= sizeLimit) {
				return candidate.toString("base64");
			}
		}
		// Last resort: halve the width until it fits.
		let width = widthLimit;
		while (width > 1) {
			width = Math.floor(width / 2);
			const candidate = await sharp(buffer)
				.resize({ width, withoutEnlargement: true })
				.png({ quality: 60 })
				.toBuffer();
			if (candidate.length <= sizeLimit) {
				return candidate.toString("base64");
			}
		}
	}

	return resized.toString("base64");
}

const FETCH_TIMEOUT = 10000;

/// -- DuckDuckGo (HTML scrape) --

/**
 * Search DuckDuckGo via HTML scrape.
 * @param {string} query - Search query
 * @param {number} limit - Max results
 * @param {object} [cfg] - DuckDuckGo configuration
 * @param {string} [cfg.region=""] - Region code (e.g. "us-en", "ca-en")
 * @param {string} [cfg.safeSearch="0"] - SafeSearch level: "0" off, "1" moderate, "2" strict
 * @param {string} [cfg.time=""] - Recency filter: "" all, "d" day, "w" week, "m" month, "y" year
 * @param {string} [cfg.baseUrl="https://html.duckduckgo.com/html/"] - Base URL for the HTML endpoint
 * @returns {Promise<{ ok: boolean, results?: object[], error?: string }>}
 */
async function searchWithDuckDuckGo(query, limit, cfg = {}) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
	try {
		const url = new URL(cfg.baseUrl || "https://html.duckduckgo.com/html/");
		url.searchParams.set("q", query);
		if (cfg.region) url.searchParams.set("kl", cfg.region);
		if (cfg.safeSearch) url.searchParams.set("safe", cfg.safeSearch);
		if (cfg.time) url.searchParams.set("df", cfg.time);
		const resp = await fetch(url, {
			signal: controller.signal,
		});
		clearTimeout(timeoutId);
		if (!resp.ok) {
			return { ok: false, error: `DuckDuckGo HTTP error: ${resp.status}` };
		}
		const html = await resp.text();
		const results = [];
		const pattern =
			/<a rel="nofollow" class="result__a" href="([^"]+)">([^<]+)<\/a>[\s\S]*?<a class="result__snippet" href="[^"]+">([^<]+)<\/a>/g;
		let match;
		while ((match = pattern.exec(html)) && results.length < limit) {
			results.push({
				title: match[2].trim(),
				url: match[1],
				description: (match[3] || "").trim(),
			});
		}
		if (results.length === 0) {
			return { ok: false, error: "DuckDuckGo returned no results" };
		}
		return { ok: true, results };
	} catch (_err) {
		clearTimeout(timeoutId);
		return { ok: false, error: "DuckDuckGo search failed" };
	}
}

/// -- Bing --

/**
 * Search using Bing API.
 * @param {string} apiKey - Bing subscription key
 * @param {string} query - Search query
 * @param {number} limit - Max results
 * @returns {Promise<{ ok: boolean, results?: object[], error?: string }>}
 */
async function searchWithBing(apiKey, query, limit) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
	try {
		const url = new URL("https://api.bing.microsoft.com/v7.0/search");
		url.searchParams.set("q", query);
		url.searchParams.set("count", String(Math.min(Math.max(limit, 1), 50)));
		const resp = await fetch(url, {
			method: "GET",
			headers: { "Ocp-Apim-Subscription-Key": apiKey },
			signal: controller.signal,
		});
		clearTimeout(timeoutId);
		if (!resp.ok) {
			const text = await resp.text().catch(() => "");
			return { ok: false, error: `Bing API error (${resp.status}): ${text.slice(0, 200)}` };
		}
		const data = await resp.json();
		return {
			ok: true,
			results: (data.webPages?.value || []).slice(0, limit).map((r) => ({
				title: r.name || "Untitled",
				url: r.url || "",
				description: r.snippet || "",
			})),
		};
	} catch (_err) {
		clearTimeout(timeoutId);
		return { ok: false, error: "Bing search failed" };
	}
}

/// -- SearXNG --

/**
 * Search using SearXNG API.
 * @param {string} searxngUrl - SearXNG instance URL
 * @param {string} query - Search query
 * @param {number} limit - Max results
 * @returns {Promise<{ ok: boolean, results?: object[], error?: string }>}
 */
async function searchWithSearXNG(searxngUrl, query, limit) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
	try {
		const url = new URL(searxngUrl);
		url.searchParams.set("q", query);
		url.searchParams.set("format", "json");
		url.searchParams.set("number", String(Math.min(Math.max(limit, 1), 100)));
		const resp = await fetch(url, { signal: controller.signal });
		clearTimeout(timeoutId);
		if (!resp.ok) {
			return { ok: false, error: `SearXNG HTTP error: ${resp.status}` };
		}
		const data = await resp.json();
		return {
			ok: true,
			results: (data.results || []).slice(0, limit).map((r) => ({
				title: r.title || "Untitled",
				url: r.url || "",
				description: r.content?.slice(0, 500) || "",
			})),
		};
	} catch (_err) {
		clearTimeout(timeoutId);
		return { ok: false, error: "SearXNG search failed" };
	}
}

/// -- Custom search --

/**
 * Search using a user-configured custom endpoint.
 * @param {object} cfg - Custom search configuration
 * @param {string} cfg.url - Request URL with {{query}} and {{apiKey}} placeholders
 * @param {string} [cfg.method="POST"] - HTTP method
 * @param {string} [cfg.body] - Request body (for POST) with {{query}} and {{apiKey}} placeholders
 * @param {string} [cfg.headers] - JSON string of headers with {{apiKey}} placeholder support
 * @param {string} [cfg.queryKey="results"] - JSON field containing results array
 * @param {string} [cfg.titleField="title"] - Field name for title
 * @param {string} [cfg.urlField="url"] - Field name for URL
 * @param {string} [cfg.descriptionField="description"] - Field name for description
 * @param {string} [cfg.apiKey] - API key (falls back to environment variable)
 * @param {string} query - Search query
 * @param {number} limit - Max results
 * @returns {Promise<{ ok: boolean, results?: object[], error?: string }>}
 */
async function searchWithCustom(cfg, query, limit) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

	try {
		const apiKey = cfg.apiKey || "";
		let url = cfg.url || "";
		url = url
			.replace(/\{\{query\}\}/g, encodeURIComponent(query))
			.replace(/\{\{apiKey\}\}/g, apiKey);

		const headers = cfg.headers
			? JSON.parse(cfg.headers.replace(/\{\{apiKey\}\}/g, apiKey))
			: { "Content-Type": "application/json" };

		const method = (cfg.method || "POST").toUpperCase();
		const body = ["POST", "PUT", "PATCH"].includes(method)
			? (cfg.body || "").replace(/\{\{query\}\}/g, query).replace(/\{\{apiKey\}\}/g, apiKey)
			: undefined;

		const resp = await fetch(url, { method, body, headers, signal: controller.signal });
		clearTimeout(timeoutId);

		if (!resp.ok) {
			return { ok: false, error: `Custom search HTTP error: ${resp.status}` };
		}

		const data = await resp.json();
		const results = Array.isArray(data[cfg.queryKey])
			? data[cfg.queryKey]
			: Array.isArray(data)
				? data
				: [data];

		return {
			ok: true,
			results: results.slice(0, limit).map((r) => ({
				title: r[cfg.titleField] || "Untitled",
				url: r[cfg.urlField] || "",
				description: r[cfg.descriptionField] || "",
			})),
		};
	} catch (_err) {
		clearTimeout(timeoutId);
		return { ok: false, error: "Custom search failed" };
	}
}

/// -- Backend selection --

/**
 * Detect which search engine is configured.
 * Priority: explicit `search.engine` > Custom (CUSTOM_SEARCH_URL) > Bing (BING_API_KEY) > SearXNG (SEARXNG_URL) > DuckDuckGo.
 * @param {object} [options] - Config object (defaults to module-level config)
 * @returns {string} Engine name or "none" (should never be none as DuckDuckGo always works)
 */
export function detectSearchBackend(options = config) {
	const search = options?.search || config.search || {};
	const engine = search?.engine;
	if (engine && ["duckduckgo", "bing", "searxng", "custom"].includes(engine)) {
		return engine;
	}
	const custom = search.custom || {};
	if (custom?.url) return "custom";
	if (search?.bing?.apiKey) return "bing";
	if (search?.searxng?.url) return "searxng";
	return "duckduckgo"; // fallback, always available
}

/// -- Core search --

/**
 * Execute web search using the detected engine.
 * @param {object} input - Tool input
 * @param {object} [options] - Config object (defaults to module-level config)
 * @returns {Promise<string>} JSON result string
 */
export async function searchWebImpl(input, options = config) {
	const { query, limit = 5 } = input;

	if (!query || typeof query !== "string" || query.trim().length === 0) {
		return JSON.stringify({ ok: false, error: "Query is required and must be a non-empty string" });
	}

	const clampedLimit = Math.min(Math.max(Number(limit) || 5, 1), 100);
	const search = options?.search || config.search || {};
	const backend = detectSearchBackend(options);
	const bing = search?.bing || {};
	const searxng = search?.searxng || {};
	const custom = search?.custom || {};
	const duckduckgo = search?.duckduckgo || {};
	let result;

	switch (backend) {
		case "bing":
			result = await searchWithBing(bing.apiKey, query, clampedLimit);
			break;
		case "searxng":
			result = await searchWithSearXNG(searxng.url, query, clampedLimit);
			break;
		case "custom": {
			result = await searchWithCustom(custom, query, clampedLimit);
			break;
		}
		case "duckduckgo":
		default:
			result = await searchWithDuckDuckGo(query, clampedLimit, duckduckgo);
	}

	if (!result.ok) {
		return JSON.stringify({ ok: false, error: result.error });
	}

	return JSON.stringify({ ok: true, backend, query, results: result.results });
}

/// -- Web extract --

/**
 * Extract content from a URL.
 * @param {object} input - Tool input with URL
 * @returns {Promise<string>} JSON result string
 */
export async function extractWebImpl(input) {
	const { url, summarizeLarge = false } = input;

	if (!url || typeof url !== "string") {
		return JSON.stringify({ ok: false, error: "URL is required" });
	}

	const validation = filterUrl(url, []);
	if (!validation.allowed) {
		return JSON.stringify({ ok: false, error: `URL rejected: ${validation.reason}` });
	}

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

	try {
		const resp = await fetch(url, {
			headers: { Accept: "text/html,application/xhtml+xml" },
			signal: controller.signal,
		});
		clearTimeout(timeoutId);

		if (!resp.ok) {
			return JSON.stringify({ ok: false, error: `HTTP ${resp.status}: ${resp.statusText}` });
		}

		const html = await resp.text();
		if (!html || html.length < 50) {
			return JSON.stringify({ ok: false, error: "Page content too short or unreadable" });
		}

		let clean = html
			.replace(/<script[\s\S]*?<\/script>/gi, "")
			.replace(/<style[\s\S]*?<\/style>/gi, "")
			.replace(/<br\s*\/?>/gi, "\n")
			.replace(/<\/?(p|div|h[1-6]|li|tr)[^>]*>/gi, "\n")
			.replace(/<a[^>]*href="[^"]*"[^>]*>/gi, " [")
			.replace(/<\/a>/gi, "](")
			.replace(/<img[^>]*alt="([^"]*)"[^>]*\/?>/gi, "![${1}]()")
			.replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, "![${1}]()")
			.replace(/<[^>]+>/g, "")
			.replace(/&nbsp;/g, " ")
			.replace(/&amp;/g, "&")
			.replace(/&lt;/g, "<")
			.replace(/&gt;/g, ">")
			.replace(/\r\n/g, "\n")
			.replace(/[ \t]+/g, " ")
			.replace(/  +/g, " ")
			.trim();

		if (html.length > 10000 && summarizeLarge) {
			return JSON.stringify({
				ok: true,
				url,
				contentLength: html.length,
				content: `[Large page (${html.length} chars)\n${clean?.slice(0, 500)}...]`,
			});
		}

		return JSON.stringify({ ok: true, url, contentLength: clean.length, content: clean });
	} catch (_err) {
		clearTimeout(timeoutId);
		return JSON.stringify({ ok: false, error: "Fetch failed" });
	}
}

/// -- Web render --

/**
 * Render a URL in headless Chromium and return the JS-aware extracted text.
 * @param {object} input - Tool input with URL
 * @param {string} input.url - URL to render
 * @param {number} [input.timeout] - Per-call timeout in milliseconds
 * @param {object} [options] - Runtime options for test injection
 * @param {Function} [options.launchBrowser] - Browser launch factory (defaults to real one)
 * @param {Function} [options.openPage] - Page opener (defaults to real one)
 * @returns {Promise<string>} JSON result string
 */
export async function renderWebImpl(input, options = {}) {
	const { url, timeout = DEFAULT_TIMEOUT } = input;
	const launch = options.launchBrowser || launchBrowser;
	const open = options.openPage || openPage;

	if (!url || typeof url !== "string") {
		return JSON.stringify({ ok: false, error: "URL is required" });
	}

	const validation = filterUrl(url, []);
	if (!validation.allowed) {
		return JSON.stringify({ ok: false, error: `URL rejected: ${validation.reason}` });
	}

	let browser;
	try {
		browser = await launch({ timeout });
		const page = await open(browser, timeout);
		await page.goto(url, { waitUntil: "networkidle0", timeout });
		const content = await page.evaluate(() => document.body?.innerText || "");
		await page.close();
		return JSON.stringify({ ok: true, url, contentLength: content.length, content });
	} catch (err) {
		return JSON.stringify({ ok: false, error: `Render failed: ${err.message}` });
	} finally {
		if (browser) {
			await browser.close().catch(() => {});
		}
	}
}

/// -- Web screenshot --

/**
 * Render a URL in headless Chromium, save the PNG screenshot to disk, and
 * return the file path plus MIME type so readImage can read it for vision analysis.
 * @param {object} input - Tool input with URL
 * @param {string} input.url - URL to render
 * @param {number} [input.timeout] - Per-call timeout in milliseconds
 * @param {object} [options] - Runtime options for test injection
 * @param {Function} [options.launchBrowser] - Browser launch factory (defaults to real one)
 * @param {Function} [options.openPage] - Page opener (defaults to real one)
 * @returns {Promise<string>} JSON result string
 */
export async function screenshotWebImpl(input, options = {}) {
	const { url, timeout = DEFAULT_TIMEOUT, maxWidth } = input;
	const launch = options.launchBrowser || launchBrowser;
	const open = options.openPage || openPage;
	const resize = options.resizeScreenshot || resizeScreenshot;

	if (!url || typeof url !== "string") {
		return JSON.stringify({ ok: false, error: "URL is required" });
	}

	const validation = filterUrl(url, []);
	if (!validation.allowed) {
		return JSON.stringify({ ok: false, error: `URL rejected: ${validation.reason}` });
	}

	const widthLimit = maxWidth || config.image?.maxWidth || 1024;
	const sizeLimit = config.image?.maxSize || 100000;

	let browser;
	try {
		browser = await launch({ timeout });
		const page = await open(browser, timeout);
		await page.goto(url, { waitUntil: "networkidle0", timeout });
		let data = await page.screenshot({ fullPage: true, encoding: "base64" });
		await page.close();
		data = await resize(data, widthLimit, sizeLimit);
		const filename = `screenshot-${Date.now()}.png`;
		const dir = join(config.cwd, config.memory.screenshotsDir);
		await ensureScreenshotsDir(config.memory.screenshotsDir, config.cwd);
		const path = join(dir, filename);
		await writeFile(path, Buffer.from(data, "base64"));
		return JSON.stringify({ ok: true, mimeType: "image/png", path });
	} catch (err) {
		return JSON.stringify({ ok: false, error: `Screenshot failed: ${err.message}` });
	} finally {
		if (browser) {
			await browser.close().catch(() => {});
		}
	}
}

/// -- Tool definitions --

/**
 * @param {z.infer<typeof WebSearchSchema>} input - Tool input with query
 * @returns {string} JSON result string
 */
export const searchWeb = tool(searchWebImpl, {
	name: "searchWeb",
	description:
		"Search the web. Built-in engines: DuckDuckGo (default), Bing (requires BING_API_KEY), SearXNG (requires SEARXNG_URL), Custom (requires CUSTOM_SEARCH_URL).",
	schema: z.object({
		query: z.string().min(1).describe("Search query"),
		limit: z
			.number()
			.int()
			.min(1)
			.max(100)
			.optional()
			.describe("Max results to return (default: 5)"),
	}),
});

/**
 * @param {z.infer<typeof WebExtractSchema>} input - Tool input with URL
 * @param {object} _options - Runtime options
 * @returns {string} JSON result string
 */
export const extractWeb = tool(extractWebImpl, {
	name: "extractWeb",
	description: "Extract readable text content from a web page URL.",
	schema: z.object({
		url: z.string().url().describe("URL to extract content from"),
		summarizeLarge: z
			.boolean()
			.optional()
			.describe("Summarize when page exceeds 10,000 characters"),
	}),
});

/**
 * @param {z.infer<typeof RenderWebSchema>} input - Tool input with URL
 * @returns {string} JSON result string
 */
export const renderWeb = tool(renderWebImpl, {
	name: "renderWeb",
	description:
		"Render a URL in headless Chromium and return the JS-aware extracted text. " +
		"Use this for JavaScript-heavy pages (SPAs, dashboards, paywalled content) that " +
		"a plain fetch() cannot see. Validates the URL against the sandbox allowlist.",
	schema: z.object({
		url: z.string().url().describe("URL to render"),
		timeout: z
			.number()
			.int()
			.min(1000)
			.optional()
			.describe("Per-call timeout in milliseconds (default: 30000)"),
	}),
});

/**
 * @param {z.infer<typeof ScreenshotWebSchema>} input - Tool input with URL
 * @returns {string} JSON result string
 */
export const screenshotWeb = tool(screenshotWebImpl, {
	name: "screenshotWeb",
	description:
		"Render a URL in headless Chromium, save the PNG screenshot to disk under " +
		"memory/screenshots/, and return the file path plus MIME type. Feed the " +
		"returned path to readImage for vision analysis. Validates the URL against " +
		"the sandbox allowlist. Resizes the screenshot to maxWidth (default 1024) " +
		"so it stays consumable by readImage's image.maxSize limit.",
	schema: z.object({
		url: z.string().url().describe("URL to render"),
		timeout: z
			.number()
			.int()
			.min(1000)
			.optional()
			.describe("Per-call timeout in milliseconds (default: 30000)"),
		maxWidth: z
			.number()
			.int()
			.positive()
			.optional()
			.describe("Max screenshot width in pixels (default: 1024)"),
	}),
});
