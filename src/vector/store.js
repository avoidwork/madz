import { createRequire } from "node:module";
import { existsSync, mkdirSync } from "node:fs";
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
 * @returns {Promise<{ init: () => Promise<void>, insertChunks: (chunks: Array) => Promise<void>, search: (embedding: Float32Array, topK: number) => Promise<Array>, removeFile: (filePath: string) => Promise<void>, close: () => Promise<void>, dbPath: string }>}
 */
export async function createVectorStore(dbPath) {
	// Ensure the directory exists
	const dbDir = dirname(dbPath);
	if (!existsSync(dbDir)) {
		mkdirSync(dbDir, { recursive: true });
	}

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

		const transaction = db.transaction((items) => {
			for (const chunk of items) {
				const info = insertChunk.run(chunk.filePath, chunk.lineStart, chunk.lineEnd, chunk.content);
				insertVec.run(BigInt(info.lastInsertRowid), new Float32Array(chunk.embedding));
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

	return { init, insertChunks, search, removeFile, close, dbPath };
}
