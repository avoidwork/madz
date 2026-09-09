import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { loadConfig } from "../../config/loader.js";
import { createVectorStore } from "../../vector/store.js";
import { createEmbedder } from "../../vector/embedder.js";

const config = loadConfig();
const vectorConfig = config.vector || {};

/**
 * Search source code using vector similarity search.
 *
 * Embeds the query using the configured embedding provider, then performs
 * a KNN search against the sqlite-vec vector store to find semantically
 * similar code chunks.
 *
 * @param {z.infer<typeof CodeSearchSchema>} input - The tool input
 * @param {object} [options] - Runtime options for test injection
 * @param {object} [options.vector] - Vector config override (for testing)
 * @returns {Promise<string>} Formatted search results
 */
export async function codeSearchImpl(input, options = {}) {
	const cfg = options.vector || vectorConfig;
	const dbPath = cfg.dbPath || "memory/vector.db";

	let store;
	try {
		store = await createVectorStore(dbPath);
		store.init();
	} catch (err) {
		return `Failed to open vector store at ${dbPath}: ${err.message}`;
	}

	try {
		// Create embedder
		const embedder = createEmbedder({
			model: cfg.model || "local",
			openaiApiKey: cfg.openaiApiKey || options.openaiApiKey,
		});

		// Embed the query
		let embeddings;
		try {
			embeddings = await embedder.embed([input.query]);
		} catch (err) {
			store.close();
			return `Failed to embed query: ${err.message}`;
		}

		if (embeddings.length === 0) {
			store.close();
			return "No embedding generated for the query.";
		}

		// Search
		const topK = input.topK || 5;
		let results;
		try {
			results = store.search(embeddings[0], topK);
		} catch (err) {
			store.close();
			return `Search failed: ${err.message}`;
		}

		store.close();

		if (results.length === 0) {
			return "No matching code found. Try re-indexing with `--index-code` first.";
		}

		// Apply file filter if specified
		if (input.fileFilter) {
			const filterPattern = input.fileFilter.replace(/\*/g, ".*");
			const filterRe = new RegExp(filterPattern);
			results = results.filter((r) => filterRe.test(r.filePath));
		}

		if (results.length === 0) {
			return `No results matching filter "${input.fileFilter}".`;
		}

		// Format results
		const lines = results.map(
			(r, i) =>
				`${i + 1}. ${r.filePath}:${r.lineStart}-${r.lineEnd} (distance: ${r.distance.toFixed(4)})\n` +
				"```\n" +
				r.content +
				"\n```",
		);

		return lines.join("\n\n");
	} finally {
		if (store) {
			try {
				store.close();
			} catch {
				// Ignore close errors
			}
		}
	}
}

export const codeSearch = tool(codeSearchImpl, {
	name: "codeSearch",
	description:
		"Search project source code using vector similarity. " +
		"Embeds a natural language query and returns semantically similar code chunks " +
		"with file paths, line numbers, and similarity scores. " +
		"Useful for finding relevant code during debugging or feature implementation.",
	schema: z.object({
		query: z.string().min(1).describe("Natural language query describing the code to find"),
		topK: z.number().int().positive().max(50).default(5).describe("Number of results to return"),
		fileFilter: z
			.string()
			.optional()
			.describe("Optional glob pattern to filter results by file path (e.g., 'src/tools/*.js')"),
	}),
});
