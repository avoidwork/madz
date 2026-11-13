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
	const maxSizeBytes = typeof maxReadSize === "number" ? maxReadSize : parseSizeString(maxReadSize);

	if (stats.size > maxSizeBytes) {
		return {
			ok: false,
			size: stats.size,
			limit: maxSizeBytes,
			error: `File size (${stats.size} bytes) exceeds max read size (${maxReadSize}). Use limit/offset to paginate.`,
		};
	}

	return { ok: true, size: stats.size };
}

/**
 * Parse a size string like "1mb", "512kb", "1024" to bytes.
 * @param {string} sizeStr - Size string
 * @returns {number} Size in bytes
 */
export function parseSizeString(sizeStr) {
	const match = sizeStr
		.trim()
		.toLowerCase()
		.match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
	if (!match) {
		return 1024 * 1024; // default 1mb
	}

	const value = parseFloat(match[1]);
	const unit = match[2] || "b";
	const multipliers = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 };

	return Math.floor(value * (multipliers[unit] || 1));
}
