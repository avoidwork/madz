import { readFile, stat, readdir } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { chunkContent } from "./chunker.js";

/**
 * Default glob patterns for files to include/exclude during indexing.
 */
const DEFAULT_INCLUDE = ["src/**/*.js", "src/**/*.mjs", "src/**/*.cjs"];
const DEFAULT_EXCLUDE = ["node_modules/**", ".git/**", ".worktrees/**", "coverage/**", "dist/**"];

/**
 * Known binary file extensions to skip.
 */
const BINARY_EXTENSIONS = new Set([
	".png",
	".jpg",
	".jpeg",
	".gif",
	".ico",
	".svg",
	".woff",
	".woff2",
	".ttf",
	".eot",
	".zip",
	".gz",
	".tar",
	".7z",
	".rar",
	".pdf",
	".doc",
	".docx",
	".xls",
	".xlsx",
	".ppt",
	".pptx",
	".mp3",
	".mp4",
	".avi",
	".mov",
	".wav",
	".o",
	".so",
	".dll",
	".dylib",
	".exe",
]);

/**
 * Mtime cache file path (stored alongside the vector DB).
 */
function mtimeCachePath(dbPath) {
	return dbPath.replace(/\.db$/, "") + "-mtimes.json";
}

/**
 * Load the mtime cache from disk.
 * @param {string} dbPath - Path to the vector database
 * @returns {Record<string, number>}
 */
function loadMtimeCache(dbPath) {
	const cacheFile = mtimeCachePath(dbPath);
	try {
		return JSON.parse(readFileSync(cacheFile, "utf-8"));
	} catch {
		return {};
	}
}

/**
 * Save the mtime cache to disk.
 * @param {string} dbPath - Path to the vector database
 * @param {Record<string, number>} cache - Mtime cache
 */
function saveMtimeCache(dbPath, cache) {
	const cacheFile = mtimeCachePath(dbPath);
	writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
}

/**
 * Check if a file extension is binary.
 * @param {string} ext - File extension
 * @returns {boolean}
 */
function isBinaryExtension(ext) {
	return BINARY_EXTENSIONS.has(ext.toLowerCase());
}

/**
 * Check if a path matches a glob pattern (supports **, *, and leading directory).
 * @param {string} pattern - Glob pattern (e.g., "src/**\/*.js")
 * @param {string} path - Relative path to check
 * @returns {boolean}
 */
function matchesGlob(pattern, path) {
	// Convert glob pattern to regex
	let regexStr = "^";
	let i = 0;
	while (i < pattern.length) {
		const ch = pattern[i];
		if (ch === "*" && pattern[i + 1] === "*" && pattern[i + 2] === "/") {
			regexStr += "(.*/)?";
			i += 3;
		} else if (ch === "*") {
			regexStr += "[^/]*";
			i += 1;
		} else if (ch === ".") {
			regexStr += "\\.";
			i += 1;
		} else if (ch === "?") {
			regexStr += "[^/]";
			i += 1;
		} else {
			regexStr += ch;
			i += 1;
		}
	}
	regexStr += "$";
	return new RegExp(regexStr).test(path);
}

/**
 * Check if a path should be excluded based on exclude patterns.
 * @param {string} relPath - Relative path
 * @param {string[]} excludePatterns - Exclude patterns
 * @returns {boolean}
 */
function isExcluded(relPath, excludePatterns) {
	return excludePatterns.some((pattern) => matchesGlob(pattern, relPath));
}

/**
 * Recursively scan a directory for source files matching include/exclude patterns.
 *
 * @param {string} rootDir - Root directory to scan
 * @param {string[]} includePatterns - Glob patterns for files to include
 * @param {string[]} excludePatterns - Glob patterns for files to exclude
 * @returns {Promise<string[]>} Array of file paths relative to rootDir
 */
