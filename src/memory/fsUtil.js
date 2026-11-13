import { randomBytes } from "node:crypto";
import { rename, unlink, writeFile } from "node:fs/promises";
import { logger } from "../shared/logger.js";

/**
 * Run `fn` over `items` in sequential batches of `size` concurrent calls.
 * @param {Array} items - Items to process
 * @param {number} size - Maximum concurrent calls
 * @param {(item: *) => Promise<*>} fn - Async mapper
 * @returns {Promise<Array>} Results in input order
 */
export async function mapInBatches(items, size, fn) {
	const results = [];
	for (let i = 0; i < items.length; i += size) {
		results.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
	}
	return results;
}

/**
 * Write a file atomically: unique temp file in the same directory (flag 'wx')
 * followed by rename. The temp file is removed on failure.
 * @param {string} filepath - Final file path
 * @param {string} content - File content
 * @returns {Promise<void>}
 */
export async function writeFileAtomic(filepath, content) {
	const tmpPath = `${filepath}.${randomBytes(6).toString("hex")}.tmp`;
	let renamed = false;
	try {
		await writeFile(tmpPath, content, { encoding: "utf-8", flag: "wx" });
		await rename(tmpPath, filepath);
		renamed = true;
	} finally {
		if (!renamed) {
			await unlink(tmpPath).catch((err) => {
				if (err.code !== "ENOENT") {
					logger.warn(`[memory] Failed to remove temp file ${tmpPath}: ${err.message}`);
				}
			});
		}
	}
}
