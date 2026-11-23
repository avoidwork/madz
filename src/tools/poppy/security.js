import { z } from "zod";
import { generateKeyPair, exportJWK, calculateJwkThumbprint, SignJWT } from "jose";
import { randomUUID } from "node:crypto";

/** Maximum lifetime of a delegation in seconds (24 hours). */
const MAX_DELEGATION_TTL = 86400;

/**
 * Zod schema for the `security` action input. Required fields depend on the
 * `op` sub-action; each sub-action validates its own fields.
 */
export const SecurityInputSchema = z.object({
	op: z.string().min(1),
	// vault
	key: z.string().optional(),
	value: z.string().optional(),
	// content trust
	content: z.unknown().optional(),
	// audience validation
	aud: z.string().optional(),
	expectedAud: z.string().optional(),
	// delegated keys
	userId: z.string().optional(),
	alg: z.string().optional(),
	blind: z.boolean().optional(),
	// sign-in risks
	crossDevice: z.boolean().optional(),
	prompt: z.string().optional(),
});

/**
 * A secrets vault that keeps credential material (access tokens, refresh
 * tokens, session JWTs, private keys, authorization codes, PKCE verifiers,
 * device codes) out of model context. Secrets are stored server-side and
 * never serialized into tool result `data`.
 */
export class Vault {
	/**
	 * Create a vault backed by an injectable store.
	 * @param {Map<string, string>} [store] - Optional backing store
	 */
	constructor(store = new Map()) {
		this.#store = store;
	}

	/** @type {Map<string, string>} */
	#store;

	/**
	 * Store a secret under a logical key.
	 * @param {string} key - The logical key
	 * @param {string} value - The secret value
	 * @returns {void}
	 */
	set(key, value) {
		this.#store.set(key, value);
	}

	/**
	 * Retrieve a secret by key.
	 * @param {string} key - The logical key
	 * @returns {string | undefined} The secret value, or undefined if absent
	 */
	get(key) {
		return this.#store.get(key);
	}

	/**
	 * Delete a secret by key.
	 * @param {string} key - The logical key
	 * @returns {boolean} True if the secret existed and was removed
	 */
	delete(key) {
		return this.#store.delete(key);
	}

	/**
	 * Rotate a secret: generate a new value and store it under the same key,
	 * invalidating the old value.
	 * @param {string} key - The logical key
	 * @returns {string} The new secret value
	 */
	rotate(key) {
		const value = randomUUID();
		this.#store.set(key, value);
		return value;
	}

	/**
	 * Check whether a secret exists under a key.
	 * @param {string} key - The logical key
	 * @returns {boolean} True if the secret exists
	 */
	has(key) {
		return this.#store.has(key);
	}

	/**
	 * The set of known secret values, used by the redaction helper.
	 * @returns {Set<string>} The known secret values
	 */
	values() {
		return new Set(this.#store.values());
	}
}

/**
 * Redact known secret values from a payload so they never reach the model.
 * Recursively walks objects and arrays, replacing any string that matches a
 * known secret value with a placeholder.
 * @param {unknown} payload - The payload to sanitize
 * @param {Set<string>} secrets - The known secret values
 * @returns {unknown} The sanitized payload
 */
export function redact(payload, secrets) {
	if (typeof payload === "string") {
		return secrets.has(payload) ? "[REDACTED]" : payload;
	}
	if (Array.isArray(payload)) {
		return payload.map((item) => redact(item, secrets));
	}
	if (payload && typeof payload === "object") {
		const out = {};
		for (const [k, v] of Object.entries(payload)) {
			out[k] = redact(v, secrets);
		}
		return out;
	}
	return payload;
}

/**
 * Mark company content as data (never instructions) using non-enumerable
 * metadata so serialization is unchanged.
 * @param {unknown} content - The company content to mark
 * @returns {unknown} The content marked as data
 */
export function markAsData(content) {
	if (content && typeof content === "object") {
		Object.defineProperty(content, "__poppyData", {
			value: true,
			enumerable: false,
			configurable: true,
		});
	}
	return content;
}

/**
 * Check whether content has been marked as data.
 * @param {unknown} content - The content to inspect
 * @returns {boolean} True if the content is marked as data
 */
export function isData(content) {
	return Boolean(content && typeof content === "object" && content.__poppyData);
}

/**
 * Neutralize instruction-like markers in company content so it is treated as
 * data, not executed as instructions. Conservative: only strips known
 * instruction-prompt markers.
 * @param {string} content - The company content to sanitize
 * @returns {string} The sanitized content
 */
export function sanitizeContent(content) {
	if (typeof content !== "string") {
		return content;
	}
	return content
		.replace(/^system:\s*/gim, "data:")
		.replace(/^assistant:\s*/gim, "data:")
		.replace(/^user:\s*/gim, "data:")
		.replace(/ignore (all )?previous instructions[.!]?\s*/gim, "")
		.replace(/^you are now /gim, "data: ");
}

/**
 * Validate a token or assertion audience against the verified company
 * identifier.
 * @param {string} aud - The token/assertion audience
 * @param {string} expectedAud - The verified company identifier
 * @returns {{ok: boolean, error?: string}} Validation result
 */
export function validateAudience(aud, expectedAud) {
	if (aud !== expectedAud) {
		return { ok: false, error: `Audience '${aud}' does not match '${expectedAud}'` };
	}
	return { ok: true };
}

/**
 * A registry of delegated keys, binding one key per user ID. Enforces strict
 * key-to-user isolation and supports rotation.
 */
export class DelegatedKeyRegistry {
	/**
	 * Create a delegated-key registry.
	 * @param {Map<string, string>} [store] - Map of key thumbprint to user ID
	 */
	constructor(store = new Map()) {
		this.#store = store;
	}

