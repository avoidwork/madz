import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const _require = createRequire(import.meta.url);

/**
 * SQLite vector store using sqlite-vec for KNN search.
 *
 * Creates `code_chunks` (metadata) and `vec_code_chunks` (vector) tables
 * on initialization. Supports insert, KNN query, and incremental upsert.
 *
 * @module vector/store
 */

/**
 * Create a vector store connected to the given database file.
 *
 * @param {string} dbPath - Path to the SQLite database file
 * @param {object} [options] - Store options
 * @param {boolean} [options.fulltext=false] - Enable FTS5 full-text search
 * @param {string} [options.ftsTokenize="porter unicode61"] - FTS5 tokenizer configuration
 * @returns {Promise<{ init: () => Promise<void>, insertChunks: (chunks: Array) => Promise<void>, search: (embedding: Float32Array, topK: number) => Promise<Array>, searchFts: (query: string, topK: number) => Promise<Array>, hybridSearch: (embedding: Float32Array, query: string, topK: number, k?: number) => Promise<Array>, insertFtsChunks: (chunks: Array) => Promise<void>, removeFile: (filePath: string) => Promise<void>, close: () => Promise<void>, dbPath: string }>}
 */
export async function createVectorStore(dbPath, options = {}) {
	const { fulltext = false, ftsTokenize = "porter unicode61" } = options;

	// Ensure the directory exists
	const dbDir = dirname(dbPath);
	await mkdir(dbDir, { recursive: true }).catch(() => {});

	// Load better-sqlite3 and sqlite-vec
	const Database = _require("better-sqlite3");
	const sqliteVec = await import("@photostructure/sqlite-vec");

	/** @type {import("better-sqlite3").Database} */
	const db = new Database(dbPath);

	// Enable WAL mode for better concurrent read performance
	db.pragma("journal_mode = WAL");

	// Initialize sqlite-vec (loads the native extension)
	sqliteVec.load(db);

	/**
	 * Initialize the database schema — create tables if they don't exist.
	 */
	function init() {
		db.exec(`
			CREATE TABLE IF NOT EXISTS code_chunks (
				id INTEGER PRIMARY KEY,
				file_path TEXT NOT NULL,
				line_start INTEGER NOT NULL,
				line_end INTEGER NOT NULL,
				content TEXT NOT NULL
			);

			CREATE VIRTUAL TABLE IF NOT EXISTS vec_code_chunks USING vec0(
				id integer primary key,
				embedding float[384] distance_metric=cosine
			);
		`);

		if (fulltext) {
			db.exec(`
				CREATE VIRTUAL TABLE IF NOT EXISTS fts_code_chunks USING fts5(
					file_path UNINDEXED,
					content,
					tokenize='${ftsTokenize}'
				);
			`);
		}
	}

	/**
	 * Insert chunks with their embeddings into the store.
	 *
	 * @param {Array<{filePath: string, lineStart: number, lineEnd: number, content: string, embedding: Float32Array}>} chunks - Chunks with embeddings
	 */
	function insertChunks(chunks) {
		const insertChunk = db.prepare(`
			INSERT INTO code_chunks (file_path, line_start, line_end, content)
			VALUES (?, ?, ?, ?)
		`);
		const insertVec = db.prepare(`
			INSERT INTO vec_code_chunks (id, embedding)
			VALUES (?, ?)
		`);
		const insertFts = fulltext
			? db.prepare(`
				INSERT INTO fts_code_chunks (file_path, content)
				VALUES (?, ?)
			`)
			: null;

		const transaction = db.transaction((items) => {
			for (const chunk of items) {
				const info = insertChunk.run(chunk.filePath, chunk.lineStart, chunk.lineEnd, chunk.content);
				insertVec.run(BigInt(info.lastInsertRowid), new Float32Array(chunk.embedding));
				if (insertFts) {
					insertFts.run(chunk.filePath, chunk.content);
				}
			}
		});

		transaction(chunks);
	}

	/**
	 * Search for the top-K most similar chunks to a query embedding.
	 *
	 * @param {Float32Array} embedding - Query embedding vector (384-dim)
	 * @param {number} [topK=5] - Number of results to return
	 * @returns {Array<{id: number, filePath: string, lineStart: number, lineEnd: number, content: string, distance: number}>}
	 */
	function search(embedding, topK = 5) {
		const rows = db
			.prepare(`
				SELECT c.id, c.file_path, c.line_start, c.line_end, c.content, v.distance
				FROM vec_code_chunks v
				JOIN code_chunks c ON c.id = v.id
				WHERE v.embedding MATCH ?
					AND v.k = ?
				ORDER BY v.distance
			`)
			.all(new Float32Array(embedding), topK);

		return rows.map((row) => ({
			id: row.id,
			filePath: row.file_path,
			lineStart: row.line_start,
			lineEnd: row.line_end,
			content: row.content,
			distance: row.distance,
		}));
	}

	/**
	 * Insert chunks into the FTS5 table.
	 *
	 * @param {Array<{filePath: string, lineStart: number, lineEnd: number, content: string}>} chunks - Chunks to index in FTS
	 */
	function insertFtsChunks(chunks) {
		if (!fulltext) return;

		const insertFts = db.prepare(`
			INSERT INTO fts_code_chunks (file_path, content)
			VALUES (?, ?)
		`);

		const transaction = db.transaction((items) => {
			for (const chunk of items) {
				insertFts.run(chunk.filePath, chunk.content);
			}
		});

		transaction(chunks);
	}

	/**
	 * Search the FTS5 index for matching chunks.
	 *
	 * @param {string} query - FTS5 query string
	 * @param {number} [topK=5] - Number of results to return
	 * @returns {Array<{id: number, filePath: string, lineStart: number, lineEnd: number, content: string, rank: number}>}
	 */
	function searchFts(query, topK = 5) {
		if (!fulltext) return [];

		const rows = db
			.prepare(`
				SELECT c.id, c.file_path, c.line_start, c.line_end, c.content, f.rank
				FROM fts_code_chunks f
				JOIN code_chunks c ON c.rowid = f.rowid
				WHERE f.content MATCH ?
				ORDER BY f.rank
				LIMIT ?
			`)
			.all(query, topK);

		return rows.map((row) => ({
			id: row.id,
			filePath: row.file_path,
			lineStart: row.line_start,
			lineEnd: row.line_end,
			content: row.content,
			rank: row.rank,
		}));
	}

	/**
	 * Perform hybrid search combining vector and FTS results via RRF.
	 *
	 * @param {Float32Array} embedding - Query embedding vector (384-dim)
	 * @param {string} query - FTS5 query string
	 * @param {number} [topK=5] - Number of results to return
	 * @param {number} [k=60] - RRF constant
	 * @returns {Array<{id: number, filePath: string, lineStart: number, lineEnd: number, content: string, distance?: number, rank?: number, source: string}>}
	 */
	function hybridSearch(embedding, query, topK = 5, k = 60) {
		const vecResults = search(embedding, topK * 2);
		const ftsResults = searchFts(query, topK * 2);

		// Build RRF scores
		/** @type {Map<number, {score: number, vecRank: number|null, ftsRank: number|null, row: object}>} */
		const combined = new Map();

		vecResults.forEach((r, i) => {
			combined.set(r.id, {
				score: 1 / (k + i + 1),
				vecRank: i + 1,
				ftsRank: null,
				row: r,
			});
		});

		ftsResults.forEach((r, i) => {
			const existing = combined.get(r.id);
			if (existing) {
				existing.score += 1 / (k + i + 1);
				existing.ftsRank = i + 1;
				// Merge FTS rank into the row for display
				existing.row.rank = r.rank;
			} else {
				combined.set(r.id, {
					score: 1 / (k + i + 1),
					vecRank: null,
					ftsRank: i + 1,
					row: r,
				});
			}
		});

		// Sort by RRF score descending, take topK
		const sorted = [...combined.entries()].sort((a, b) => b[1].score - a[1].score).slice(0, topK);

		return sorted.map(([_id, entry]) => {
			let source;
			if (entry.vecRank !== null && entry.ftsRank !== null) source = "both";
			else if (entry.vecRank !== null) source = "vector";
			else source = "fulltext";

			return {
				...entry.row,
				distance: entry.row.distance,
				rank: entry.row.rank,
				source,
			};
		});
	}

	/**
	 * Remove all chunks for a given file path.
	 *
	 * @param {string} filePath - File path to remove chunks for
	 */
	function removeFile(filePath) {
		const transaction = db.transaction((fp) => {
			const ids = db.prepare("SELECT id FROM code_chunks WHERE file_path = ?").pluck().all(fp);

			if (ids.length > 0) {
				const placeholders = ids.map(() => "?").join(",");
				db.prepare(`DELETE FROM vec_code_chunks WHERE id IN (${placeholders})`).run(...ids);
				if (fulltext) {
					db.prepare(`DELETE FROM fts_code_chunks WHERE rowid IN (${placeholders})`).run(...ids);
				}
				db.prepare("DELETE FROM code_chunks WHERE file_path = ?").run(fp);
			}
		});

		transaction(filePath);
	}

	/**
	 * Close the database connection.
	 */
	function close() {
		db.close();
	}

	return {
		init,
		insertChunks,
		insertFtsChunks,
		search,
		searchFts,
		hybridSearch,
		removeFile,
		close,
		dbPath,
	};
}
