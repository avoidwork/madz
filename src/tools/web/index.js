import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { loadConfig } from "../../config/loader.js";

const config = loadConfig();

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

/// -- Tavily --

/**
 * Search using Tavily API.
 * @param {string} apiKey - Tavily API key
 * @param {string} query - Search query
 * @param {number} limit - Max results
 * @returns {Promise<{ ok: boolean, results?: object[], error?: string }>}
 */
export async function searchWithTavily(apiKey, query, limit) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
	try {
		const resp = await fetch("https://api.tavily.com/search", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				query,
				search_depth: "basic",
				max_results: Math.min(Math.max(limit, 1), 100),
			}),
			signal: controller.signal,
		});
		clearTimeout(timeoutId);
		if (!resp.ok) {
			const text = await resp.text().catch(() => "");
			return { ok: false, error: `Tavily API error (${resp.status}): ${text.slice(0, 200)}` };
		}
		const data = await resp.json();
		return {
			ok: true,
			results: (data.results || []).slice(0, limit).map((r) => ({
				title: r.title || "Untitled",
				url: r.url || "",
				description: r.content || "",
			})),
		};
	} catch (_err) {
		clearTimeout(timeoutId);
		return { ok: false, error: "Tavily search failed" };
	}
}

/// -- Exa --

/**
 * Search using Exa API.
 * @param {string} apiKey - Exa API key
 * @param {string} query - Search query
 * @param {number} limit - Max results
 * @returns {Promise<{ ok: boolean, results?: object[], error?: string }>}
 */
export async function searchWithExa(apiKey, query, limit) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
	try {
		const resp = await fetch("https://api.exa.ai/search", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": apiKey,
			},
			body: JSON.stringify({
				query,
				type: "auto",
				numResults: Math.min(Math.max(limit, 1), 100),
			}),
			signal: controller.signal,
		});
		clearTimeout(timeoutId);
		if (!resp.ok) {
			const text = await resp.text().catch(() => "");
			return { ok: false, error: `Exa API error (${resp.status}): ${text.slice(0, 200)}` };
		}
		const data = await resp.json();
		return {
			ok: true,
			results: (data.results || []).slice(0, limit).map((r) => ({
				title: r.title || "Untitled",
				url: r.url || "",
				description: r.text || r.highlights?.[0] || "",
			})),
		};
	} catch (_err) {
		clearTimeout(timeoutId);
		return { ok: false, error: "Exa search failed" };
	}
}

/// -- Brave --

/**
 * Search using Brave Search API.
 * @param {string} apiKey - Brave subscription token
 * @param {string} query - Search query
 * @param {number} limit - Max results
 * @returns {Promise<{ ok: boolean, results?: object[], error?: string }>}
 */
export async function searchWithBrave(apiKey, query, limit) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
	try {
		const url = new URL("https://api.search.brave.com/res/v1/web/search");
		url.searchParams.set("q", query);
		url.searchParams.set("count", String(Math.min(Math.max(limit, 1), 100)));
		const resp = await fetch(url, {
			method: "GET",
			headers: { "X-Subscription-Token": apiKey },
			signal: controller.signal,
		});
		clearTimeout(timeoutId);
		if (!resp.ok) {
			const text = await resp.text().catch(() => "");
			return { ok: false, error: `Brave API error (${resp.status}): ${text.slice(0, 200)}` };
		}
		const data = await resp.json();
		return {
			ok: true,
			results: (data.web?.results || []).slice(0, limit).map((r) => ({
				title: r.title || "Untitled",
				url: r.url || "",
				description: r.description || "",
			})),
		};
	} catch (_err) {
		clearTimeout(timeoutId);
		return { ok: false, error: "Brave search failed" };
	}
}

/// -- Firecrawl --

/**
 * Search using Firecrawl API.
 * @param {string} apiKey - Firecrawl API key
 * @param {string} query - Search query
 * @param {number} limit - Max results
 * @returns {Promise<{ ok: boolean, results?: object[], error?: string }>}
 */
