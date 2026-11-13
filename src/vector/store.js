import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { debug } from "./fileFilters.js";

const _require = createRequire(import.meta.url);

const EMBEDDING_DIM = 384;
const FTS_TOKENIZE_RE = /^(porter )?(unicode61|ascii|trigram)( remove_diacritics [012])?$/;

/**
 * SQLite vector store using sqlite-vec for KNN search.
 *
 * Creates `code_chunks` (metadata) and `vec_code_chunks` (vector) tables
 * on initialization. Supports insert, KNN query, and incremental upsert.
 *
 * @module vector/store
 */

/**
 * Convert an embedding to a validated Buffer view for binding.
 * @param {ArrayLike<number>} embedding - 384-dim embedding
 * @returns {Buffer}
 */
function toVecBuffer(embedding) {
	if (!embedding || embedding.length !== EMBEDDING_DIM) {
		throw new Error(`Embedding must have length ${EMBEDDING_DIM}, got ${embedding?.length}`);
	}
	const f32 = embedding instanceof Float32Array ? embedding : new Float32Array(embedding);
	return Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength);
}

/**
 * Turn free text into a safe FTS5 query: each whitespace-separated token is
 * double-quoted (embedded quotes doubled).
 * @param {string} query - Raw query
 * @returns {string} FTS5 MATCH expression (empty string when no tokens)
 */
function sanitizeFtsQuery(query) {
	return String(query ?? "")
		.split(/\s+/)
		.filter(Boolean)
		.map((t) => `"${t.replace(/"/g, '""')}"`)
		.join(" ");
}

/**
 * Create a vector store connected to the given database file.
 *
 * @param {string} dbPath - Path to the SQLite database file
 * @param {object} [options] - Store options
 * @param {boolean} [options.fulltext=false] - Enable FTS5 full-text search
 * @param {string} [options.ftsTokenize="porter unicode61"] - FTS5 tokenizer configuration (allowlisted)
 * @param {number} [options.busyTimeout=5000] - SQLite busy timeout in ms
 * @returns {Promise<{ init: () => void, insertChunks: (chunks: Array) => void, replaceFile: (relPath: string, chunks: Array) => void, search: (embedding: Float32Array, topK?: number) => Array, searchFts: (query: string, topK?: number) => Array, hybridSearch: (embedding: Float32Array, query: string, topK?: number, k?: number) => Array, insertFtsChunks: (chunks: Array) => void, removeFile: (filePath: string) => void, listFiles: () => string[], close: () => void, dbPath: string }>}
 */
