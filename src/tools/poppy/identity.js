import { z } from "zod";
import { generateKeyPair, exportJWK, exportPKCS8, importPKCS8, SignJWT } from "jose";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

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
 * Serialize a private signing key to a PKCS8 PEM string so it can be persisted
 * (e.g., to disk) and re-imported later. The private key material never passes
 * through the model's context; it is stored server-side.
 * @param {CryptoKey} privateKey - The private signing key
 * @returns {Promise<string>} The PKCS8 PEM-encoded private key
 */
export async function serializePrivateKey(privateKey) {
	return exportPKCS8(privateKey);
}

/**
 * Deserialize a PKCS8 PEM string back into a CryptoKey for signing.
 * @param {string} pem - The PKCS8 PEM-encoded private key
 * @param {string} [alg="ES256"] - The signing algorithm (ES256 or PS384)
 * @returns {Promise<CryptoKey>} The imported private signing key
 */
export async function deserializePrivateKey(pem, alg = "ES256") {
	return importPKCS8(pem, alg);
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

/**
 * Persist a private key PEM to disk under a key directory.
 * @param {string} keyDir - Directory for persisted private keys
 * @param {string} keyId - Identifier for the key
 * @param {string} pem - The PKCS8 PEM-encoded private key
 * @returns {Promise<void>} Resolves when the key is written
 */
async function persistKey(keyDir, keyId, pem) {
	await mkdir(keyDir, { recursive: true });
	await writeFile(join(keyDir, `${keyId}.pem`), pem, "utf8");
}

/**
 * Load a persisted private key PEM from disk.
 * @param {string} keyDir - Directory for persisted private keys
 * @param {string} keyId - Identifier for the key
 * @returns {Promise<string | null>} The PEM, or null if not found
 */
async function loadKey(keyDir, keyId) {
	try {
		return await readFile(join(keyDir, `${keyId}.pem`), "utf8");
	} catch {
		return null;
	}
}

/**
 * The `identity` action of the Poppy tool. Dispatches on a sub-action to
 * manage the agent's client metadata document and signing keys. Key material is
 * persisted server-side (in `options.keyDir`) and never exposed to the model.
 * @param {object} input - Action input
 * @param {string} input.op - The identity operation to perform
 * @param {object} [options] - Runtime options
 * @param {string} [options.keyDir] - Directory for persisted private keys
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
export async function identityAction(input, options = {}) {
	const { op } = input;
	switch (op) {
		case "build_metadata":
			return buildMetadataAction(input, options);
		case "generate_key":
			return generateKeyAction(input, options);
		case "sign_assertion":
			return signAssertionAction(input, options);
		case "validate_redirect":
			return validateRedirectAction(input, options);
		case "validate_jwks":
			return validateJwksAction(input, options);
		case "validate_metadata":
			return validateMetadataAction(input, options);
		default:
			return { ok: false, error: `Unknown identity operation: ${op}` };
	}
}

/**
 * Build the agent's client metadata document (CIMD).
 * @param {object} input - Action input
 * @param {string} input.clientId - The agent's client_id URL
 * @param {string} input.clientName - The agent's display name
 * @param {string} input.jwksUri - The public JWKS URL
 * @param {string[]} input.redirectUris - Valid redirect URIs
 * @param {string} [input.logoUri] - Optional logo URL
 * @returns {{ok: boolean, data?: object, error?: string}} Result
 */
function buildMetadataAction(input) {
	const { clientId, clientName, jwksUri, redirectUris, logoUri } = input;
	if (
		!clientId ||
		!clientName ||
		!jwksUri ||
		!Array.isArray(redirectUris) ||
		redirectUris.length === 0
	) {
		return { ok: false, error: "clientId, clientName, jwksUri, and redirectUris are required" };
	}
	const doc = buildClientMetadata({ clientId, clientName, jwksUri, redirectUris, logoUri });
	return { ok: true, data: doc };
}

/**
 * Generate a signing key pair, persist the private key server-side, and return
 * the public JWKS. The private key is never returned to the model.
 * @param {object} input - Action input
 * @param {string} [input.alg="ES256"] - The signing algorithm
 * @param {string} [input.keyId="default"] - Identifier for the persisted key
 * @param {object} [options] - Runtime options
 * @param {string} [options.keyDir] - Directory for persisted private keys
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
async function generateKeyAction(input, options = {}) {
	const alg = input.alg ?? "ES256";
	const keyId = input.keyId ?? "default";
	if (!SUPPORTED_ALGS.includes(alg)) {
		return { ok: false, error: `Unsupported signing algorithm: ${alg}` };
	}
	try {
		const { publicKey, privateKey } = await generateSigningKey(alg);
		const jwks = await exportPublicJwks(publicKey);
		if (options.keyDir) {
			const pem = await serializePrivateKey(privateKey);
			await persistKey(options.keyDir, keyId, pem);
		}
		return { ok: true, data: { alg, keyId, jwks } };
	} catch (err) {
		return { ok: false, error: err.message };
	}
}

/**
 * Sign a client assertion (RFC 7523) with a persisted private key.
 * @param {object} input - Action input
 * @param {string} input.clientId - The agent's client_id (issuer/subject)
 * @param {string} input.audience - The company's issuer (audience)
 * @param {string} [input.alg="ES256"] - The signing algorithm
 * @param {string} [input.keyId="default"] - Identifier for the persisted key
 * @param {object} [options] - Runtime options
 * @param {string} [options.keyDir] - Directory for persisted private keys
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
async function signAssertionAction(input, options = {}) {
	const { clientId, audience } = input;
	const alg = input.alg ?? "ES256";
	const keyId = input.keyId ?? "default";
	if (!clientId || !audience) {
		return { ok: false, error: "clientId and audience are required" };
	}
	if (!options.keyDir) {
		return { ok: false, error: "keyDir is required to load the signing key" };
	}
	try {
		const pem = await loadKey(options.keyDir, keyId);
		if (!pem) {
			return { ok: false, error: `No persisted key found for '${keyId}'` };
		}
		const privateKey = await deserializePrivateKey(pem, alg);
		const result = await signClientAssertion({ privateKey, clientId, audience, alg });
		return { ok: true, data: result };
	} catch (err) {
		return { ok: false, error: err.message };
	}
}

/**
 * Validate a redirect URI against the Poppy rules.
 * @param {object} input - Action input
 * @param {string} input.uri - The redirect URI to validate
 * @param {string} input.clientId - The agent's client_id URL
 * @returns {{ok: boolean, data?: object, error?: string}} Result
 */
function validateRedirectAction(input) {
	const { uri, clientId } = input;
	if (!uri || !clientId) {
		return { ok: false, error: "uri and clientId are required" };
	}
	const result = validateRedirectUri(uri, clientId);
	return result.ok ? { ok: true, data: { valid: true } } : { ok: false, error: result.error };
}

/**
 * Validate a jwks_uri against the Poppy rules.
 * @param {object} input - Action input
 * @param {string} input.jwksUri - The public JWKS URL
 * @param {string} input.clientId - The agent's client_id URL
 * @returns {{ok: boolean, data?: object, error?: string}} Result
 */
function validateJwksAction(input) {
	const { jwksUri, clientId } = input;
	if (!jwksUri || !clientId) {
		return { ok: false, error: "jwksUri and clientId are required" };
	}
	const result = validateJwksUri(jwksUri, clientId);
	return result.ok ? { ok: true, data: { valid: true } } : { ok: false, error: result.error };
}

/**
 * Validate a client metadata document against the CIMD schema.
 * @param {object} input - Action input
 * @param {object} input.doc - The client metadata document to validate
 * @returns {{ok: boolean, data?: object, error?: string}} Result
 */
function validateMetadataAction(input) {
	const { doc } = input;
	if (!doc) {
		return { ok: false, error: "doc is required" };
	}
	const result = validateClientMetadata(doc);
	return result.ok ? { ok: true, data: { valid: true } } : { ok: false, error: result.error };
}
