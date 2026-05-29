import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { filterUrl } from "../sandbox/urlFilter.js";

/// -- Backend selection --

/**
 * Detect which search API is configured from environment variables.
 * Priority: Exa > Firecrawl > Tavily > Parallel.
 * @returns {string} Backend name or "none"
 */
export function detectSearchBackend() {
	if (process.env.EXA_API_KEY) return "exa";
	if (process.env.FIRECRAWL_API_KEY) return "firecrawl";
	if (process.env.TAVILY_API_KEY) return "tavily";
	if (process.env.PARALLEL_API_KEY) return "parallel";
	return "none";
}

/// -- Exa backend --

/**
 * Search using Exa API.
 * @param {string} apiKey
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<{ ok: boolean, results?: unknown[], error?: string }>}
 */
async function searchWithExa(apiKey, query, limit) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 10000);
	try {
		const resp = await fetch("https://api.exa.ai/search", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				query,
				type: "neural",
				numResults: Math.min(Math.max(limit, 1), 5),
				useAutoQuery: true,
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
				title: r.title || r.text?.slice(0, 100) || "Untitled",
				url: r.url || "",
				description: r.text?.slice(0, 500) || "",
			})),
		};
	} catch (err) {
		clearTimeout(timeoutId);
		return { ok: false, error: `Exa request failed: ${err.message}` };
	}
}

/// -- Firecrawl backend --

/**
 * Search using Firecrawl API.
 * @param {string} apiKey
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<{ ok: boolean, results?: unknown[], error?: string }>}
 */
async function searchWithFirecrawl(apiKey, query, limit) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 10000);
	try {
		const resp = await fetch("https://api.firecrawl.dev/v1/search", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				query,
				limit: Math.min(Math.max(limit, 1), 5),
			}),
			signal: controller.signal,
		});
		clearTimeout(timeoutId);
		if (!resp.ok) {
			const text = await resp.text().catch(() => "");
			return { ok: false, error: `Firecrawl API error (${resp.status}): ${text.slice(0, 200)}` };
		}
		const data = await resp.json();
		const pages = data.data || [];
		return {
			ok: true,
			results: pages.slice(0, limit).map((p) => ({
				title: p.metadata?.title || "Untitled",
				url: p.metadata?.sourceURL || p.metadata?.url || "",
				description: p.markdown?.slice(0, 500) || "",
			})),
		};
	} catch (err) {
		clearTimeout(timeoutId);
		return { ok: false, error: `Firecrawl request failed: ${err.message}` };
	}
}

/// -- Tavily backend --

/**
 * Search using Tavily API.
 * @param {string} apiKey
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<{ ok: boolean, results?: unknown[], error?: string }>}
 */
async function searchWithTavily(apiKey, query, limit) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 10000);
	try {
		const resp = await fetch("https://api.tavily.com/search", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				query,
				max_results: Math.min(Math.max(limit, 1), 10),
				include_answer: false,
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
				description: r.content?.slice(0, 500) || "",
			})),
		};
	} catch (err) {
		clearTimeout(timeoutId);
		return { ok: false, error: `Tavily request failed: ${err.message}` };
	}
}

/// -- Parallel backend --

/**
 * Fallback parallel search when no API keys are configured.
 * Uses a simple HTML fetch and basic text extraction.
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<{ ok: boolean, results?: unknown[], error?: string }>}
 */
/* node:coverage ignore next */
async function searchWithParallel(query, limit) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 10000);
	try {
		const resp = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
			signal: controller.signal,
		});
		clearTimeout(timeoutId);
		if (!resp.ok) {
			return { ok: false, error: `Parallel search HTTP error: ${resp.status}` };
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
			return { ok: false, error: "Parallel search returned no results" };
		}
		return { ok: true, results };
	} catch (err) {
		clearTimeout(timeoutId);
		return { ok: false, error: `Parallel search failed: ${err.message}` };
	}
}

/// -- Core search --

/**
 * Execute web search using the detected API backend.
 * @param {object} input - Tool input
 * @param {object} _options - Runtime options (unused)
 * @returns {Promise<string>} JSON result string
 */
