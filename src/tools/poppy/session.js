import { z } from "zod";
import { SignJWT, exportJWK, calculateJwkThumbprint } from "jose";
import { createHash, randomUUID } from "node:crypto";

/** Maximum lifetime of a delegation in seconds (24 hours). */
const MAX_DELEGATION_TTL = 86400;

/** Poppy protocol version emitted in the `Poppy-Version` header. */
const POPPY_VERSION = "1.0";

/** Poppy extensions emitted in the `Poppy-Extensions` header. */
const POPPY_EXTENSIONS = "session";

/**
 * Zod schema for session signing input. Required fields: `clientId` (issuer),
 * `audience` (company identifier), `userId` (subject), `method` (htm), `url`
 * (htu). Optional fields: `agentId`, `accessToken`, `now` (for testing).
 */
export const SessionInputSchema = z.object({
	clientId: z.string().min(1),
	audience: z.string().min(1),
	userId: z.string().min(1),
	method: z.string().min(1),
	url: z.string().min(1),
	agentId: z.string().optional(),
	accessToken: z.string().optional(),
	now: z.number().optional(),
});

/**
 * Zod schema for delegation issuance input. Required fields: `clientId`
 * (issuer), `audience` (company identifier), `userId` (subject). Optional
 * fields: `now` (for testing).
 */
export const DelegationInputSchema = z.object({
	clientId: z.string().min(1),
	audience: z.string().min(1),
	userId: z.string().min(1),
	now: z.number().optional(),
});

/**
 * Compute the SHA-256 hash of an access token, base64url-encoded, for the
 * `ath` claim.
 * @param {string} accessToken - The access token to hash
 * @returns {string} The base64url-encoded SHA-256 hash
 */
export function computeAth(accessToken) {
	return createHash("sha256").update(accessToken).digest("base64url");
}

/**
 * Generate a Poppy-Session JWT signed with a delegated key. The Session JWT
 * carries `typ: poppy-session+jwt`, `alg: ES256`, and the required claims. The
 * delegation is carried in the `poppy_dlg` protected header.
 * @param {object} options - Signing options
 * @param {CryptoKey} options.delegatedKey - The delegated private signing key
 * @param {string} options.clientId - The agent's client_id (issuer)
 * @param {string} options.audience - The company identifier (audience)
 * @param {string} options.userId - The user ID (subject)
 * @param {string} options.method - The HTTP method (htm)
 * @param {string} options.url - The request URL (htu)
 * @param {string} [options.agentId] - Optional agent ID
 * @param {string} [options.accessToken] - Optional access token for `ath`
 * @param {string} [options.delegation] - The delegation JWT (for `poppy_dlg`)
 * @param {number} [options.now=Date.now()] - Current time in ms (for testing)
 * @returns {Promise<{jwt: string, sid: string, jti: string, iat: number, headers: object}>} The signed session
 */
export async function generateSessionJwt(options) {
	const {
		delegatedKey,
		clientId,
		audience,
		userId,
		method,
		url,
		agentId,
		accessToken,
		delegation,
	} = options;
	const now = options.now ?? Date.now();

	const iat = Math.floor(now / 1000);
	const sid = randomUUID();
	const jti = randomUUID();

	const payload = { sid, htm: method, htu: url };
	if (agentId) payload.agent_id = agentId;
	if (accessToken) payload.ath = computeAth(accessToken);

	const protectedHeader = { alg: "ES256", typ: "poppy-session+jwt" };
	if (delegation) protectedHeader.poppy_dlg = delegation;

	const jwt = await new SignJWT(payload)
		.setProtectedHeader(protectedHeader)
		.setIssuer(clientId)
		.setAudience(audience)
		.setSubject(userId)
		.setIssuedAt(iat)
		.setJti(jti)
		.sign(delegatedKey);

	return {
		jwt,
		sid,
		jti,
		iat,
		headers: {
			"Poppy-Session": jwt,
			"Poppy-Version": POPPY_VERSION,
			"Poppy-Extensions": POPPY_EXTENSIONS,
		},
	};
}

/**
 * Issue a Poppy delegation JWT signed by a key in `jwks_uri`. The delegation
 * carries `typ: poppy-delegation+jwt`, names the delegated key in `cnf.jwk`,
 * and has `exp` at most 24 hours after `iat`.
 * @param {object} options - Delegation options
 * @param {CryptoKey} options.signingKey - The long-lived signing key from `jwks_uri`
 * @param {CryptoKey} options.delegatedKey - The delegated private key to name in `cnf.jwk`
 * @param {string} options.clientId - The agent's client_id (issuer)
 * @param {string} options.audience - The company identifier (audience)
 * @param {string} options.userId - The user ID (subject)
 * @param {number} [options.now=Date.now()] - Current time in ms (for testing)
 * @returns {Promise<{jwt: string, jti: string, iat: number, exp: number, kid: string}>} The signed delegation
 */
