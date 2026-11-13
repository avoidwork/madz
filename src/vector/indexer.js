import { constants as fsConstants } from "node:fs";
import { open, readdir, realpath, rename, writeFile, readFile, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, relative, sep } from "node:path";
import { chunkContent } from "./chunker.js";
import {
	DEFAULT_EXCLUDE,
	DEFAULT_INCLUDE,
	debug,
	getDefaultMaxFileSize,
	hasNullBytes,
	isBinaryPath,
	isSecretFile,
	warn,
} from "./fileFilters.js";

export { DEFAULT_EXCLUDE, DEFAULT_INCLUDE };

const CONFIG_HASH_KEY = "__configHash__";
const SAVE_EVERY = 25;
const O_NOFOLLOW = fsConstants.O_NOFOLLOW ?? 0;

/**
 * Mtime cache file path (stored alongside the vector DB).
 * @param {string} dbPath - DB path
 * @returns {string}
 */
function mtimeCachePath(dbPath) {
	return dbPath.replace(/\.db$/, "") + "-mtimes.json";
}

/**
 * Load the mtime cache from disk.
 * @param {string} dbPath - Path to the vector database
 * @returns {Promise<Record<string, number|string>>}
 */
async function loadMtimeCache(dbPath) {
	const cacheFile = mtimeCachePath(dbPath);
	try {
		return JSON.parse(await readFile(cacheFile, "utf-8"));
	} catch (err) {
		if (err?.code !== "ENOENT") {
			warn(`could not load mtime cache ${cacheFile}: ${err.message}; starting fresh`);
		}
		return {};
	}
}

/**
 * Save the mtime cache atomically (temp file + rename).
 * @param {string} dbPath - Path to the vector database
 * @param {Record<string, number|string>} cache - Mtime cache
 */
async function saveMtimeCache(dbPath, cache) {
	const cacheFile = mtimeCachePath(dbPath);
	const tmp = `${cacheFile}.${process.pid}.${Date.now()}.tmp`;
	try {
		await writeFile(tmp, JSON.stringify(cache, null, 2));
		await rename(tmp, cacheFile);
	} catch (err) {
		await unlink(tmp).catch(() => {});
		throw err;
	}
}

/**
 * Compile a glob pattern into a RegExp. Supports `**`, `*`, `?`; everything
 * else is matched literally. Patterns match against `/`-separated paths.
 * @param {string} pattern - Glob pattern
 * @returns {RegExp}
 */
export function compileGlob(pattern) {
	const p = pattern.replace(/\\/g, "/");
	let re = "^";
	let i = 0;
	while (i < p.length) {
		const ch = p[i];
		if (ch === "*" && p[i + 1] === "*") {
			if (p[i + 2] === "/") {
				re += "(?:.*/)?";
				i += 3;
			} else {
				re += ".*";
				i += 2;
			}
		} else if (ch === "*") {
			re += "[^/]*";
			i += 1;
		} else if (ch === "?") {
			re += "[^/]";
			i += 1;
		} else {
			re += ch.replace(/[.+^${}()|[\]\\/-]/g, "\\$&");
			i += 1;
		}
	}
	return new RegExp(re + "$");
}

/** @param {string[]} patterns - Globs */
function compileAll(patterns) {
	return patterns.map(compileGlob);
}

/** @param {string} p - Path possibly using OS separators */
function toPosix(p) {
	return sep === "/" ? p : p.split(sep).join("/");
}

/**
 * Recursively scan a directory for source files matching include/exclude patterns.
 * Binary and secret-looking files are skipped.
 *
 * @param {string} rootDir - Root directory to scan
 * @param {string[]} includePatterns - Glob patterns for files to include
 * @param {string[]} excludePatterns - Glob patterns for files to exclude
 * @returns {Promise<string[]>} Array of file paths (POSIX separators) relative to rootDir
 */
async function scanFiles(rootDir, includePatterns, excludePatterns) {
	const files = [];
	const includes = compileAll(includePatterns);
	const excludes = compileAll(excludePatterns);
	const isExcluded = (rel) => excludes.some((re) => re.test(rel));

	async function walk(dir) {
		let entries;
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch (err) {
			debug(`readdir ${dir} failed: ${err.message}`);
			return;
		}

		for (const entry of entries) {
			const fullPath = join(dir, entry.name);
			const relPath = toPosix(relative(rootDir, fullPath));

			if (entry.name.startsWith(".")) continue;

			if (entry.isDirectory()) {
				if (isExcluded(relPath + "/")) continue;
				await walk(fullPath);
			} else if (entry.isFile()) {
				if (isBinaryPath(entry.name) || isSecretFile(entry.name)) continue;
				if (isExcluded(relPath)) continue;
				if (includes.some((re) => re.test(relPath))) {
					files.push(relPath);
				}
			}
		}
	}

	await walk(rootDir);
	return files.sort();
}

/**
 * Read a file only if it resolves inside the (real) root. Opens with
 * O_NOFOLLOW where supported.
 * @param {string} realRoot - realpath of the root directory
 * @param {string} fullPath - Candidate file path
 * @returns {Promise<{content: string, mtimeMs: number, size: number}|null>} null when skipped
 */
