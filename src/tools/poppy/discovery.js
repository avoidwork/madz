import { z } from "zod";
import { isIP } from "node:net";
import { lru } from "tiny-lru";

const WELL_KNOWN_PATH = "/.well-known/poppy.json";
const FETCH_TIMEOUT = 10000;
const DEFAULT_TTL = 3600000; // 1 hour
const MAX_REDIRECTS = 10;

/**
 * Zod schema for a Poppy `poppy.json` document (Personal Agent Protocol 1.0,
 * section 3.1). Required fields: `protocol_version`, `organization` (name,
 * domain), and at least one of `agent`, `apis`, or `web`. All URLs are
 * validated as HTTPS and non-private at runtime.
 */
export const PoppyDocumentSchema = z.object({
	protocol_version: z.string().regex(/^\d+\.\d+$/, "protocol_version must be major.minor"),
	supported_versions: z.record(z.string(), z.string()).optional(),
	organization: z.object({
		name: z.string().min(1),
		domain: z.string().min(1),
		logo_uri: z.string().optional(),
	}),
	auth: z
		.object({
			issuer: z.string().optional(),
			disabled: z.boolean().optional(),
			scopes: z.record(z.string(), z.string()).optional(),
			scope_hints: z
				.record(
					z.string(),
					z.object({
						changes: z.enum(["none", "reversible", "irreversible"]),
						personal_data: z.boolean(),
					}),
				)
				.optional(),
		})
		.optional(),
	agent: z
		.object({
			protocols: z
				.array(
					z.object({
						type: z.string().min(1),
						endpoint: z.string().min(1),
						description: z.string().min(1),
						access: z.string().optional(),
					}),
				)
				.min(1),
		})
		.optional(),
	apis: z
		.array(
			z.object({
				type: z.string().min(1),
				url: z.string().min(1),
				description: z.string().min(1),
			}),
		)
		.optional(),
	web: z
		.object({
			browser_session_endpoint: z.string().optional(),
			disabled: z.boolean().optional(),
			unscoped: z.boolean().optional(),
		})
		.optional(),
	tasks: z
		.object({
			endpoint: z.string().min(1),
		})
		.optional(),
	extensions: z.record(z.string(), z.array(z.unknown())).optional(),
});

/**
 * Check whether a hostname is a loopback, private, or link-local address.
 * Handles IPv4/IPv6 literals and the `localhost` hostname. Hostnames that are
 * not IP literals are treated as public (DNS resolution is not performed here).
 * @param {string} hostname - The hostname to check
 * @returns {boolean} True if the address is loopback/private/link-local
 */
export function isPrivateAddress(hostname) {
	if (!hostname) return true;
	const host = hostname.toLowerCase();
	if (host === "localhost" || host.endsWith(".localhost")) return true;

	const ip = isIP(host);
	if (ip === 4) {
		const parts = host.split(".").map(Number);
		// 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
		if (parts[0] === 10) return true;
		if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
		if (parts[0] === 192 && parts[1] === 168) return true;
		// 127.0.0.0/8 loopback
		if (parts[0] === 127) return true;
		// 169.254.0.0/16 link-local
		if (parts[0] === 169 && parts[1] === 254) return true;
		// 0.0.0.0/8
		if (parts[0] === 0) return true;
		return false;
	}
	if (ip === 6) {
		const lower = host.toLowerCase();
		if (lower === "::1" || lower === "::") return true;
		// fc00::/7 unique local, fe80::/10 link-local
		if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
		if (
			lower.startsWith("fe8") ||
			lower.startsWith("fe9") ||
			lower.startsWith("fea") ||
			lower.startsWith("feb")
		) {
			return true;
		}
		return false;
	}
	return false;
}

/**
 * Validate that a URL is HTTPS and not a loopback/private/link-local address.
 * @param {string} url - The URL to validate
 * @param {boolean} [allowPrivate=false] - Whether to permit private addresses
 * @returns {{ok: boolean, error?: string}} Validation result
 */
export function validateUrl(url, allowPrivate = false) {
	let parsed;
	try {
		parsed = new URL(url);
	} catch {
		return { ok: false, error: `Invalid URL: ${url}` };
	}
	if (parsed.protocol !== "https:") {
		return { ok: false, error: `URL must be HTTPS: ${url}` };
	}
	if (!allowPrivate && isPrivateAddress(parsed.hostname)) {
		return { ok: false, error: `URL points to a loopback/private/link-local address: ${url}` };
	}
	return { ok: true };
}

/**
 * Validate a Poppy document against the protocol's required fields and URL
 * rules. Checks required fields, at least one channel, domain match against
 * the serving host, and that all URLs are HTTPS and non-private.
 * @param {object} doc - The parsed poppy.json document
 * @param {string} servingHost - The host that served the document (after redirects)
 * @param {boolean} [allowPrivate=false] - Whether to permit private addresses
 * @returns {{ok: boolean, error?: string, doc?: object}} Validation result
 */