export async function createVectorStore(dbPath, options = {}) {
	const { fulltext = false, ftsTokenize = "porter unicode61", busyTimeout = 5000 } = options;

	if (fulltext) {
		if (typeof ftsTokenize !== "string" || !FTS_TOKENIZE_RE.test(ftsTokenize)) {
			throw new Error(`Invalid ftsTokenize value: ${JSON.stringify(ftsTokenize)}`);
		}
	}
	const safeTokenize = String(ftsTokenize).replace(/'/g, "''");

	// Ensure the directory exists
	if (dbPath !== ":memory:") {
		await mkdir(dirname(dbPath), { recursive: true }).catch((err) => {
			debug(`mkdir for ${dbPath} failed: ${err.message}`);
		});
	}

	const Database = _require("better-sqlite3");
	const sqliteVec = await import("@photostructure/sqlite-vec");

	/** @type {import("better-sqlite3").Database} */
	const db = new Database(dbPath);
	try {
		db.pragma(`busy_timeout = ${Math.max(0, Math.trunc(busyTimeout))}`);
		db.pragma("journal_mode = WAL");
		sqliteVec.load(db);
	} catch (err) {
		try {
			db.close();
		} catch (closeErr) {
			debug(`close after failed setup: ${closeErr.message}`);
		}
		throw new Error(`Failed to initialize vector store: ${err.message}`, { cause: err });
	}

	/** @type {Map<string, import("better-sqlite3").Statement>} */
	const stmtCache = new Map();
	/**
	 * Lazily prepare and cache a statement.
	 * @param {string} sql - SQL text
	 */
	function stmt(sql) {
		let s = stmtCache.get(sql);
		if (!s) {
			s = db.prepare(sql);
			stmtCache.set(sql, s);
		}
		return s;
	}

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

			CREATE INDEX IF NOT EXISTS idx_chunks_file ON code_chunks(file_path);

			CREATE VIRTUAL TABLE IF NOT EXISTS vec_code_chunks USING vec0(
				id integer primary key,
				embedding float[${EMBEDDING_DIM}] distance_metric=cosine
			);
		`);

		if (fulltext) {
			db.exec(`
				CREATE VIRTUAL TABLE IF NOT EXISTS fts_code_chunks USING fts5(
					file_path UNINDEXED,
					content,
					tokenize='${safeTokenize}'
				);
			`);
		}
	}

	function insertOne(chunk) {
		const vec = toVecBuffer(chunk.embedding);
		const info = stmt(
			"INSERT INTO code_chunks (file_path, line_start, line_end, content) VALUES (?, ?, ?, ?)",
		).run(chunk.filePath, chunk.lineStart, chunk.lineEnd, chunk.content);
		const rowid = BigInt(info.lastInsertRowid);
		stmt("INSERT INTO vec_code_chunks (id, embedding) VALUES (?, ?)").run(rowid, vec);
		if (fulltext) {
			stmt("INSERT INTO fts_code_chunks (rowid, file_path, content) VALUES (?, ?, ?)").run(
				rowid,
				chunk.filePath,
				chunk.content,
			);
		}
	}

	function deleteFile(fp) {
		stmt(
			"DELETE FROM vec_code_chunks WHERE id IN (SELECT id FROM code_chunks WHERE file_path = ?)",
		).run(fp);
		if (fulltext) {
			stmt(
				"DELETE FROM fts_code_chunks WHERE rowid IN (SELECT id FROM code_chunks WHERE file_path = ?)",
			).run(fp);
		}
		stmt("DELETE FROM code_chunks WHERE file_path = ?").run(fp);
	}

	const insertTx = db.transaction((items) => {
		for (const chunk of items) insertOne(chunk);
	});
	const removeTx = db.transaction((fp) => deleteFile(fp));
	const replaceTx = db.transaction((fp, items) => {
		deleteFile(fp);
		for (const chunk of items) insertOne(chunk);
	});

	/**
	 * Insert chunks with their embeddings into the store.
	 *
	 * @param {Array<{filePath: string, lineStart: number, lineEnd: number, content: string, embedding: Float32Array}>} chunks - Chunks with embeddings
	 */
	function insertChunks(chunks) {
		insertTx(chunks);
	}

	/**
	 * Atomically replace all chunks of a file (delete + insert in one transaction).
	 *
	 * @param {string} relPath - File path
	 * @param {Array<{filePath: string, lineStart: number, lineEnd: number, content: string, embedding: Float32Array}>} chunks - New chunks
	 */
	function replaceFile(relPath, chunks) {
		replaceTx(relPath, chunks);
	}

	/**
	 * Search for the top-K most similar chunks to a query embedding.
	 *
	 * @param {Float32Array} embedding - Query embedding vector (384-dim)
	 * @param {number} [topK=5] - Number of results to return
	 * @returns {Array<{id: number, filePath: string, lineStart: number, lineEnd: number, content: string, distance: number}>}
	 */
	function search(embedding, topK = 5) {
		const rows = stmt(`
				SELECT c.id, c.file_path, c.line_start, c.line_end, c.content, v.distance
				FROM vec_code_chunks v
				JOIN code_chunks c ON c.id = v.id
				WHERE v.embedding MATCH ?
					AND v.k = ?
				ORDER BY v.distance
			`).all(toVecBuffer(embedding), topK);

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
	 * Insert chunks into the FTS5 table. Each chunk must carry the `id` of its
	 * `code_chunks` row, which is used as the FTS rowid. Existing FTS rows with
	 * the same id are replaced.
	 *
	 * @param {Array<{id: number, filePath: string, content: string}>} chunks - Chunks to index in FTS
	 */
	function insertFtsChunks(chunks) {
		if (!fulltext) return;
		for (const c of chunks) {
			if (!Number.isInteger(c.id)) {
				throw new Error("insertFtsChunks requires chunk.id matching code_chunks.id");
			}
		}
		db.transaction((items) => {
			for (const c of items) {
				stmt("DELETE FROM fts_code_chunks WHERE rowid = ?").run(c.id);
				stmt("INSERT INTO fts_code_chunks (rowid, file_path, content) VALUES (?, ?, ?)").run(
					c.id,
					c.filePath,
					c.content,
				);
			}
		})(chunks);
	}

	/**
	 * Search the FTS5 index for matching chunks. Query tokens are quoted, so
	 * FTS operators in user input are treated literally.
	 *
	 * @param {string} query - Query text
	 * @param {number} [topK=5] - Number of results to return
	 * @returns {Array<{id: number, filePath: string, lineStart: number, lineEnd: number, content: string, rank: number}>}
	 */
	function searchFts(query, topK = 5) {
		if (!fulltext) return [];
		const match = sanitizeFtsQuery(query);
		if (!match) return [];

		const rows = stmt(`
				SELECT c.id, c.file_path, c.line_start, c.line_end, c.content, f.rank
				FROM fts_code_chunks f
				JOIN code_chunks c ON c.id = f.rowid
				WHERE f.content MATCH ?
				ORDER BY f.rank
				LIMIT ?
			`).all(match, topK);

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
	 * FTS errors fall back to vector-only results.
	 *
	 * @param {Float32Array} embedding - Query embedding vector (384-dim)
	 * @param {string} query - Query text
	 * @param {number} [topK=5] - Number of results to return (integer 1..4096)
	 * @param {number} [k=60] - RRF constant
	 * @returns {Array<{id: number, filePath: string, lineStart: number, lineEnd: number, content: string, distance?: number, rank?: number, source: string}>}
	 */
	function hybridSearch(embedding, query, topK = 5, k = 60) {
		if (!Number.isInteger(topK) || topK < 1 || topK > 4096) {
			throw new RangeError("topK must be an integer between 1 and 4096");
		}
		const fetchK = Math.min(topK * 2, 4096);
		const vecResults = search(embedding, fetchK);
		let ftsResults = [];
		try {
			ftsResults = searchFts(query, fetchK);
		} catch (err) {
			debug(`FTS search failed, using vector only: ${err.message}`);
		}

		/** @type {Map<number, {score: number, vecRank: number|null, ftsRank: number|null, row: object}>} */
		const combined = new Map();

		vecResults.forEach((r, i) => {
			combined.set(r.id, {
				score: 1 / (k + i + 1),
				vecRank: i + 1,
				ftsRank: null,
				row: r,
				ftsRow: null,
			});
		});

		ftsResults.forEach((r, i) => {
			const existing = combined.get(r.id);
			if (existing) {
				existing.score += 1 / (k + i + 1);
				existing.ftsRank = i + 1;
				existing.ftsRow = r;
			} else {
				combined.set(r.id, {
					score: 1 / (k + i + 1),
					vecRank: null,
					ftsRank: i + 1,
					row: r,
					ftsRow: r,
				});
			}
		});

		const sorted = [...combined.values()].sort((a, b) => b.score - a.score).slice(0, topK);

		return sorted.map((entry) => {
			let source;
			if (entry.vecRank !== null && entry.ftsRank !== null) source = "both";
			else if (entry.vecRank !== null) source = "vector";
			else source = "fulltext";

			return {
				...entry.row,
				distance: entry.row.distance,
				rank: entry.ftsRow ? entry.ftsRow.rank : entry.row.rank,
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
		removeTx(filePath);
	}

	/**
	 * List distinct file paths currently stored.
	 * @returns {string[]}
	 */
	function listFiles() {
		return stmt("SELECT DISTINCT file_path FROM code_chunks").pluck().all();
	}

	/**
	 * Close the database connection (checkpointing the WAL first). Safe to call repeatedly.
	 */
	function close() {
		if (!db.open) return;
		try {
			if (dbPath !== ":memory:") db.pragma("wal_checkpoint(TRUNCATE)");
		} catch (err) {
			debug(`wal_checkpoint failed: ${err.message}`);
		}
		stmtCache.clear();
		db.close();
	}

	return {
		init,
		insertChunks,
		replaceFile,
		insertFtsChunks,
		search,
		searchFts,
		hybridSearch,
		removeFile,
		listFiles,
		close,
		dbPath,
	};
}
