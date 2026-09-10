import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { loadConfig } from "../../config/loader.js";
import { createVectorStore } from "../../vector/store.js";
import { createEmbedder } from "../../vector/embedder.js";
import { reindex } from "../../vector/indexer.js";

const config = loadConfig();
const vectorConfig = config.vector || {};

/**
 * Index project source code for vector search.
 *
 * Scans, chunks, embeds, and stores source files for one or all configured
 * projects. Runs incrementally — only processes changed files unless force is set.
 *
 * @param {z.infer<typeof CodeIndexSchema>} input - The tool input
 * @returns {Promise<string>} Formatted indexing results
 */
export async function codeIndexImpl(input) {
	const projects = vectorConfig.projects || {};

	if (Object.keys(projects).length === 0) {
		return "No vector projects configured in config.yaml under vector.projects.";
	}

	const embedder = createEmbedder({ model: vectorConfig.model || "local" });
	const projectNames = input.project ? [input.project] : Object.keys(projects);
	const results = [];

	for (const name of projectNames) {
		const proj = projects[name];
		if (!proj) {
			results.push(`Project "${name}" not found in config.`);
			continue;
		}

		try {
			const store = await createVectorStore(proj.dbPath, {
				fulltext: proj.fulltext || false,
				ftsTokenize: proj.ftsTokenize || "porter unicode61",
			});
			await store.init();

			const result = await reindex(store, embedder, {
				rootDir: proj.rootDir || ".",
				include: proj.include || ["src/**/*.js", "src/**/*.mjs", "src/**/*.cjs"],
				exclude: proj.exclude || ["node_modules/**", ".git/**", ".worktrees/**"],
				chunkSize: proj.chunkSize || 96,
				chunkOverlap: proj.chunkOverlap || 16,
				maxFileSize: proj.maxFileSize || 524288,
				force: input.force || false,
			});

			store.close();
			results.push(
				`${name}: ${result.indexed} indexed, ${result.skipped} skipped, ${result.errors} errors`,
			);
		} catch (err) {
			results.push(`${name}: error — ${err.message}`);
		}
	}

	return results.join("\n");
}

export const codeIndex = tool(codeIndexImpl, {
	name: "codeIndex",
	description:
		"Index project source code for vector search. " +
		"Scans configured project directories, chunks source files, generates embeddings, " +
		"and stores them for semantic search via codeSearch. " +
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