export function validateDocument(doc, servingHost, allowPrivate = false) {
	const parsed = PoppyDocumentSchema.safeParse(doc);
	if (!parsed.success) {
		return {
			ok: false,
			error: `Invalid poppy.json: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
		};
	}
	const data = parsed.data;

	if (!data.agent && !data.apis && !data.web) {
		return { ok: false, error: "poppy.json must declare at least one of agent, apis, or web" };
	}

	if (data.organization.domain.toLowerCase() !== servingHost.toLowerCase()) {
		return {
			ok: false,
			error: `organization.domain '${data.organization.domain}' does not match serving host '${servingHost}'`,
		};
	}

	// Validate all URLs are HTTPS and non-private.
	const urls = [];
	if (data.organization.logo_uri) urls.push(data.organization.logo_uri);
	if (data.auth?.issuer) urls.push(data.auth.issuer);
	if (data.agent) {
		for (const p of data.agent.protocols) urls.push(p.endpoint);
	}
	if (data.apis) {
		for (const a of data.apis) urls.push(a.url);
	}
	if (data.web?.browser_session_endpoint) urls.push(data.web.browser_session_endpoint);
	if (data.tasks?.endpoint) urls.push(data.tasks.endpoint);
	for (const url of urls) {
		const result = validateUrl(url, allowPrivate);
		if (!result.ok) return result;
	}

	return { ok: true, doc: data };
}

/**
 * Select the newest compatible protocol version from `protocol_version` and
 * `supported_versions`. Two versions are compatible when they share a major
 * version and, before 1.0, the same minor version. Returns the chosen version
 * string, or null if none is compatible.
 * @param {string} protocolVersion - The document's protocol_version
 * @param {Record<string, string>} [supportedVersions] - Map of version to URL
 * @param {string} [implementedVersion] - The version this agent implements
 * @returns {string | null} The chosen version, or null if none compatible
 */
export function selectVersion(protocolVersion, supportedVersions = {}, implementedVersion = "1.0") {
	const candidates = [protocolVersion, ...Object.keys(supportedVersions)];
	const [implMajor, implMinor] = implementedVersion.split(".").map(Number);
	const compatible = candidates.filter((v) => {
		const [major, minor] = v.split(".").map(Number);
		if (major !== implMajor) return false;
		// Before 1.0, minor must match exactly; from 1.0, newer minor is compatible.
		if (major < 1) return minor === implMinor;
		return minor <= implMinor;
	});
	if (compatible.length === 0) return null;
	return compatible.sort((a, b) => {
		const [am, ai] = a.split(".").map(Number);
		const [bm, bi] = b.split(".").map(Number);
		return bm - am || bi - ai;
	})[0];
}

/**
 * Normalize a validated Poppy document into a stable, typed representation for
 * downstream layers.
 * @param {object} doc - The validated poppy.json document
 * @param {string} servingHost - The host that served the document
 * @returns {object} Normalized representation
 */
export function normalizeDocument(doc, servingHost) {
	return {
		protocolVersion: doc.protocol_version,
		organization: {
			name: doc.organization.name,
			domain: doc.organization.domain,
			logoUri: doc.organization.logo_uri,
		},
		channels: {
			agent: doc.agent
				? {
						protocols: doc.agent.protocols.map((p) => ({
							type: p.type,
							endpoint: p.endpoint,
							description: p.description,
							access: p.access,
						})),
					}
				: undefined,
			apis: doc.apis
				? doc.apis.map((a) => ({ type: a.type, url: a.url, description: a.description }))
				: undefined,
			web: doc.web
				? {
						browserSessionEndpoint: doc.web.browser_session_endpoint,
						disabled: doc.web.disabled,
						unscoped: doc.web.unscoped,
					}
				: undefined,
		},
		auth: doc.auth
			? {
					issuer: doc.auth.issuer,
					disabled: doc.auth.disabled,
					scopes: doc.auth.scopes,
					scopeHints: doc.auth.scope_hints,
				}
			: undefined,
		tasks: doc.tasks ? { endpoint: doc.tasks.endpoint } : undefined,
		extensions: doc.extensions,
		supportedVersions: doc.supported_versions,
		servingHost,
	};
}

/**
 * Fetch a company's `poppy.json` over HTTPS, following redirects with strict
 * protocol rules: every hop MUST be HTTPS, and the final URL's path MUST be
 * exactly `/.well-known/poppy.json` with no query.
 * @param {string} domain - The company domain to fetch from
 * @param {object} [options] - Fetch options
 * @param {boolean} [options.allowPrivate=false] - Permit loopback/private addresses
 * @param {number} [options.timeout=10000] - Fetch timeout in ms
 * @returns {Promise<{ok: boolean, doc?: object, servingHost?: string, error?: string}>} Result
 */
export async function fetchPoppy(domain, options = {}) {
	const allowPrivate = options.allowPrivate ?? false;
	const timeout = options.timeout ?? FETCH_TIMEOUT;

	const initial = new URL(`https://${domain}${WELL_KNOWN_PATH}`);
	if (!allowPrivate && isPrivateAddress(initial.hostname)) {
		return {
			ok: false,
			error: `Domain resolves to a loopback/private/link-local address: ${domain}`,
		};
	}

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);
	let current = initial;
	try {
		for (let i = 0; i <= MAX_REDIRECTS; i++) {
			if (current.protocol !== "https:") {
				return { ok: false, error: `Redirect to non-HTTPS URL: ${current.href}` };
			}
			const resp = await fetch(current, {
				redirect: "manual",
				signal: controller.signal,
			});
			if (resp.status >= 300 && resp.status < 400) {
				const location = resp.headers.get("location");
				if (!location) {
					return { ok: false, error: `Redirect without Location header: ${current.href}` };
				}
				current = new URL(location, current);
				continue;
			}
			if (!resp.ok) {
				return { ok: false, error: `HTTP error ${resp.status} fetching ${current.href}` };
			}
			if (current.pathname !== WELL_KNOWN_PATH) {
				return {
					ok: false,
					error: `Final URL path must be ${WELL_KNOWN_PATH}: ${current.pathname}`,
				};
			}
			if (current.search) {
				return { ok: false, error: `Final URL must have no query string: ${current.href}` };
			}
			const text = await resp.text();
			let doc;
			try {
				doc = JSON.parse(text);
			} catch {
				return { ok: false, error: "poppy.json is not valid JSON" };
			}
			return { ok: true, doc, servingHost: current.hostname };
		}
		return { ok: false, error: `Too many redirects fetching ${domain}` };
	} catch (err) {
		if (err.name === "AbortError") {
			return { ok: false, error: `Timed out fetching ${domain}` };
		}
		return { ok: false, error: `Failed to fetch ${domain}: ${err.message}` };
	} finally {
		clearTimeout(timeoutId);
	}
}

/**
 * Discover a company's Poppy capabilities. Checks the per-domain cache first,
 * then fetches, validates, and normalizes the document, caching the result.
 * @param {string} domain - The company domain
 * @param {object} [options] - Discovery options
 * @param {boolean} [options.allowPrivate=false] - Permit loopback/private addresses
 * @param {number} [options.ttl=3600000] - Cache TTL in ms
 * @param {string} [options.implementedVersion="1.0"] - Version this agent implements
 * @returns {Promise<{ok: boolean, data?: object, source?: string, error?: string}>} Result
 */
export async function discoverPoppy(domain, options = {}) {
	const allowPrivate = options.allowPrivate ?? false;
	const ttl = options.ttl ?? DEFAULT_TTL;
	const implementedVersion = options.implementedVersion ?? "1.0";
	const key = domain.toLowerCase();

	const cached = cache.get(key);
	if (cached) {
		return { ok: true, data: cached, source: "cache" };
	}

	const fetched = await fetchPoppy(domain, { allowPrivate });
	if (!fetched.ok) {
		return { ok: false, error: fetched.error };
	}

	const validated = validateDocument(fetched.doc, fetched.servingHost, allowPrivate);
	if (!validated.ok) {
		return { ok: false, error: validated.error };
	}

	const selected = selectVersion(
		validated.doc.protocol_version,
		validated.doc.supported_versions,
		implementedVersion,
	);
	if (!selected) {
		return { ok: false, error: "No compatible protocol version found" };
	}

	const normalized = normalizeDocument(validated.doc, fetched.servingHost);
	normalized.selectedVersion = selected;
	normalized.fetchedAt = new Date().toISOString();

	cache.set(key, normalized, ttl);
	return { ok: true, data: normalized, source: "network" };
}

/**
 * Tool implementation for the `poppy` discovery tool.
 * @param {object} input - Tool input
 * @param {object} [options] - Runtime options
 * @param {boolean} [options.allowPrivate=false] - Permit loopback/private addresses
 * @param {number} [options.ttl] - Cache TTL in ms
 * @param {string} [options.implementedVersion="1.0"] - Version this agent implements
 * @returns {Promise<{ok: boolean, data?: object, source?: string, error?: string}>} Result
 */
export async function poppyImpl(input, options = {}) {
	const { domain } = input;
	if (!domain || typeof domain !== "string" || domain.trim().length === 0) {
		return { ok: false, error: "Domain is required" };
	}
	return discoverPoppy(domain.trim(), options);
}

// Per-domain LRU cache with TTL. Keyed by lowercase domain.
const cache = lru(1000, DEFAULT_TTL);
