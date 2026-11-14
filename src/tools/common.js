import { resolvePath } from "../sandbox/pathResolver.js";
import { stat as statAsync, access } from "node:fs/promises";

/**
 * Validate a file path against the sandbox allowlist.
 * @param {string} filePath - The file path to validate
 * @param {string[]} allowedPaths - List of allowed sandbox directories
 * @param {{ noFollow?: boolean }} [options] - `noFollow` leaves a symlink in the final
 *   path component unresolved, so the link itself (not its target) is checked
 * @returns {{ allowed: boolean, path: string, realPath?: string, error?: string }}
 */
export function validatePath(filePath, allowedPaths, options) {
	const { allowed, path, realPath } = resolvePath(filePath, allowedPaths, options);
	if (!allowed) {
		return { allowed: false, path, error: `Access denied: ${filePath} is outside sandbox scope` };
	}
	return { allowed: true, path, realPath };
}

/**
 * Read a file and check against max size limit.
 * @param {string} filePath - Resolved file path
 * @param {number} maxReadSize - Size limit in bytes
 * @returns {Promise<{ ok: boolean, size?: number, limit?: number, error?: string }>}
 */
export async function checkFileLimit(filePath, maxReadSize) {
	try {
		await access(filePath);
	} catch (_err) {
		return { ok: false, error: `File not found: ${filePath}` };
	}

	const stats = await statAsync(filePath);

	if (stats.size > maxReadSize) {
		return {
			ok: false,
			size: stats.size,
			limit: maxReadSize,
			error: `File size (${stats.size} bytes) exceeds max read size (${maxReadSize}). Use limit/offset to paginate.`,
		};
	}

	return { ok: true, size: stats.size };
}
