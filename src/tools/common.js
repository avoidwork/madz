import { filterUrl } from "../sandbox/urlFilter.js";
import { resolvePath } from "../sandbox/pathResolver.js";
import { stat as statAsync, access } from "node:fs/promises";

/**
 * Validate a file path against the sandbox allowlist.
 * @param {string} filePath - The file path to validate
 * @param {string[]} allowedPaths - List of allowed sandbox directories
 * @returns {{ allowed: boolean, path: string, error?: string }}
 */
export function validatePath(filePath, allowedPaths) {
	const { allowed, path } = resolvePath(filePath, allowedPaths);
	if (!allowed) {
		return { allowed: false, path, error: `Access denied: ${filePath} is outside sandbox scope` };
	}
	return { allowed: true, path };
}

/**
 * Validate a URL against blocked schemes and optional allowlist.
 * @param {string} url - The URL to validate
 * @param {string[]} [allowlist=[]] - Optional URL host allowlist
 * @returns {{ allowed: boolean, reason: string }}
 */
export function validateUrl(url, allowlist = []) {
	if (!url || typeof url !== "string") {
		return { allowed: false, reason: "Invalid URL" };
	}
	return filterUrl(url, allowlist);
}

/**
 * Perform an HTTP request with configurable timeout and URL validation.
 * @param {string} url - The URL to fetch
 * @param {number} [timeoutMs=5000] - Timeout in milliseconds
 * @param {string[]} [allowlist=[]] - Optional URL host allowlist
 * @param {object} [options] - Optional fetch options (method, headers, body)
 * @returns {Promise<{ ok: boolean, body?: string, error?: string, headers?: Headers }>}
 */
export async function fetchWithTimeout(url, timeoutMs = 5000, allowlist = [], options = {}) {
	const validation = validateUrl(url, allowlist);
	if (!validation.allowed) {
		return { ok: false, error: validation.reason };
	}

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const fetchOptions = {
			signal: controller.signal,
			...options,
		};
		const response = await fetch(url, fetchOptions);
		clearTimeout(timeoutId);
		const body = await response.text();
		return {
			ok: response.ok,
			body: response.ok ? body : undefined,
			error: response.ok ? undefined : `HTTP ${response.status}`,
			headers: response.headers,
		};
	} catch (err) {
		clearTimeout(timeoutId);
		const reason =
			err.name === "AbortError" ? `Request timed out after ${timeoutMs}ms` : err.message;
		return { ok: false, error: reason };
	}
}

/**
 * Read a file and check against max size limit.
 * @param {string} filePath - Resolved file path
 * @param {string} maxReadSize - Size limit string (e.g. "1mb")
 * @returns {Promise<{ ok: boolean, size?: number, limit?: number, error?: string }>}
 */
export async function checkFileLimit(filePath, maxReadSize) {
	try {
		await access(filePath);
	} catch {
		return { ok: false, error: `File not found: ${filePath}` };
	}

	const stats = await statAsync(filePath);
	const maxSizeBytes = parseSizeString(maxReadSize);

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
