import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { filterUrl } from "../sandbox/urlFilter.js";

const FETCH_TIMEOUT = 10000;

/// -- DuckDuckGo (HTML scrape) --

/**
 * Search DuckDuckGo via HTML scrape.
 * @param {string} query - Search query
 * @param {number} limit - Max results
 * @returns {Promise<{ ok: boolean, results?: object[], error?: string }>}
 */
async function searchWithDuckDuckGo(query, limit) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
	try {
		const resp = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
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
	} catch {
		clearTimeout(timeoutId);
		return { ok: false, error: "DuckDuckGo search failed" };
	}
}

/// -- Google (HTML scrape) --

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
	} catch {
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
	} catch {
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
		const apiKey = cfg.apiKey || process.env.CUSTOM_API_KEY || "";
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
	} catch {
		clearTimeout(timeoutId);
		return { ok: false, error: "Custom search failed" };
	}
}

/// -- Backend selection --

/**
 * Detect which search engine is configured.
 * Priority: Custom (CUSTOM_SEARCH_URL) > Bing (BING_API_KEY) > SearXNG (SEARXNG_URL) > Google > DuckDuckGo.
 * @returns {string} Engine name or "none" (should never be none as DuckDuckGo always works)
 */
export function detectSearchBackend() {
	if (process.env.CUSTOM_SEARCH_URL) return "custom";
	if (process.env.BING_API_KEY) return "bing";
	if (process.env.SEARXNG_URL) return "searxng";
	return "duckduckgo"; // fallback, always available
}

/// -- Core search --

/**
 * Execute web search using the detected engine.
 * @param {object} input - Tool input
 * @param {object} _options - Runtime options
 * @returns {Promise<string>} JSON result string
 */
export async function webSearchImpl(input, _options) {
	const { query, limit = 5 } = input;

	if (!query || typeof query !== "string" || query.trim().length === 0) {
		return JSON.stringify({ ok: false, error: "Query is required and must be a non-empty string" });
	}

	const clampedLimit = Math.min(Math.max(Number(limit) || 5, 1), 100);
	const backend = detectSearchBackend();
	let result;

	switch (backend) {
		case "bing":
			result = await searchWithBing(process.env.BING_API_KEY, query, clampedLimit);
			break;
		case "searxng":
			result = await searchWithSearXNG(process.env.SEARXNG_URL, query, clampedLimit);
			break;
		case "custom":
			result = await searchWithCustom(
				{
					url: process.env.CUSTOM_SEARCH_URL,
					method: process.env.CUSTOM_SEARCH_METHOD,
					body: process.env.CUSTOM_SEARCH_BODY,
					headers: process.env.CUSTOM_SEARCH_HEADERS,
					queryKey:
						process.env.CUSTOM_SEARCH_QUERY_KEY || process.env.CUSTOM_RESULT_KEY || "results",
					titleField: process.env.CUSTOM_TITLE_FIELD || "title",
					urlField: process.env.CUSTOM_URL_FIELD || "url",
					descriptionField: process.env.CUSTOM_DESCRIPTION_FIELD || "description",
					apiKey: process.env.CUSTOM_API_KEY,
				},
				query,
				clampedLimit,
			);
			break;
		case "duckduckgo":
		default:
			result = await searchWithDuckDuckGo(query, clampedLimit);
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
 * @param {object} _options - Runtime options
 * @returns {Promise<string>} JSON result string
 */
export async function webExtractImpl(input, _options) {
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
	} catch {
		clearTimeout(timeoutId);
		return JSON.stringify({ ok: false, error: "Fetch failed" });
	}
}

/// -- Tool definitions --

/**
 * @param {z.infer<typeof WebSearchSchema>} input - Tool input with query
 * @param {object} _options - Runtime options
 * @returns {string} JSON result string
 */
export const web_search = tool(webSearchImpl, {
	name: "web_search",
	description:
		"Search the web. Built-in engines: DuckDuckGo (default), Google, Bing (requires BING_API_KEY), SearXNG (requires SEARXNG_URL), Custom (requires CUSTOM_SEARCH_URL).",
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
export const web_extract = tool(webExtractImpl, {
	name: "web_extract",
	description: "Extract readable text content from a web page URL.",
	schema: z.object({
		url: z.string().url().describe("URL to extract content from"),
		summarizeLarge: z
			.boolean()
			.optional()
			.describe("Summarize when page exceeds 10,000 characters"),
	}),
});

// --- Factory functions ---

/**
 * Create a web_search tool with runtime options
 * @param {object} options - Runtime options (unused placeholder)
 * @returns {object} LangChain Tool
 */
export function createWebSearchTool(options) {
	return tool((input) => webSearchImpl(input, options), {
		name: "web_search",
		description: "Search the web using DuckDuckGo, Google, Bing, SearXNG, or Custom endpoint.",
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
}

/**
 * Create a web_extract tool with runtime options
 * @param {object} options - Runtime options (unused placeholder)
 * @returns {object} LangChain Tool
 */
export function createWebExtractTool(options) {
	return tool((input) => webExtractImpl(input, options), {
		name: "web_extract",
		description: "Extract readable text content from a web page URL.",
		schema: z.object({
			url: z.string().url().describe("URL to extract content from"),
			summarizeLarge: z
				.boolean()
				.optional()
				.describe("Summarize when page exceeds 10,000 characters"),
		}),
	});
}
