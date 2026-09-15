import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { Piscina } from "piscina";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadConfig } from "../../config/loader.js";

const config = loadConfig();
const vectorConfig = config.vector || {};

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Piscina worker pool for the indexCode tool.
 *
 * Runs the indexing work (scan, chunk, embed, store) off the main event loop.
 * The worker entry file (`src/vector/indexer.worker.js`) accepts plain project
 * config and creates the vector store + embedder internally, since those
 * instances wrap native handles that are not structured-cloneable across
 * worker threads.
 */
export const pool = new Piscina({
	filename: join(__dirname, "../../vector/indexer.worker.js"),
});

/**
 * Index project source code for vector search.
 *
 * Scans, chunks, embeds, and stores source files for one or all configured
 * projects. Runs incrementally — only processes changed files unless force is set.
 * The indexing work is dispatched to a Piscina worker pool to avoid blocking the
 * main event loop.
 *
 * @param {z.infer<typeof CodeIndexSchema>} input - The tool input
 * @param {object} [options] - Runtime options for test injection
 * @param {object} [options.vector] - Vector config override (for testing)
 * @returns {Promise<string>} Formatted indexing results
 */
export async function indexCodeImpl(input, options = {}) {
	const cfg = options.vector || vectorConfig;
	const projects = cfg.projects || {};

	if (Object.keys(projects).length === 0) {
		return "No vector projects configured in config.yaml under vector.projects.";
	}

	const projectNames = input.project ? [input.project] : Object.keys(projects);
	const results = [];

	for (const name of projectNames) {
		const proj = projects[name];
		if (!proj) {
			results.push(`Project "${name}" not found in config.`);
			continue;
		}

		try {
			const result = await pool.run({
				dbPath: proj.dbPath,
				rootDir: proj.rootDir || ".",
				include: proj.include || ["src/**/*.js", "src/**/*.mjs", "src/**/*.cjs"],
				exclude: proj.exclude || ["node_modules/**", ".git/**", ".worktrees/**"],
				chunkSize: proj.chunkSize || 96,
				chunkOverlap: proj.chunkOverlap || 16,
				maxFileSize: proj.maxFileSize || 524288,
				force: input.force || false,
				model: cfg.model || "local",
				openaiApiKey: cfg.openaiApiKey || options.openaiApiKey,
				fulltext: cfg.fulltext !== false,
				ftsTokenize: cfg.ftsTokenize || "porter unicode61",
			});

			results.push(
				`${name}: ${result.indexed} indexed, ${result.skipped} skipped, ${result.errors} errors`,
			);
		} catch (err) {
			results.push(`${name}: error — ${err.message}`);
		}
	}

	return results.join("\n");
}

export const indexCode = tool(indexCodeImpl, {
	name: "indexCode",
	description:
		"Index project source code for vector search. " +
		"Scans configured project directories, chunks source files, generates embeddings, " +
		"and stores them for semantic search via searchCode. " +
		"Runs incrementally — only processes changed files. " +
		"Use this after adding new code or changing project configuration.",
	schema: z.object({
		project: z
			.string()
			.optional()
			.describe(
				"Project name to index (as configured in vector.projects). Indexes all projects if omitted.",
			),
		force: z.boolean().default(false).describe("Force re-index all files, ignoring mtime cache"),
	}),
});