async function readConfined(realRoot, fullPath) {
	let real;
	try {
		real = await realpath(fullPath);
	} catch (err) {
		debug(`realpath ${fullPath} failed: ${err.message}`);
		return null;
	}
	if (!real.startsWith(realRoot + sep)) {
		warn(`skipping ${fullPath}: resolves outside root`);
		return null;
	}
	const fh = await open(real, fsConstants.O_RDONLY | O_NOFOLLOW);
	try {
		const st = await fh.stat();
		if (!st.isFile()) return null;
		return { content: await fh.readFile("utf-8"), mtimeMs: st.mtimeMs, size: st.size };
	} finally {
		await fh.close();
	}
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
 * @param {number} [options.maxFileSize] - Max file size in bytes (default: `vector.maxFileSize`)
 * @param {string[]} [options.include] - Include patterns
 * @param {string[]} [options.exclude] - Exclude patterns
 * @param {string} [options.model] - Embedding model label (part of the config hash)
 * @param {boolean} [options.force=false] - Force re-index all files
 * @param {function} [options.onProgress] - Progress callback (current, total, filePath)
 * @param {AbortSignal} [options.signal] - Abort signal
 * @returns {Promise<{indexed: number, skipped: number, errors: number, removed: number, errorDetails: Array<{file: string, message: string}>}>}
 */
export async function reindex(store, embedder, options) {
	const {
		rootDir,
		chunkSize = 96,
		chunkOverlap = 16,
		maxFileSize = getDefaultMaxFileSize(),
		include = DEFAULT_INCLUDE,
		exclude = DEFAULT_EXCLUDE,
		model,
		force = false,
		onProgress,
		signal,
	} = options;

	if (!rootDir) throw new Error("reindex: rootDir is required");
	// Validates chunkSize / overlap up front (throws RangeError)
	chunkContent("", "", chunkSize, chunkOverlap);

	const realRoot = await realpath(rootDir);
	const dbPath = store.dbPath;

	const configHash = createHash("sha256")
		.update(JSON.stringify({ model: model ?? null, chunkSize, chunkOverlap, include, exclude }))
		.digest("hex");

	let mtimeCache = force ? {} : await loadMtimeCache(dbPath);
	if (mtimeCache[CONFIG_HASH_KEY] !== configHash) {
		if (!force && mtimeCache[CONFIG_HASH_KEY] !== undefined) {
			debug("indexing config changed; performing full reindex");
		}
		mtimeCache = {};
	}
	mtimeCache[CONFIG_HASH_KEY] = configHash;

	let indexed = 0;
	let skipped = 0;
	let removed = 0;
	const errorDetails = [];

	try {
		const files = await scanFiles(realRoot, include, exclude);
		const fileSet = new Set(files);

		// Remove files that no longer exist / are no longer matched
		const stale = new Set(
			Object.keys(mtimeCache).filter((k) => k !== CONFIG_HASH_KEY && !fileSet.has(k)),
		);
		if (typeof store.listFiles === "function") {
			for (const f of store.listFiles()) if (!fileSet.has(f)) stale.add(f);
		}
		for (const f of stale) {
			try {
				store.removeFile(f);
				removed++;
			} catch (err) {
				errorDetails.push({ file: f, message: `remove failed: ${err.message}` });
			}
			delete mtimeCache[f];
		}

		let sinceSave = 0;
		for (let i = 0; i < files.length; i++) {
			signal?.throwIfAborted();
			const relPath = files[i];
			const fullPath = join(realRoot, relPath);

			if (onProgress) onProgress(i + 1, files.length, relPath);

			try {
				const file = await readConfined(realRoot, fullPath);
				if (!file) {
					skipped++;
					continue;
				}
				const mtime = file.mtimeMs;

				if (!force && mtimeCache[relPath] === mtime) {
					skipped++;
					continue;
				}
				if (file.size > maxFileSize || hasNullBytes(file.content)) {
					skipped++;
					continue;
				}

				const chunks = chunkContent(relPath, file.content, chunkSize, chunkOverlap);
				if (chunks.length === 0) {
					skipped++;
					continue;
				}

				const embeddings = await embedder.embed(chunks.map((c) => c.content));
				if (!Array.isArray(embeddings) || embeddings.length !== chunks.length) {
					throw new Error(
						`embedder returned ${Array.isArray(embeddings) ? embeddings.length : "non-array"} embeddings for ${chunks.length} chunks`,
					);
				}

				const storeChunks = chunks.map((c, idx) => ({ ...c, embedding: embeddings[idx] }));
				store.replaceFile(relPath, storeChunks);

				mtimeCache[relPath] = mtime;
				indexed++;
				if (++sinceSave >= SAVE_EVERY) {
					sinceSave = 0;
					await saveMtimeCache(dbPath, mtimeCache).catch((e) =>
						warn(`cache save failed: ${e.message}`),
					);
				}
			} catch (err) {
				if (signal?.aborted) throw err;
				warn(`Error indexing ${relPath}: ${err.message}`);
				errorDetails.push({ file: relPath, message: err.message });
			}
		}
	} finally {
		try {
			await saveMtimeCache(dbPath, mtimeCache);
		} catch (err) {
			warn(`could not save mtime cache: ${err.message}`);
		}
	}

	return { indexed, skipped, errors: errorDetails.length, removed, errorDetails };
}

export { scanFiles };
