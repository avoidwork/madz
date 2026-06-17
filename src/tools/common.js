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
 * Perform an HTTP GET request with configurable timeout and URL validation.
 * @param {string} url - The URL to fetch
 * @param {number} [timeoutMs=5000] - Timeout in milliseconds
 * @param {string[]} [allowlist=[]] - Optional URL host allowlist
 * @returns {Promise<{ ok: boolean, body?: string, error?: string }>}
 */
export async function fetchWithTimeout(url, timeoutMs = 5000, allowlist = []) {
	const validation = validateUrl(url, allowlist);
	if (!validation.allowed) {
		return { ok: false, error: validation.reason };
	}

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetch(url, { signal: controller.signal });
		clearTimeout(timeoutId);
		const body = await response.text();
		return {
			ok: response.ok,
			body: response.ok ? body : undefined,
			error: response.ok ? undefined : `HTTP ${response.status}`,
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

/**
 * IP address parsing utilities for SSRF protection.
 */

/**
 * Parse an IP address into its numeric form.
 * @param {string} ip - IP address string
 * @returns {{ parts: number[], version: 4 | 6 } | null}
 */
function parseIp(ip) {
	if (!ip || typeof ip !== "string") return null;

	// IPv4
	const ipv4Match = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
	if (ipv4Match) {
		const parts = ipv4Match.slice(1, 5).map(Number);
		if (parts.some((p) => p > 255)) return null;
		return { parts, version: 4 };
	}

	// IPv6 (simplified — handles common cases)
	if (ip.includes(":")) {
		const hexParts = ip.split(":").filter((p) => p.length > 0);
		return { parts: hexParts.map((p) => parseInt(p, 16)), version: 6 };
	}

	return null;
}

/**
 * Check if an IPv4 address is in a private or reserved range.
 * @param {number[]} parts - IPv4 address parts [a, b, c, d]
 * @returns {boolean}
 */
function isPrivateOrReservedV4(parts) {
	const [a, b] = parts;

	// 0.0.0.0/8
	if (a === 0) return true;
	// 10.0.0.0/8
	if (a === 10) return true;
	// 100.64.0.0/10
	if (a === 100 && b >= 64 && b <= 127) return true;
	// 127.0.0.0/8 (loopback)
	if (a === 127) return true;
	// 169.254.0.0/16 (link-local)
	if (a === 169 && b === 254) return true;
	// 172.16.0.0/12
	if (a === 172 && b >= 16 && b <= 31) return true;
	// 192.0.0.0/24
	if (a === 192 && b === 0 && parts[2] === 0) return true;
	// 192.0.2.0/24 (documentation)
	if (a === 192 && b === 0 && parts[2] === 2) return true;
	// 192.88.99.0/24 (6to4 relay)
	if (a === 192 && b === 88 && parts[2] === 99) return true;
	// 192.168.0.0/16
	if (a === 192 && b === 168) return true;
	// 198.18.0.0/15 (benchmark)
	if (a === 198 && (b === 18 || b === 19)) return true;
	// 198.51.100.0/24 (documentation)
	if (a === 198 && b === 51 && parts[2] === 100) return true;
	// 203.0.113.0/24 (documentation)
	if (a === 203 && b === 0 && parts[2] === 113) return true;
	// 224.0.0.0/4 (multicast)
	if (a >= 224 && a <= 239) return true;
	// 240.0.0.0/4 (reserved)
	if (a >= 240) return true;

	return false;
}

/**
 * Check if an IPv6 address is private or reserved.
 * @param {number[]} parts - IPv6 hex parts
 * @returns {boolean}
 */
function isPrivateOrReservedV6(parts) {
	if (parts.length === 0) return false;

	// ::1/128 (loopback)
	if (parts.length === 1 && parts[0] === 0) return true;

	// fc00::/7 (unique local)
	const first = parts[0];
	const firstBit = (first >> 63) & 1;
	const secondBit = (first >> 62) & 1;
	if (firstBit === 1 && (secondBit === 0 || secondBit === 1)) return true;

	// fe80::/10 (link-local)
	if (firstBit === 1 && secondBit === 0 && (first >> 56) === 0xfe) return true;

	return false;
}

/**
 * Resolve a hostname to an IP address and check if it's private/reserved.
 * @param {string} hostname - Hostname to resolve
 * @returns {Promise<{ blocked: boolean, reason?: string }>}
 */
async function resolveAndCheckIp(hostname) {
	try {
		const { resolve4, resolve6 } = await import("node:dns");
		const resolve4Promise = new Promise((resolve, reject) =>
			resolve4(hostname, (err, addresses) => (err ? reject(err) : resolve(addresses))),
		);
		const resolve6Promise = new Promise((resolve, reject) =>
			resolve6(hostname, (err, addresses) => (err ? reject(err) : resolve(addresses))),
		);

		const [v4Addresses, v6Addresses] = await Promise.allSettled([
			resolve4Promise,
			resolve6Promise,
		]);

		const v4 = v4Addresses.status === "fulfilled" ? v4Addresses.value : [];
		const v6 = v6Addresses.status === "fulfilled" ? v6Addresses.value : [];

		for (const addr of v4) {
			const parsed = parseIp(addr);
			if (parsed && parsed.version === 4 && isPrivateOrReservedV4(parsed.parts)) {
				return { blocked: true, reason: `Hostname ${hostname} resolves to private/reserved IP ${addr}` };
			}
		}

		for (const addr of v6) {
			const parsed = parseIp(addr);
			if (parsed && parsed.version === 6 && isPrivateOrReservedV6(parsed.parts)) {
				return { blocked: true, reason: `Hostname ${hostname} resolves to private/reserved IPv6 ${addr}` };
			}
		}

		return { blocked: false };
	} catch {
		// DNS resolution failed — allow but log warning
		return { blocked: false };
	}
}

/**
 * SSRF protection utility. Validates outbound fetch destinations against private/reserved IP ranges.
 * @param {string} url - The URL to validate
 * @param {object} [options] - SSRF protection options
 * @param {boolean} [options.allowDevBypass=false] - Allow bypass in development mode
 * @returns {Promise<{ allowed: boolean, reason?: string }>}
 */
export async function ssrfProtect(url, options = {}) {
	if (!url || typeof url !== "string") {
		return { allowed: false, reason: "Invalid URL" };
	}

	let parsedUrl;
	try {
		parsedUrl = new URL(url);
	} catch {
		return { allowed: false, reason: "Invalid URL format" };
	}

	const host = parsedUrl.hostname;
	const protocol = parsedUrl.protocol;

	// Block file://, gopher://, dict:// schemes
	if (["file:", "gopher:", "dict:", "ftp:", "ssh:"].includes(protocol)) {
		return { allowed: false, reason: `Scheme ${protocol} is blocked for SSRF protection` };
	}

	// Check if host is an IP address directly
	const ipParsed = parseIp(host);
	if (ipParsed) {
		if (ipParsed.version === 4 && isPrivateOrReservedV4(ipParsed.parts)) {
			return { allowed: false, reason: `Private/reserved IPv4 address: ${host}` };
		}
		if (ipParsed.version === 6 && isPrivateOrReservedV6(ipParsed.parts)) {
			return { allowed: false, reason: `Private/reserved IPv6 address: ${host}` };
		}
	}

	// Check development mode bypass
	const allowDevBypass = options.allowDevBypass ?? process.env.MADZ_DEVELOPMENT === "true";
	if (allowDevBypass) {
		// In dev mode, resolve and warn but don't block
		const result = await resolveAndCheckIp(host);
		if (result.blocked) {
			console.warn(`[SSRF] Dev bypass: ${result.reason}`);
			return { allowed: true };
		}
		return { allowed: true };
	}

	// Resolve hostname and check resolved IPs
	const resolutionResult = await resolveAndCheckIp(host);
	if (resolutionResult.blocked) {
		return resolutionResult;
	}

	return { allowed: true };
}

/**
 * Validate an HTTP redirect URL against SSRF protection.
 * @param {string} redirectUrl - The redirect URL to validate
 * @param {number} [redirectCount=0] - Current redirect count
 * @param {number} [maxRedirects=10] - Maximum allowed redirects
 * @param {object} [options] - SSRF protection options
 * @returns {Promise<{ allowed: boolean, reason?: string, exceeded: boolean }>}
 */
export async function validateRedirect(redirectUrl, redirectCount = 0, maxRedirects = 10, options = {}) {
	if (redirectCount >= maxRedirects) {
		return { allowed: false, reason: `Redirect limit exceeded (${maxRedirects})`, exceeded: true };
	}

	const ssrfResult = await ssrfProtect(redirectUrl, options);
	if (!ssrfResult.allowed) {
		return { allowed: false, reason: ssrfResult.reason, exceeded: false };
	}

	return { allowed: true, exceeded: false };
}

/**
 * Create an output accumulator using chunk array pattern to prevent O(n²) memory growth.
 * @returns {{ push: (chunk: string) => void, get: () => string, reset: () => void }}
 */
export function createOutputAccumulator() {
	const chunks = [];

	return {
		/**
		 * Push a chunk of output.
		 * @param {string} chunk - Output chunk to accumulate
		 */
		push(chunk) {
			chunks.push(chunk);
		},
		/**
		 * Get the accumulated output as a single string.
		 * @returns {string}
		 */
		get() {
			return chunks.join("");
		},
		/**
		 * Reset the accumulator.
		 */
		reset() {
			chunks.length = 0;
		},
	};
}

/**
 * Escape user input for safe inclusion in shell commands (grep, sed, etc.).
 * @param {string} input - User input to escape
 * @returns {string} Escaped input safe for shell interpolation
 */
export function escapeShellInput(input) {
	if (typeof input !== "string") return String(input);
	// Escape single quotes by ending the string, adding an escaped quote, and restarting
	return input.replace(/'/g, "'\\''");
}

/**
 * Sanitize a file path by blocking path traversal attempts.
 * @param {string} filePath - The file path to sanitize
 * @returns {{ allowed: boolean, path: string, error?: string }}
 */
export function sanitizePath(filePath) {
	if (typeof filePath !== "string") {
		return { allowed: false, path: "", error: "Invalid path" };
	}

	// Block path traversal sequences
	if (filePath.includes("../") || filePath.includes("..\\") || filePath.includes("..%2f") || filePath.includes("..%5c")) {
		return { allowed: false, path: filePath, error: "Path traversal detected" };
	}

	// Block absolute paths outside allowed scope
	if (filePath.startsWith("/") || filePath.startsWith("\\")) {
		return { allowed: false, path: filePath, error: "Absolute paths are not allowed" };
	}

	return { allowed: true, path: filePath };
}