async function scanFiles(rootDir, includePatterns, excludePatterns) {
	const files = [];

	async function walk(dir) {
		let entries;
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch {
			return;
		}

		for (const entry of entries) {
			const fullPath = join(dir, entry.name);
			const relPath = relative(rootDir, fullPath);

			// Skip hidden files/directories
			if (entry.name.startsWith(".")) {
				continue;
			}

			if (entry.isDirectory()) {
				// Check if directory itself is excluded
				if (isExcluded(relPath + "/", excludePatterns)) {
					continue;
				}
				await walk(fullPath);
			} else if (entry.isFile()) {
				const ext = extname(entry.name).toLowerCase();

				// Skip binary extensions
				if (isBinaryExtension(ext)) {
					continue;
				}

				// Check exclusion
				if (isExcluded(relPath, excludePatterns)) {
					continue;
				}

				// Check inclusion
				const matchesInclude = includePatterns.some((pattern) => matchesGlob(pattern, relPath));
				if (matchesInclude) {
					files.push(relPath);
				}
			}
		}
	}

	await walk(rootDir);
	return files.sort();
}

/**
 * Index project source files into the vector store.
 *
 * @param {object} store - Vector store instance (from createVectorStore)
 * @param {object} embedder - Embedder instance (from createEmbedder)
 * @param {object} options - Indexing options
 * @param {string} options.rootDir - Project root directory
 * @param {number} [options.chunkSize=96] - Lines per chunk
 * @param {number} [options.chunkOverlap=16] - Overlap between chunks
 * @param {number} [options.maxFileSize=524288] - Max file size in bytes
 * @param {string[]} [options.include] - Include patterns
 * @param {string[]} [options.exclude] - Exclude patterns
 * @param {boolean} [options.force=false] - Force re-index all files
 * @param {function} [options.onProgress] - Progress callback (current, total, filePath)
 * @returns {Promise<{indexed: number, skipped: number, errors: number}>}
 */
export async function reindex(store, embedder, options) {
	const {
		rootDir,
		chunkSize = 96,
		chunkOverlap = 16,
		maxFileSize = 524288,
		include = DEFAULT_INCLUDE,
		exclude = DEFAULT_EXCLUDE,
		force = false,
		onProgress,
	} = options;

	const dbPath = store.dbPath;
	const mtimeCache = force ? {} : loadMtimeCache(dbPath);
	const files = await scanFiles(rootDir, include, exclude);

	let indexed = 0;
	let skipped = 0;
	let errors = 0;

	for (let i = 0; i < files.length; i++) {
		const relPath = files[i];
		const fullPath = join(rootDir, relPath);

		if (onProgress) {
			onProgress(i + 1, files.length, relPath);
		}

		try {
			const fileStat = await stat(fullPath);
			const mtime = fileStat.mtimeMs;

			// Skip if mtime hasn't changed (unless force)
			if (!force && mtimeCache[relPath] === mtime) {
				skipped++;
				continue;
			}

			// Skip files exceeding max size
			if (fileStat.size > maxFileSize) {
				skipped++;
				continue;
			}

			// Read and chunk the file
			const content = await readFile(fullPath, "utf-8");
			const chunks = chunkContent(relPath, content, chunkSize, chunkOverlap);

			if (chunks.length === 0) {
				skipped++;
				continue;
			}

			// Embed all chunks
			const texts = chunks.map((c) => c.content);
			const embeddings = await embedder.embed(texts);

			// Prepare chunks with embeddings for the store
			const storeChunks = chunks.map((c, idx) => ({
				...c,
				embedding: embeddings[idx],
			}));

			// Remove old chunks for this file, then insert new ones
			store.removeFile(relPath);
			store.insertChunks(storeChunks);

			// Update mtime cache
			mtimeCache[relPath] = mtime;
			indexed++;
		} catch (err) {
			process.stderr.write(`Error indexing ${relPath}: ${err.message}\n`);
			errors++;
		}
	}

	// Save mtime cache
	saveMtimeCache(dbPath, mtimeCache);

	return { indexed, skipped, errors };
}

export { scanFiles };
