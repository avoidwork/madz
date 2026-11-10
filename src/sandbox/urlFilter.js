import { BlockList, isIP } from "node:net";
import { lookup } from "node:dns/promises";

// Only plain web schemes may leave the sandbox. Everything else (file:, gopher:,
// dict:, ftp:, ws:, data:, ...) is rejected by default.
const ALLOWED_SCHEMES = new Set(["http:", "https:"]);

// Hostnames that always point at the local machine or cloud metadata services.
const BLOCKED_HOSTNAMES = new Set([
	"localhost",
	"metadata",
	"metadata.google.internal",
	"instance-data",
]);
const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".localdomain", ".internal", ".home.arpa"];

// Non-public address space: loopback, RFC 1918, CGNAT, link-local (incl. cloud
// metadata 169.254.169.254), multicast, reserved, and the IPv6 equivalents.
// IPv4-mapped IPv6 addresses (::ffff:a.b.c.d) are checked against the IPv4 rules
// by BlockList itself.
const BLOCKED_IPV4_RANGES = [
	["0.0.0.0", 8],
	["10.0.0.0", 8],
	["100.64.0.0", 10],
	["127.0.0.0", 8],
	["169.254.0.0", 16],
	["172.16.0.0", 12],
	["192.0.0.0", 24],
	["192.168.0.0", 16],
	["198.18.0.0", 15],
	["224.0.0.0", 4],
	["240.0.0.0", 4],
];
const BLOCKED_IPV6_RANGES = [
	["::", 128],
	["::1", 128],
	["64:ff9b::", 96],
	["2002::", 16],
	["fc00::", 7],
	["fe80::", 10],
	["fec0::", 10],
	["ff00::", 8],
];

const INTERNAL_RANGES = new BlockList();
for (const [address, prefix] of BLOCKED_IPV4_RANGES) {
	INTERNAL_RANGES.addSubnet(address, prefix, "ipv4");
}
for (const [address, prefix] of BLOCKED_IPV6_RANGES) {
	INTERNAL_RANGES.addSubnet(address, prefix, "ipv6");
}

// Bare allowlist entry: `host`, `*.wildcard.host`, optionally with `:port`.
const HOST_ENTRY = /^((?:\*\.)?[^\s:/*]+)(?::(\d+))?$/;

let _testMode = false;

/**
 * Whether the process is running under a test runner.
 * @returns {boolean}
 */
function isTestRuntime() {
	return process.env.NODE_ENV === "test" || process.env.NODE_TEST_CONTEXT !== undefined;
}

/**
 * Enable test mode — allows internal IPs for integration tests.
 * Only takes effect when running under a test runner (`node --test` or
 * `NODE_ENV=test`); in a production process the call is a no-op so the SSRF
 * protections cannot be switched off at runtime.
 * @param {boolean} enabled
 */
export function setTestMode(enabled) {
	_testMode = !!enabled && isTestRuntime();
}

/**
 * Lowercase a hostname and strip IPv6 brackets and a trailing root dot.
 * @param {string} host
 * @returns {string}
 */
function normalizeHost(host) {
	return host
		.toLowerCase()
		.replace(/^\[|\]$/g, "")
		.replace(/\.$/, "");
}

/**
 * Check if a hostname or IP is an internal/private address.
 * Handles bracketed IPv6, IPv4-mapped IPv6, trailing-dot hostnames and
 * well-known internal names. Does not resolve DNS; see `filterUrlResolved`.
 * @param {string} host - Hostname or IP to check
 * @returns {boolean}
 */
export function isInternalHost(host) {
	if (!host || typeof host !== "string") return false;
	const name = normalizeHost(host);
	const family = isIP(name);
	if (family) {
		return INTERNAL_RANGES.check(name, family === 4 ? "ipv4" : "ipv6");
	}
	return BLOCKED_HOSTNAMES.has(name) || BLOCKED_HOST_SUFFIXES.some((s) => name.endsWith(s));
}

/**
 * Match a hostname against an exact host or a `*.example.com` wildcard pattern.
 * @param {string} hostname - Hostname to test
 * @param {string} pattern - Exact host or `*.` wildcard
 * @returns {boolean}
 */
export function hostMatchesPattern(hostname, pattern) {
	if (typeof hostname !== "string" || typeof pattern !== "string") return false;
	const host = normalizeHost(hostname);
	const expected = normalizeHost(pattern.trim());
	if (expected.startsWith("*.")) {
		return host.endsWith(expected.slice(1));
	}
	return host === expected;
}

/**
 * Match a URL against a single allowlist entry. An entry is either a URL
 * (scheme + host [+ port] [+ path prefix]) or a bare host / `host:port` /
 * `*.wildcard`. Matching is on parsed components, never on string prefixes.
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
		return port === undefined || port === effectivePort;
	} catch (_err) {
		return false;
	}
}

/**
 * Filter outbound URLs, blocking prohibited schemes, internal IPs, and checking against an allowlist.
 * Synchronous: inspects the URL text only. Use `filterUrlResolved` before making a request
 * so hostnames that resolve to internal addresses are caught as well.
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

		// Block internal/private IPs and hostnames (always enforced, unless test mode)
		if (!_testMode && isInternalHost(parsed.hostname)) {
			return { allowed: false, reason: `Blocked internal host: ${parsed.hostname}` };
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
 * Default DNS resolver: every A/AAAA address for a hostname.
 * @param {string} hostname
 * @returns {Promise<string[]>}
 */
async function resolveAddresses(hostname) {
	const records = await lookup(hostname, { all: true });
	return records.map((record) => record.address);
}

/**
 * `filterUrl` plus DNS resolution: a hostname is rejected when any address it
 * resolves to is internal (fails closed when resolution fails). Skipped in test mode.
 * @param {string} url - The URL to validate
 * @param {string[]} [allowlist=[]] - Allowed hostnames/URLs
 * @param {object} [options]
 * @param {(hostname: string) => Promise<string[]>} [options.resolve] - Resolver override
 * @returns {Promise<{ allowed: boolean, reason: string }>}
 */
export async function filterUrlResolved(url, allowlist = [], { resolve = resolveAddresses } = {}) {
	const base = filterUrl(url, allowlist);
	if (!base.allowed || _testMode) return base;

	const hostname = normalizeHost(new URL(url).hostname);
	if (isIP(hostname)) return base;

	let addresses;
	try {
		addresses = await resolve(hostname);
	} catch (_err) {
		return { allowed: false, reason: `DNS resolution failed for ${hostname}` };
	}
	if (!Array.isArray(addresses) || addresses.length === 0) {
		return { allowed: false, reason: `DNS resolution failed for ${hostname}` };
	}
	if (addresses.some((address) => isInternalHost(address))) {
		return {
			allowed: false,
			reason: `Blocked internal host: ${hostname} resolves to internal address`,
		};
	}
	return base;
}

/**
 * Check if a URL scheme is allowed (no allowlist check).
 * @param {string} url - The URL to check
 * @returns {boolean}
 */
export function isSchemeAllowed(url) {
	if (!url || typeof url !== "string") return false;
	try {
		return ALLOWED_SCHEMES.has(new URL(url).protocol.toLowerCase());
	} catch (_err) {
		return false;
	}
}