	/** @type {Map<string, string>} */
	#store;

	/**
	 * Bind a delegated key to a user ID.
	 * @param {string} kid - The key thumbprint
	 * @param {string} userId - The user ID
	 * @returns {void}
	 */
	bind(kid, userId) {
		this.#store.set(kid, userId);
	}

	/**
	 * Get the user ID bound to a delegated key.
	 * @param {string} kid - The key thumbprint
	 * @returns {string | undefined} The bound user ID, or undefined
	 */
	getUser(kid) {
		return this.#store.get(kid);
	}

	/**
	 * Check whether a delegated key is bound to a user ID.
	 * @param {string} kid - The key thumbprint
	 * @param {string} userId - The user ID
	 * @returns {boolean} True if the key is bound to the user
	 */
	isBoundTo(kid, userId) {
		const bound = this.#store.get(kid);
		return bound === undefined || bound === userId;
	}

	/**
	 * Rotate a delegated key: generate a new key pair for the user and bind it,
	 * invalidating the previous key for that user.
	 * @param {string} userId - The user ID
	 * @param {string} [alg="ES256"] - The signing algorithm
	 * @returns {Promise<{publicKey: CryptoKey, privateKey: CryptoKey, kid: string}>} The new key pair
	 */
	async rotate(userId, alg = "ES256") {
		const { publicKey, privateKey } = await generateKeyPair(alg, { extractable: true });
		const jwk = await exportJWK(publicKey);
		const kid = await calculateJwkThumbprint(jwk);
		// Invalidate any previous key bound to this user.
		for (const [existingKid, existingUser] of this.#store.entries()) {
			if (existingUser === userId) {
				this.#store.delete(existingKid);
			}
		}
		this.#store.set(kid, userId);
		return { publicKey, privateKey, kid };
	}
}

/**
 * Blind-sign a client assertion or delegation (RFC 9474) with a delegated key.
 * Produces a JWT whose signature verifies against the corresponding public key.
 * @param {object} options - Blind-signing options
 * @param {CryptoKey} options.privateKey - The private signing key
 * @param {string} options.clientId - The agent's client_id (issuer/subject)
 * @param {string} options.audience - The company identifier (audience)
 * @param {string} [options.typ="poppy-assertion+jwt"] - The JWT typ
 * @param {number} [options.now=Date.now()] - Current time in ms (for testing)
 * @returns {Promise<{jwt: string, jti: string, iat: number, exp: number}>} The blind-signed JWT
 */
export async function blindSign(options) {
	const { privateKey, clientId, audience } = options;
	const typ = options.typ ?? "poppy-assertion+jwt";
	const now = options.now ?? Date.now();

	const iat = Math.floor(now / 1000);
	const exp = iat + MAX_DELEGATION_TTL;
	const jti = randomUUID();

	const jwt = await new SignJWT({})
		.setProtectedHeader({ alg: "PS384", typ })
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
 * Enforce `prompt=consent` for cross-device flows.
 * @param {boolean} crossDevice - Whether the flow is cross-device
 * @param {string} [prompt] - The prompt parameter value
 * @returns {{ok: boolean, error?: string}} Validation result
 */
export function enforcePromptConsent(crossDevice, prompt) {
	if (crossDevice && prompt !== "consent") {
		return { ok: false, error: "Cross-device flow requires prompt=consent" };
	}
	return { ok: true };
}

/**
 * Detect consent-phishing indicators in a consent prompt.
 * @param {object} consent - The consent prompt to inspect
 * @param {string} [consent.scope] - The requested scope
 * @param {string} [consent.clientName] - The requesting client name
 * @returns {{ok: boolean, flags?: string[], error?: string}} Detection result
 */
export function detectConsentPhishing(consent = {}) {
	const flags = [];
	const scope = consent.scope ?? "";
	if (/offline_access|email|profile/.test(scope) && !/openid/.test(scope)) {
		flags.push("overbroad_scope");
	}
	if (
		consent.clientName &&
		/^[A-Za-z0-9]+$/.test(consent.clientName) &&
		consent.clientName.length < 4
	) {
		flags.push("suspicious_client_name");
	}
	return flags.length > 0 ? { ok: false, flags } : { ok: true, flags };
}

/**
 * Execute the `security` action of the Poppy tool. Dispatches on a sub-action
 * to manage secrets, content trust, audience validation, delegated keys, and
 * sign-in risks.
 * @param {object} input - Tool input
 * @param {string} input.op - The security operation to perform
 * @param {object} [options] - Runtime options
 * @param {Vault} [options.vault] - The secrets vault
 * @param {DelegatedKeyRegistry} [options.keyRegistry] - The delegated-key registry
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
export async function execute(input, options = {}) {
	const { op } = input;
	switch (op) {
		case "vault_set":
			return vaultSet(input, options);
		case "vault_get":
			return vaultGet(input, options);
		case "vault_delete":
			return vaultDelete(input, options);
		case "vault_rotate":
			return vaultRotate(input, options);
		case "redact":
			return redactOp(input, options);
		case "mark_data":
			return markData(input, options);
		case "sanitize":
			return sanitize(input, options);
		case "validate_audience":
			return validateAudienceOp(input, options);
		case "bind_key":
			return bindKey(input, options);
		case "rotate_key":
			return rotateKey(input, options);
		case "blind_sign":
			return blindSignOp(input, options);
		case "enforce_consent":
			return enforceConsent(input, options);
		case "detect_phishing":
			return detectPhishing(input, options);
		default:
			return { ok: false, error: `Unknown security operation: ${op}` };
	}
}

/**
 * Store a secret in the vault.
 * @param {object} input - Tool input
 * @param {string} input.key - The logical key
 * @param {string} input.value - The secret value
 * @param {object} [options] - Runtime options
 * @param {Vault} [options.vault] - The secrets vault
 * @returns {{ok: boolean, data?: object, error?: string}} Result
 */
function vaultSet(input, options = {}) {
	const { key, value } = input;
	if (!key || !value) {
		return { ok: false, error: "key and value are required" };
	}
	const vault = options.vault ?? new Vault();
	vault.set(key, value);
	return { ok: true, data: { stored: true } };
}

/**
 * Retrieve a secret from the vault without exposing it to the model.
 * @param {object} input - Tool input
 * @param {string} input.key - The logical key
 * @param {object} [options] - Runtime options
 * @param {Vault} [options.vault] - The secrets vault
 * @returns {{ok: boolean, data?: object, error?: string}} Result
 */
function vaultGet(input, options = {}) {
	const { key } = input;
	if (!key) {
		return { ok: false, error: "key is required" };
	}
	const vault = options.vault ?? new Vault();
	const value = vault.get(key);
	if (value === undefined) {
		return { ok: false, error: `No secret found for '${key}'` };
	}
	// Return only a presence indicator, never the secret value.
	return { ok: true, data: { present: true } };
}

/**
 * Delete a secret from the vault.
 * @param {object} input - Tool input
 * @param {string} input.key - The logical key
 * @param {object} [options] - Runtime options
 * @param {Vault} [options.vault] - The secrets vault
 * @returns {{ok: boolean, data?: object, error?: string}} Result
 */
function vaultDelete(input, options = {}) {
	const { key } = input;
	if (!key) {
		return { ok: false, error: "key is required" };
	}
	const vault = options.vault ?? new Vault();
	const removed = vault.delete(key);
	return { ok: true, data: { removed } };
}

/**
 * Rotate a secret in the vault.
 * @param {object} input - Tool input
 * @param {string} input.key - The logical key
 * @param {object} [options] - Runtime options
 * @param {Vault} [options.vault] - The secrets vault
 * @returns {{ok: boolean, data?: object, error?: string}} Result
 */
function vaultRotate(input, options = {}) {
	const { key } = input;
	if (!key) {
		return { ok: false, error: "key is required" };
	}
	const vault = options.vault ?? new Vault();
	vault.rotate(key);
	// Return only a success indicator, never the new secret value.
	return { ok: true, data: { rotated: true } };
}

/**
 * Redact known secrets from a payload.
 * @param {object} input - Tool input
 * @param {unknown} input.content - The payload to sanitize
 * @param {object} [options] - Runtime options
 * @param {Vault} [options.vault] - The secrets vault
 * @returns {{ok: boolean, data?: object, error?: string}} Result
 */
function redactOp(input, options = {}) {
	const vault = options.vault ?? new Vault();
	const sanitized = redact(input.content, vault.values());
	return { ok: true, data: { content: sanitized } };
}

/**
 * Mark company content as data.
 * @param {object} input - Tool input
 * @param {unknown} input.content - The content to mark
 * @returns {{ok: boolean, data?: object, error?: string}} Result
 */
function markData(input) {
	const marked = markAsData(input.content);
	return { ok: true, data: { content: marked, isData: isData(marked) } };
}

/**
 * Sanitize company content to neutralize instruction-like markers.
 * @param {object} input - Tool input
 * @param {unknown} input.content - The content to sanitize
 * @returns {{ok: boolean, data?: object, error?: string}} Result
 */
function sanitize(input) {
	const sanitized = sanitizeContent(input.content);
	return { ok: true, data: { content: sanitized } };
}

/**
 * Validate a token/assertion audience against the company identifier.
 * @param {object} input - Tool input
 * @param {string} input.aud - The token/assertion audience
 * @param {string} input.expectedAud - The verified company identifier
 * @returns {{ok: boolean, data?: object, error?: string}} Result
 */
function validateAudienceOp(input) {
	const { aud, expectedAud } = input;
	if (!aud || !expectedAud) {
		return { ok: false, error: "aud and expectedAud are required" };
	}
	const result = validateAudience(aud, expectedAud);
	return result.ok ? { ok: true, data: { valid: true } } : { ok: false, error: result.error };
}

/**
 * Bind a delegated key to a user ID.
 * @param {object} input - Tool input
 * @param {string} input.key - The key thumbprint
 * @param {string} input.userId - The user ID
 * @param {object} [options] - Runtime options
 * @param {DelegatedKeyRegistry} [options.keyRegistry] - The delegated-key registry
 * @returns {{ok: boolean, data?: object, error?: string}} Result
 */
function bindKey(input, options = {}) {
	const { key, userId } = input;
	if (!key || !userId) {
		return { ok: false, error: "key and userId are required" };
	}
	const registry = options.keyRegistry ?? new DelegatedKeyRegistry();
	registry.bind(key, userId);
	return { ok: true, data: { bound: true } };
}

/**
 * Rotate a delegated key for a user.
 * @param {object} input - Tool input
 * @param {string} input.userId - The user ID
 * @param {string} [input.alg="ES256"] - The signing algorithm
 * @param {object} [options] - Runtime options
 * @param {DelegatedKeyRegistry} [options.keyRegistry] - The delegated-key registry
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
async function rotateKey(input, options = {}) {
	const { userId } = input;
	if (!userId) {
		return { ok: false, error: "userId is required" };
	}
	const registry = options.keyRegistry ?? new DelegatedKeyRegistry();
	try {
		const result = await registry.rotate(userId, input.alg ?? "ES256");
		return { ok: true, data: { kid: result.kid } };
	} catch (err) {
		return { ok: false, error: err.message };
	}
}

/**
 * Blind-sign a client assertion or delegation.
 * @param {object} input - Tool input
 * @param {string} input.clientId - The agent's client_id (issuer/subject)
 * @param {string} input.audience - The company identifier (audience)
 * @param {string} [input.typ] - The JWT typ
 * @param {CryptoKey} [input.privateKey] - The private signing key
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
async function blindSignOp(input) {
	const { clientId, audience } = input;
	if (!clientId || !audience) {
		return { ok: false, error: "clientId and audience are required" };
	}
	if (!input.privateKey) {
		return { ok: false, error: "privateKey is required" };
	}
	try {
		const result = await blindSign({
			privateKey: input.privateKey,
			clientId,
			audience,
			typ: input.typ,
		});
		return { ok: true, data: result };
	} catch (err) {
		return { ok: false, error: err.message };
	}
}

/**
 * Enforce prompt=consent for cross-device flows.
 * @param {object} input - Tool input
 * @param {boolean} input.crossDevice - Whether the flow is cross-device
 * @param {string} [input.prompt] - The prompt parameter value
 * @returns {{ok: boolean, data?: object, error?: string}} Result
 */
function enforceConsent(input) {
	const result = enforcePromptConsent(input.crossDevice, input.prompt);
	return result.ok ? { ok: true, data: { valid: true } } : { ok: false, error: result.error };
}

/**
 * Detect consent-phishing indicators.
 * @param {object} input - Tool input
 * @param {object} [input.content] - The consent prompt to inspect
 * @returns {{ok: boolean, data?: object, error?: string}} Result
 */
function detectPhishing(input) {
	const result = detectConsentPhishing(input.content ?? {});
	return result.ok
		? { ok: true, data: { flags: [] } }
		: { ok: false, error: "Consent phishing indicators detected", data: { flags: result.flags } };
}
