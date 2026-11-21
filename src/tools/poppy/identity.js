import { z } from "zod";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { randomUUID } from "node:crypto";

/**
 * Signing algorithms supported for Poppy client assertions and key generation.
 * @type {readonly string[]}
 */
export const SUPPORTED_ALGS = Object.freeze(["ES256", "PS384"]);

/** Maximum lifetime of a client assertion in seconds (RFC 7523). */
const MAX_ASSERTION_TTL = 300;

/**
 * Zod schema for a Poppy client metadata document (CIMD). Required fields:
 * `client_id`, `client_name`, `jwks_uri`, `redirect_uris`, and
 * `token_endpoint_auth_method`. `logo_uri` is optional.
 */
export const ClientMetadataSchema = z.object({
	client_id: z.string().url(),
	client_name: z.string().min(1),
	logo_uri: z.string().url().optional(),
	jwks_uri: z.string().url(),
	redirect_uris: z.array(z.string()).min(1),
	token_endpoint_auth_method: z.literal("private_key_jwt"),
});

/**
 * Validate a client metadata document against the CIMD schema.
 * @param {object} doc - The client metadata document to validate
 * @returns {{ok: boolean, error?: string, doc?: object}} Validation result
 */
export function validateClientMetadata(doc) {
	const parsed = ClientMetadataSchema.safeParse(doc);
	if (!parsed.success) {
		return {
			ok: false,
			error: `Invalid client metadata: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
		};
	}
	return { ok: true, doc: parsed.data };
}

/**
 * Build a client metadata document (CIMD) for the agent. The `client_id` field
 * is set to the configured `client_id` URL (the URL the document is fetched
 * from), and `token_endpoint_auth_method` is `private_key_jwt`.
 * @param {object} config - Identity configuration
 * @param {string} config.clientId - The agent's client_id URL
 * @param {string} config.clientName - The agent's display name
 * @param {string} config.jwksUri - The public JWKS URL (same domain as client_id)
 * @param {string[]} config.redirectUris - Valid redirect URIs
 * @param {string} [config.logoUri] - Optional logo URL
 * @returns {object} The client metadata document
 */
export function buildClientMetadata(config) {
	const doc = {
		client_id: config.clientId,
		client_name: config.clientName,
		jwks_uri: config.jwksUri,
		redirect_uris: config.redirectUris,
		token_endpoint_auth_method: "private_key_jwt",
	};
	if (config.logoUri) {
		doc.logo_uri = config.logoUri;
	}
	return doc;
}

/**
 * Derive a `jwks_uri` on the same domain as `client_id`. The JWKS is served at
 * `/.well-known/jwks.json` on the client_id host.
 * @param {string} clientId - The agent's client_id URL
 * @returns {string} The derived jwks_uri
 */
export function deriveJwksUri(clientId) {
	const parsed = new URL(clientId);
	return `${parsed.protocol}//${parsed.host}/.well-known/jwks.json`;
}

/**
 * Validate a redirect URI against the Poppy rules: it MUST be an HTTPS URL on
 * the same domain as `client_id`, or a loopback redirect URI per RFC 8252 §7.3.
 * @param {string} uri - The redirect URI to validate
 * @param {string} clientId - The agent's client_id URL
 * @returns {{ok: boolean, error?: string}} Validation result
 */
export function validateRedirectUri(uri, clientId) {
	let parsed;
	try {
		parsed = new URL(uri);
	} catch {
		return { ok: false, error: `Invalid redirect URI: ${uri}` };
	}

	const host = parsed.hostname.toLowerCase();
	// Loopback redirect URIs per RFC 8252 §7.3 (http://127.0.0.1 or http://[::1]).
	if (host === "127.0.0.1" || host === "[::1]" || host === "::1") {
		return { ok: true };
	}

	if (parsed.protocol !== "https:") {
		return { ok: false, error: `Redirect URI must be HTTPS: ${uri}` };
	}

	const clientHost = new URL(clientId).hostname.toLowerCase();
	if (host !== clientHost) {
		return { ok: false, error: `Redirect URI must be on the same domain as client_id: ${uri}` };
	}

	return { ok: true };
}

/**
 * Validate a `jwks_uri` is on the same domain as `client_id`.
 * @param {string} jwksUri - The public JWKS URL
 * @param {string} clientId - The agent's client_id URL
 * @returns {{ok: boolean, error?: string}} Validation result
 */
export function validateJwksUri(jwksUri, clientId) {
	let parsed;
	try {
		parsed = new URL(jwksUri);
	} catch {
		return { ok: false, error: `Invalid jwks_uri: ${jwksUri}` };
	}
	if (parsed.protocol !== "https:") {
		return { ok: false, error: `jwks_uri must be HTTPS: ${jwksUri}` };
	}
	const clientHost = new URL(clientId).hostname.toLowerCase();
	if (parsed.hostname.toLowerCase() !== clientHost) {
		return { ok: false, error: `jwks_uri must be on the same domain as client_id: ${jwksUri}` };
	}
	return { ok: true };
}

/**
 * Generate a signing key pair for the given algorithm.
 * @param {string} [alg="ES256"] - The signing algorithm (ES256 or PS384)
 * @returns {Promise<{publicKey: CryptoKey, privateKey: CryptoKey}>} The key pair
 */
export async function generateSigningKey(alg = "ES256") {
	if (!SUPPORTED_ALGS.includes(alg)) {
		throw new Error(`Unsupported signing algorithm: ${alg}`);
	}
	return generateKeyPair(alg, { extractable: true });
}

/**
 * Export a public key as a JWK set (public keys only). Private key material is
 * never included.
 * @param {CryptoKey} publicKey - The public key to export
 * @returns {Promise<{keys: object[]}>} The JWK set
 */
export async function exportPublicJwks(publicKey) {
	const jwk = await exportJWK(publicKey);
	return { keys: [jwk] };
}

/**
 * Sign a client assertion (RFC 7523) with a key from `jwks_uri`. The assertion
 * includes `aud` set to the company's issuer, `iat`, a unique `jti`, and `exp`
 * at most 5 minutes after `iat`.
 * @param {object} options - Signing options
 * @param {CryptoKey} options.privateKey - The private signing key
 * @param {string} options.clientId - The agent's client_id (issuer/subject)
 * @param {string} options.audience - The company's issuer (audience)
 * @param {string} [options.alg="ES256"] - The signing algorithm (ES256 or PS384)
 * @param {number} [options.now=Date.now()] - Current time in ms (for testing)
 * @returns {Promise<{jwt: string, jti: string, iat: number, exp: number}>} The signed assertion
 */
export async function signClientAssertion(options) {
	const { privateKey, clientId, audience } = options;
	const alg = options.alg ?? "ES256";
	const now = options.now ?? Date.now();

	if (!SUPPORTED_ALGS.includes(alg)) {
		throw new Error(`Unsupported signing algorithm: ${alg}`);
	}

	const iat = Math.floor(now / 1000);
	const exp = iat + MAX_ASSERTION_TTL;
	const jti = randomUUID();

	const jwt = await new SignJWT({})
		.setProtectedHeader({ alg })
		.setIssuer(clientId)
		.setSubject(clientId)
		.setAudience(audience)
		.setIssuedAt(iat)
		.setExpirationTime(exp)
		.setJti(jti)
		.sign(privateKey);

	return { jwt, jti, iat, exp };
}