export async function webSearchImpl(input, _options) {
	const { query, limit = 5 } = input;

	if (!query || typeof query !== "string" || query.trim().length === 0) {
		return JSON.stringify({ ok: false, error: "Query is required and must be a non-empty string" });
	}

	const clampedLimit = Math.min(Math.max(Number(limit) || 5, 1), 100);

	const backend = detectSearchBackend();

	if (backend === "none") {
		return JSON.stringify({
			ok: false,
			error:
				"No search API key configured. Set EXA_API_KEY, FIRECRAWL_API_KEY, TAVILY_API_KEY, or PARALLEL_API_KEY. " +
				"Available keys: " +
				[
					process.env.EXA_API_KEY && "EXA_API_KEY",
					process.env.FIRECRAWL_API_KEY && "FIRECRAWL_API_KEY",
					process.env.TAVILY_API_KEY && "TAVILY_API_KEY",
					process.env.PARALLEL_API_KEY && "PARALLEL_API_KEY",
				]
					.filter(Boolean)
					.join(", "),
		});
	}

	let result;

	switch (backend) {
		case "exa":
			result = await searchWithExa(process.env.EXA_API_KEY, query, clampedLimit);
			break;
		case "firecrawl":
			result = await searchWithFirecrawl(process.env.FIRECRAWL_API_KEY, query, clampedLimit);
			break;
		case "tavily":
			result = await searchWithTavily(process.env.TAVILY_API_KEY, query, clampedLimit);
			break;
		case "parallel":
			result = await searchWithParallel(query, clampedLimit);
			break;
	}

	if (!result.ok) {
		return JSON.stringify({ ok: false, error: result.error });
	}

	return JSON.stringify({
		ok: true,
		backend,
		query,
		results: result.results,
	});
}

/// -- Web extract --

/**
 * Extract content from a URL. Returns markdown for small pages (<5000 chars)
 * or a truncated summary for large pages (>10000 chars).
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
	const timeoutId = setTimeout(() => controller.abort(), 10000);

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
			return JSON.stringify({
				ok: false,
				error: "Page content too short or unreadable",
			});
		}

		let clean = html
			.replace(/<script[\s\S]*?<\/script>/gi, "")
			.replace(/<style[\s\S]*?<\/style>/gi, "")
			.replace(/<br\s*\/?>/gi, "\n")
			.replace(/<\/?(p|div|h[1-6]|li|tr)[^>]*>/gi, "\n")
			.replace(/<a[^>]*href="[^"]*"[^>]*>/gi, " [")
			.replace(/<\/a>/gi, "](")
			.replace(/<img[^>]*alt="([^"]*)"[^>]*\/?>/gi, "![${1}]()")
			.replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, "![]($1)")
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
				content: `[Large page (${html.length} chars) — summarize with your own LLM or set summarizeLarge=false]`,
				summary: clean || "[No extractable text content found]",
			});
		}

		return JSON.stringify({
			ok: true,
			url,
			contentLength: clean.length,
			content: clean,
		});
	} catch (err) {
		clearTimeout(timeoutId);
		return JSON.stringify({ ok: false, error: `Fetch failed: ${err.message}` });
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
		"Search the web for information using an available search API (Exa, Firecrawl, Tavily, or DuckDuckGo parallel fallback). Returns up to 100 results. Requires EXA_API_KEY, FIRECRAWL_API_KEY, TAVILY_API_KEY, or PARALLEL_API_KEY environment variable.",
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
	description:
		"Extract readable text content from a web page URL. Returns cleaned, stripped HTML as plain text. Large pages (>10,000 chars) are truncated unless minimizeLargePages is true.",
	schema: z.object({
		url: z.string().url().describe("URL to extract content from"),
		summarizeLarge: z
			.boolean()
			.optional()
			.describe(
				"Summarize (vs return full text) when page exceeds 10,000 characters (default: false)",
			),
	}),
});

// --- Factory functions for creating tools with runtime options ---

/**
 * Create a web_search tool with runtime options
 * @param {object} options - Runtime options
 * @returns {object} LangChain Tool instance
 */
export function createWebSearchTool(options) {
	return tool((input) => webSearchImpl(input, options), {
		name: "web_search",
		description:
			"Search the web for information using an available search API (Exa, Firecrawl, Tavily, or DuckDuckGo parallel fallback). Returns up to 100 results.",
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
 * @param {object} options - Runtime options
 * @returns {object} LangChain Tool instance
 */
export function createWebExtractTool(options) {
	return tool((input) => webExtractImpl(input, options), {
		name: "web_extract",
		description:
			"Extract readable text content from a web page URL. Returns cleaned, stripped HTML as plain text.",
		schema: z.object({
			url: z.string().url().describe("URL to extract content from"),
			summarizeLarge: z
				.boolean()
				.optional()
				.describe("Summarize (vs return full text) when page exceeds 10,000 characters"),
		}),
	});
}
