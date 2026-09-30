import { lookup } from "node:dns/promises";

const BLOCKED_SCHEMES = new Set(["file:", "gopher:", "dict:"]);

// Internal/private IP ranges to block (RFC 1918 + loopback + link-local + metadata)
const BLOCKED_IP_PATTERNS = [
	/^127\./, // loopback
	/^0\.0\.0\.0$/, // all interfaces
	/^169\.254\./, // link-local
	/^10\./, // RFC 1918 private
	/^172\.(1[6-9]|2[0-9]|3[01])\./, // RFC 1918 private
	/^192\.168\./, // RFC 1918 private
	/^::1$/, // IPv6 loopback
	/^fe80:/i, // IPv6 link-local
	/^fc00:/i, // IPv6 unique local
	/^fd00:/i, // IPv6 unique local
];

let _testMode = false;

/**
 * Enable test mode — allows internal IPs for integration tests.
 * @param {boolean} enabled
 */
export function setTestMode(enabled) {
	_testMode = !!enabled;
}

/**
 * Normalize an allowlist entry into a hostname/port pair.
 * @param {string} entry - Allowlist entry (bare hostname, hostname:port, or full URL)
 * @returns {{ hostname: string, port: string } | null}
 */
function normalizeAllowlistEntry(entry) {
	if (!entry || typeof entry !== "string") return null;
	let parsed;
	try {
		parsed = new URL(entry.includes("://") ? entry : `https://${entry}`);
	} catch (_err) {
		return null;
	}
	return {
		hostname: parsed.hostname.toLowerCase(),
		port: parsed.port,
	};
}

/**
 * Check if a hostname or IP is an internal/private address.
 * @param {string} host - Hostname or IP to check
 * @param {Function} [resolver] - DNS resolver (defaults to dns.promises.lookup)
 * @returns {Promise<boolean>}
 */
async function isInternalHost(host, resolver = lookup) {
	if (!host || typeof host !== "string") return false;
	const lowerHost = host.toLowerCase();
	// Direct IP match
	if (BLOCKED_IP_PATTERNS.some((pattern) => pattern.test(lowerHost))) {
		return true;
	}
	// Resolve hostname to check for internal IPs
	if (lowerHost === "localhost" || lowerHost === "0.0.0.0") {
		return true;
	}
	try {
		const result = await resolver(lowerHost, { all: true });
		const addresses = Array.isArray(result) ? result : [result];
		return addresses.some((entry) => {
			const addr = typeof entry === "string" ? entry : entry?.address;
			return addr ? BLOCKED_IP_PATTERNS.some((pattern) => pattern.test(addr.toLowerCase())) : false;
		});
	} catch (_err) {
		// Fail-open: an unresolvable host cannot be fetched, so it is not an SSRF vector
		return false;
	}
}

/**
 * Filter outbound URLs, blocking prohibited schemes, internal IPs, and checking against an allowlist.
 * @param {string} url - The URL to validate
 * @param {string[]} [allowlist=[]] - Allowed hostnames/URLs
 * @param {Function} [resolver] - DNS resolver (defaults to dns.promises.lookup)
 * @returns {Promise<{ allowed: boolean, reason: string }>}
 */
export async function filterUrl(url, allowlist = [], resolver = lookup) {
	if (!url || typeof url !== "string") {
		return { allowed: false, reason: "Invalid URL" };
	}

	try {
		const parsed = new URL(url);
		const scheme = parsed.protocol.toLowerCase();

		if (BLOCKED_SCHEMES.has(scheme)) {
			return { allowed: false, reason: `Blocked scheme: ${scheme}` };
		}

		// Block internal/private IPs and hostnames (always enforced, unless test mode)
		if (!_testMode && (await isInternalHost(parsed.hostname, resolver))) {
			return { allowed: false, reason: `Blocked internal host: ${parsed.hostname}` };
		}

		if (allowlist.length > 0) {
			const hostname = parsed.hostname.toLowerCase();
			const port = parsed.port;
			const onAllowlist = allowlist.some((entry) => {
				const normalized = normalizeAllowlistEntry(entry);
				if (!normalized) return false;
				// Exact hostname match; if the entry specifies a port, require it to match too
				return (
					hostname === normalized.hostname && (normalized.port === "" || normalized.port === port)
				);
			});
			if (!onAllowlist) {
				return { allowed: false, reason: `Host not on allowlist: ${hostname}` };
			}
		}

		return { allowed: true, reason: "" };
	} catch (_err) {
		return { allowed: false, reason: "Invalid URL format" };
	}
}

/**
 * Check if a URL scheme is allowed (no allowlist check).
 * @param {string} url - The URL to check
 * @returns {boolean}
 */
export function isSchemeAllowed(url) {
	if (!url || typeof url !== "string") return false;
	try {
		const scheme = new URL(url).protocol.toLowerCase();
		return !BLOCKED_SCHEMES.has(scheme);
	} catch (_err) {
		return false;
	}
}