export async function searchWithFirecrawl(apiKey, query, limit) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
	try {
		const resp = await fetch("https://api.firecrawl.dev/v2/search", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				query,
				limit: Math.min(Math.max(limit, 1), 100),
				sources: ["web"],
			}),
			signal: controller.signal,
		});
		clearTimeout(timeoutId);
		if (!resp.ok) {
			const text = await resp.text().catch(() => "");
			return { ok: false, error: `Firecrawl API error (${resp.status}): ${text.slice(0, 200)}` };
		}
		const data = await resp.json();
		return {
			ok: true,
			results: (data.web || []).slice(0, limit).map((r) => ({
				title: r.title || "Untitled",
				url: r.url || "",
				description: r.description || "",
			})),
		};
	} catch (_err) {
		clearTimeout(timeoutId);
		return { ok: false, error: "Firecrawl search failed" };
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
 * Priority: Custom (CUSTOM_SEARCH_URL) > Bing (BING_API_KEY) > Tavily (TAVILY_API_KEY) > SearXNG (SEARXNG_URL) > DuckDuckGo.
 * @param {object} [options] - Config object (defaults to module-level config)
 * @returns {string} Engine name or "none" (should never be none as DuckDuckGo always works)
 */
export function detectSearchBackend(options = config) {
	const search = options?.search || config.search || {};
	const custom = search.custom || {};
	if (custom?.url) return "custom";
	if (search?.bing?.apiKey) return "bing";
	if (search?.tavily?.apiKey) return "tavily";
	if (search?.exa?.apiKey) return "exa";
	if (search?.brave?.apiKey) return "brave";
	if (search?.firecrawl?.apiKey) return "firecrawl";
	if (search?.searxng?.url) return "searxng";
	return "duckduckgo"; // fallback, always available
}

/// -- Core search --

/**
 * Execute web search using the detected engine.
 * @param {object} input - Tool input
 * @param {object} [options] - Config object (defaults to module-level config)
 * @returns {Promise<object>} Structured result object
 */
export async function searchWebImpl(input, options = config) {
	const { query, limit = 5 } = input;

	if (!query || typeof query !== "string" || query.trim().length === 0) {
		return { ok: false, error: "Query is required and must be a non-empty string" };
	}

	const clampedLimit = Math.min(Math.max(Number(limit) || 5, 1), 100);
	const search = options?.search || config.search || {};
	const backend = detectSearchBackend(options);
	const bing = search?.bing || {};
	const searxng = search?.searxng || {};
	const custom = search?.custom || {};
	const duckduckgo = search?.duckduckgo || {};
	const tavily = search?.tavily || {};
	const exa = search?.exa || {};
	const brave = search?.brave || {};
	const firecrawl = search?.firecrawl || {};
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
		case "tavily":
			result = await searchWithTavily(tavily.apiKey, query, clampedLimit);
			break;
		case "exa":
			result = await searchWithExa(exa.apiKey, query, clampedLimit);
			break;
		case "brave":
			result = await searchWithBrave(brave.apiKey, query, clampedLimit);
			break;
		case "firecrawl":
			result = await searchWithFirecrawl(firecrawl.apiKey, query, clampedLimit);
			break;
		case "duckduckgo":
		default:
			result = await searchWithDuckDuckGo(query, clampedLimit, duckduckgo);
	}

	if (!result.ok) {
		return { ok: false, error: result.error };
	}

	return { ok: true, backend, query, results: result.results };
}

/// -- Tool definitions --

/**
 * @param {z.infer<typeof WebSearchSchema>} input - Tool input with query
 * @returns {object} Structured result object
 */
export const searchWeb = tool(searchWebImpl, {
	name: "searchWeb",
	description:
		"Search the web. Built-in engines: DuckDuckGo (default), Bing (requires BING_API_KEY), SearXNG (requires SEARXNG_URL), Custom (requires CUSTOM_SEARCH_URL), Tavily (requires TAVILY_API_KEY), Exa (requires EXA_API_KEY), Brave (requires BRAVE_API_KEY), Firecrawl (requires FIRECRAWL_API_KEY).",
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
