const ALLOWED_SCHEMES = new Set(["http:", "https:"]);
const IPV4_LITERAL = /^\d+(?:\.\d+){3}$/;

// Bare allowlist entry: `host`, `*.wildcard.host`, optionally with `:port`.
const HOST_ENTRY = /^((?:\*\.)?[^\s:/*]+)(?::(\d+))?$/;

/**
 * Lowercase a hostname and strip IPv6 brackets and a trailing root dot.
 * @param {string} host - Hostname to normalize
 * @returns {string}
 */
function normalizeHost(host) {
	return host
		.toLowerCase()
		.replace(/^\[|\]$/g, "")
		.replace(/\.$/, "");
}

/**
 * Match a hostname against an exact host or a `*.example.com` wildcard pattern.
 * A wildcard matches subdomains at any depth but not the bare domain, needs at least two
 * labels after `*.` (so `*.com` matches nothing), and never matches IP literals.
 * @param {string} hostname - Hostname to test
 * @param {string} pattern - Exact host or `*.` wildcard
 * @returns {boolean}
 */
export function hostMatchesPattern(hostname, pattern) {
	if (typeof hostname !== "string" || typeof pattern !== "string") return false;
	const host = normalizeHost(hostname);
	const expected = normalizeHost(pattern.trim());
	if (expected.startsWith("*.")) {
		const suffix = expected.slice(2);
		const labels = suffix.split(".");
		if (labels.length < 2 || labels.some((label) => label === "")) return false;
		if (host.includes(":") || IPV4_LITERAL.test(host)) return false;
		return host.endsWith(`.${suffix}`);
	}
	return host === expected;
}

/**
 * Match a URL against a single allowlist entry. An entry is either a URL
 * (scheme + host [+ port] [+ path prefix]) or a bare host / `host:port` /
 * `*.wildcard`. Matching is on parsed components, never on string prefixes.
 * A URL-form entry (`https://host`) pins the scheme. A bare host entry without a port allows
 * both http and https, but only on the request scheme's default port (80 / 443); use
 * `host:port` to allow a non-default port.
 * @param {URL} parsed - Parsed request URL
 * @param {string} entry - Allowlist entry
 * @returns {boolean}
 */
function matchesAllowlistEntry(parsed, entry) {
	if (typeof entry !== "string" || !entry.trim()) return false;
	const raw = entry.trim();
	try {
		if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
			const allowed = new URL(raw);
			if (allowed.origin !== parsed.origin) return false;
			const prefix = allowed.pathname.replace(/\/+$/, "");
			return (
				prefix === "" || parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`)
			);
		}
		const match = HOST_ENTRY.exec(raw);
		if (!match) return false;
		const [, hostPattern, port] = match;
		if (!hostMatchesPattern(parsed.hostname, hostPattern)) return false;
		const effectivePort = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
		const defaultPort = parsed.protocol === "https:" ? "443" : "80";
		return effectivePort === (port ?? defaultPort);
	} catch (_err) {
		return false;
	}
}

/**
 * Filter outbound URLs, allowing only http: and https: and checking against an allowlist.
 * Makes no assumptions about network topology: which hosts are reachable is decided by
 * the allowlist, not by built-in address or hostname lists.
 * @param {string} url - The URL to validate
 * @param {string[]} [allowlist=[]] - Allowed hostnames/URLs
 * @returns {{ allowed: boolean, reason: string }}
 */
export function filterUrl(url, allowlist = []) {
	if (!url || typeof url !== "string") {
		return { allowed: false, reason: "Invalid URL" };
	}

	try {
		const parsed = new URL(url);
		const scheme = parsed.protocol.toLowerCase();

		if (!ALLOWED_SCHEMES.has(scheme)) {
			return { allowed: false, reason: `Blocked scheme: ${scheme}` };
		}

		if (allowlist.length > 0 && !allowlist.some((entry) => matchesAllowlistEntry(parsed, entry))) {
			return { allowed: false, reason: `Host not on allowlist: ${parsed.hostname.toLowerCase()}` };
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
		return ALLOWED_SCHEMES.has(scheme);
	} catch (_err) {
		return false;
	}
}