export async function issueDelegation(options) {
	const { signingKey, delegatedKey, clientId, audience, userId } = options;
	const now = options.now ?? Date.now();

	const iat = Math.floor(now / 1000);
	const exp = iat + MAX_DELEGATION_TTL;
	const jti = randomUUID();

	const delegatedJwk = await exportJWK(delegatedKey);
	const kid = await calculateJwkThumbprint(delegatedJwk);
	// Strip private key material so only the public JWK is named in cnf.jwk.
	const publicJwk = { ...delegatedJwk };
	delete publicJwk.d;

	const jwt = await new SignJWT({ cnf: { jwk: publicJwk } })
		.setProtectedHeader({ alg: "ES256", typ: "poppy-delegation+jwt" })
		.setIssuer(clientId)
		.setAudience(audience)
		.setSubject(userId)
		.setIssuedAt(iat)
		.setExpirationTime(exp)
		.setJti(jti)
		.sign(signingKey);

	return { jwt, jti, iat, exp, kid };
}

/**
 * Execute the `session` action of the Poppy tool. Dispatches on a sub-action
 * to generate a Poppy-Session JWT or issue a delegation. Delegated keys are
 * bound to a single user ID; using a delegated key for a different user is
 * rejected.
 * @param {object} input - Action input
 * @param {string} input.op - The session operation to perform
 * @param {object} [options] - Runtime options
 * @param {Map<string, string>} [options.keyRegistry] - Map of delegated key thumbprint to user ID
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
export async function execute(input, options = {}) {
	const { op } = input;
	switch (op) {
		case "sign_session":
			return signSessionAction(input, options);
		case "issue_delegation":
			return issueDelegationAction(input, options);
		default:
			return { ok: false, error: `Unknown session operation: ${op}` };
	}
}

/**
 * Sign a Poppy-Session JWT with a delegated key, enforcing per-user key
 * isolation.
 * @param {object} input - Action input
 * @param {string} input.clientId - The agent's client_id (issuer)
 * @param {string} input.audience - The company identifier (audience)
 * @param {string} input.userId - The user ID (subject)
 * @param {string} input.method - The HTTP method (htm)
 * @param {string} input.url - The request URL (htu)
 * @param {string} [input.agentId] - Optional agent ID
 * @param {string} [input.accessToken] - Optional access token for `ath`
 * @param {string} [input.delegation] - The delegation JWT (for `poppy_dlg`)
 * @param {CryptoKey} [input.delegatedKey] - The delegated private signing key
 * @param {object} [options] - Runtime options
 * @param {Map<string, string>} [options.keyRegistry] - Map of delegated key thumbprint to user ID
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
async function signSessionAction(input, options = {}) {
	const parsed = SessionInputSchema.safeParse(input);
	if (!parsed.success) {
		return {
			ok: false,
			error: `Invalid session input: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
		};
	}
	const data = parsed.data;
	const delegatedKey = input.delegatedKey;
	if (!delegatedKey) {
		return { ok: false, error: "delegatedKey is required" };
	}

	try {
		const keyRegistry = options.keyRegistry ?? new Map();
		const delegatedJwk = await exportJWK(delegatedKey);
		const kid = await calculateJwkThumbprint(delegatedJwk);
		const boundUser = keyRegistry.get(kid);
		if (boundUser !== undefined && boundUser !== data.userId) {
			return {
				ok: false,
				error: `Delegated key is bound to user '${boundUser}', not '${data.userId}'`,
			};
		}

		const result = await generateSessionJwt({
			delegatedKey,
			clientId: data.clientId,
			audience: data.audience,
			userId: data.userId,
			method: data.method,
			url: data.url,
			agentId: data.agentId,
			accessToken: data.accessToken,
			delegation: input.delegation,
			now: data.now,
		});
		return { ok: true, data: result };
	} catch (err) {
		return { ok: false, error: err.message };
	}
}

/**
 * Issue a Poppy delegation JWT signed by a key in `jwks_uri`.
 * @param {object} input - Action input
 * @param {string} input.clientId - The agent's client_id (issuer)
 * @param {string} input.audience - The company identifier (audience)
 * @param {string} input.userId - The user ID (subject)
 * @param {CryptoKey} [input.signingKey] - The long-lived signing key from `jwks_uri`
 * @param {CryptoKey} [input.delegatedKey] - The delegated private key to name in `cnf.jwk`
 * @param {object} [options] - Runtime options
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
async function issueDelegationAction(input, _options = {}) {
	const parsed = DelegationInputSchema.safeParse(input);
	if (!parsed.success) {
		return {
			ok: false,
			error: `Invalid delegation input: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
		};
	}
	const data = parsed.data;
	const signingKey = input.signingKey;
	const delegatedKey = input.delegatedKey;
	if (!signingKey) {
		return { ok: false, error: "signingKey is required" };
	}
	if (!delegatedKey) {
		return { ok: false, error: "delegatedKey is required" };
	}

	try {
		const result = await issueDelegation({
			signingKey,
			delegatedKey,
			clientId: data.clientId,
			audience: data.audience,
			userId: data.userId,
			now: data.now,
		});
		return { ok: true, data: result };
	} catch (err) {
		return { ok: false, error: err.message };
	}
}
