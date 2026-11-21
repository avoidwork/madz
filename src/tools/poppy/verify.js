import { z } from "zod";
import { jwtVerify, importJWK, createLocalJWKSet } from "jose";
import { computeAth } from "./session.js";

/** Default fetch timeout in ms for verification HTTP calls. */
const FETCH_TIMEOUT = 10000;

/** Maximum delegation lifetime in seconds (24 hours). */
const MAX_DELEGATION_TTL = 86400;

/** Acceptance window for the session JWT `iat` claim in seconds. */
const IAT_ACCEPTANCE_WINDOW = 300;

/** Session JWT `typ` value. */
const SESSION_TYP = "poppy-session+jwt";

/** Delegation JWT `typ` value. */
const DELEGATION_TYP = "poppy-delegation+jwt";

/**
 * Zod schema for verification input. Required fields: `session` (the
 * Poppy-Session JWT), `audience` (company identifier), `method` (htm), `url`
 * (htu). Optional fields: `accessToken`, `now` (for testing).
 */
export const VerifyInputSchema = z.object({
	session: z.string().min(1),
	audience: z.string().min(1),
	method: z.string().min(1),
	url: z.string().min(1),
	accessToken: z.string().optional(),
	now: z.number().optional(),
});

/**
 * Zod schema for a client metadata document. Required field: `jwks_uri`.
 */
export const ClientMetadataSchema = z.object({
	jwks_uri: z.string().url(),
});

/**
 * Fetch a JSON document over HTTPS with a timeout, without following
 * redirects.
 * @param {string} url - The URL to fetch
 * @param {object} [options] - Fetch options
 * @param {number} [options.timeout=10000] - Timeout in ms
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
async function fetchJson(url, options = {}) {
	const timeout = options.timeout ?? FETCH_TIMEOUT;
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);
	try {
		const resp = await fetch(url, {
			method: "GET",
			redirect: "manual",
			signal: controller.signal,
		});
		if (!resp.ok) {
			return { ok: false, error: `HTTP error ${resp.status} fetching ${url}` };
		}
		const data = await resp.json();
		return { ok: true, data };
	} catch (err) {
		return { ok: false, error: err.message };
	} finally {
		clearTimeout(timeoutId);
	}
}

/**
 * Fetch the client metadata document from `iss` and the public keys from
 * `jwks_uri`. The metadata is fetched without following redirects.
 * @param {string} iss - The client's issuer URL
 * @param {object} [options] - Fetch options
 * @param {number} [options.timeout=10000] - Timeout in ms
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
export async function fetchClientMetadata(iss, options = {}) {
	const metadataResult = await fetchJson(iss, options);
	if (!metadataResult.ok) {
		return { ok: false, error: `Failed to fetch client metadata: ${metadataResult.error}` };
	}
	const parsed = ClientMetadataSchema.safeParse(metadataResult.data);
	if (!parsed.success) {
		return {
			ok: false,
			error: `Invalid client metadata: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
		};
	}
	const jwksResult = await fetchJson(parsed.data.jwks_uri, options);
	if (!jwksResult.ok) {
		return { ok: false, error: `Failed to fetch JWKS: ${jwksResult.error}` };
	}
	return { ok: true, data: { metadata: parsed.data, jwks: jwksResult.data } };
}

/**
 * Verify the delegation JWT carried in the session's `poppy_dlg` protected
 * header. Checks `typ`, `iss`, and `exp` (at most 24 hours after `iat`), and
 * verifies the delegation's signature with the public key from `jwks_uri`.
 * @param {string} delegation - The delegation JWT
 * @param {object} jwks - The JWKS document
 * @param {string} iss - The expected issuer
 * @param {number} now - Current time in ms
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
export async function verifyDelegation(delegation, jwks, iss, now) {
	let header;
	try {
		header = (await import("jose")).decodeProtectedHeader(delegation);
	} catch {
		return { ok: false, error: "Invalid delegation JWT" };
	}
	if (header.typ !== DELEGATION_TYP) {
		return { ok: false, error: `Delegation typ must be '${DELEGATION_TYP}'` };
	}

	const jwksSet = createLocalJWKSet(jwks);
	let payload;
	try {
		const result = await jwtVerify(delegation, jwksSet, { issuer: iss });
		payload = result.payload;
	} catch (err) {
		return { ok: false, error: `Delegation verification failed: ${err.message}` };
	}

	if (payload.exp - payload.iat > MAX_DELEGATION_TTL) {
		return { ok: false, error: "Delegation exp is more than 24 hours after iat" };
	}
	if (payload.exp * 1000 < now) {
		return { ok: false, error: "Delegation has expired" };
	}
	if (!payload.cnf?.jwk) {
		return { ok: false, error: "Delegation does not name a delegated key in cnf.jwk" };
	}

	return { ok: true, data: { payload } };
}

/**
 * Verify the session JWT with the delegated key named in the delegation's
 * `cnf.jwk`.
 * @param {string} session - The session JWT
 * @param {object} delegatedJwk - The delegated public JWK
 * @param {string} iss - The expected issuer
 * @param {string} audience - The expected audience
 * @param {number} now - Current time in ms
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
export async function verifySessionJwt(session, delegatedJwk, iss, audience, now) {
	let header;
	try {
		header = (await import("jose")).decodeProtectedHeader(session);
	} catch {
		return { ok: false, error: "Invalid session JWT" };
	}
	if (header.typ !== SESSION_TYP) {
		return { ok: false, error: `Session typ must be '${SESSION_TYP}'` };
	}

	let key;
	try {
		key = await importJWK(delegatedJwk, "ES256");
	} catch (err) {
		return { ok: false, error: `Invalid delegated key: ${err.message}` };
	}

	let payload;
	try {
		const result = await jwtVerify(session, key, { issuer: iss, audience });
		payload = result.payload;
	} catch (err) {
		return { ok: false, error: `Session verification failed: ${err.message}` };
	}

	if (payload.aud !== audience) {
		return { ok: false, error: `Session aud '${payload.aud}' does not match '${audience}'` };
	}
	const iatMs = payload.iat * 1000;
	if (iatMs > now + IAT_ACCEPTANCE_WINDOW * 1000 || iatMs < now - IAT_ACCEPTANCE_WINDOW * 1000) {
		return { ok: false, error: "Session iat is outside the acceptance window" };
	}

	return { ok: true, data: { payload } };
}

/**
 * Validate the session JWT claims against the request. Checks `htm`/`htu`
 * match the request method and URL.
 * @param {object} payload - The session JWT payload
 * @param {string} method - The request HTTP method (htm)
 * @param {string} url - The request URL (htu)
 * @returns {{ok: boolean, error?: string}} Validation result
 */
export function validateSessionClaims(payload, method, url) {
	if (payload.htm !== method) {
		return {
			ok: false,
			error: `Session htm '${payload.htm}' does not match request method '${method}'`,
		};
	}
	if (payload.htu !== url) {
		return { ok: false, error: `Session htu '${payload.htu}' does not match request URL '${url}'` };
	}
	return { ok: true };
}

/**
 * Validate the access token binding. When an access token is present, checks
 * that `ath` matches the token's hash and that the token was issued to the
 * same `client_id` as `iss`.
 * @param {object} payload - The session JWT payload
 * @param {string} [accessToken] - The access token (optional)
 * @param {string} iss - The session issuer (client_id)
 * @returns {{ok: boolean, error?: string}} Validation result
 */
export function validateAccessToken(payload, accessToken, iss) {
	if (accessToken) {
		if (payload.ath !== computeAth(accessToken)) {
			return { ok: false, error: "Session ath does not match the access token" };
		}
	}
	if (payload.iss !== iss) {
		return { ok: false, error: `Session iss '${payload.iss}' does not match client_id '${iss}'` };
	}
	return { ok: true };
}

/**
 * Look up the session by `client_id`, `sid`, and user ID. Starts a new
 * signed-out session for unknown combinations.
 * @param {object} sessionStore - The session store
 * @param {string} clientId - The client_id (iss)
 * @param {string} sid - The session ID
 * @param {string} userId - The user ID (sub)
 * @returns {Promise<object>} The session record
 */
export async function lookupSession(sessionStore, clientId, sid, userId) {
	const existing = await sessionStore.get(clientId, sid, userId);
	if (existing) {
		return existing;
	}
	return sessionStore.create(clientId, sid, userId);
}

/**
 * Execute the `verify` action of the Poppy tool. Verifies an incoming
 * Poppy-Session JWT, its delegation, and access token binding on a
 * company-side endpoint.
 * @param {object} input - Tool input
 * @param {string} input.session - The Poppy-Session JWT
 * @param {string} input.audience - The company identifier (audience)
 * @param {string} input.method - The request HTTP method (htm)
 * @param {string} input.url - The request URL (htu)
 * @param {string} [input.accessToken] - Optional access token
 * @param {object} [options] - Runtime options
 * @param {object} [options.sessionStore] - Session store interface
 * @returns {Promise<{ok: boolean, data?: object, error?: string, code?: string, status?: number}>} Result
 */
export async function execute(input, options = {}) {
	const parsed = VerifyInputSchema.safeParse(input);
	if (!parsed.success) {
		return {
			ok: false,
			error: `Invalid verify input: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
		};
	}
	const data = parsed.data;
	const now = data.now ?? Date.now();

	try {
		const sessionStore = options.sessionStore;
		if (!sessionStore) {
			return { ok: false, error: "sessionStore is required" };
		}

		// Decode the session JWT to extract the delegation and issuer.
		let sessionHeader;
		let sessionPayload;
		try {
			sessionHeader = (await import("jose")).decodeProtectedHeader(data.session);
			sessionPayload = (await import("jose")).decodeJwt(data.session);
		} catch (err) {
			return {
				ok: false,
				error: `Invalid session JWT: ${err.message}`,
				code: "invalid_session",
				status: 400,
			};
		}

		const delegation = sessionHeader.poppy_dlg;
		if (!delegation) {
			return {
				ok: false,
				error: "Session JWT is missing a delegation",
				code: "invalid_session",
				status: 400,
			};
		}

		const iss = sessionPayload.iss;
		if (!iss) {
			return {
				ok: false,
				error: "Session JWT is missing iss",
				code: "invalid_session",
				status: 400,
			};
		}

		// Fetch client metadata and public keys.
		const fetched = await fetchClientMetadata(iss, options);
		if (!fetched.ok) {
			return { ok: false, error: fetched.error, code: "invalid_session", status: 400 };
		}

		// Verify the delegation.
		const delegationResult = await verifyDelegation(delegation, fetched.data.jwks, iss, now);
		if (!delegationResult.ok) {
			return { ok: false, error: delegationResult.error, code: "invalid_session", status: 400 };
		}

		// Verify the session JWT with the delegated key in cnf.jwk.
		const sessionResult = await verifySessionJwt(
			data.session,
			delegationResult.data.payload.cnf.jwk,
			iss,
			data.audience,
			now,
		);
		if (!sessionResult.ok) {
			return { ok: false, error: sessionResult.error, code: "invalid_session", status: 400 };
		}

		// Validate session claims against the request.
		const claimsResult = validateSessionClaims(sessionResult.data.payload, data.method, data.url);
		if (!claimsResult.ok) {
			return { ok: false, error: claimsResult.error, code: "invalid_session", status: 400 };
		}

		// Validate access token binding.
		const tokenResult = validateAccessToken(sessionResult.data.payload, data.accessToken, iss);
		if (!tokenResult.ok) {
			return { ok: false, error: tokenResult.error, code: "invalid_session", status: 400 };
		}

		// Look up the session by client_id, sid, and user ID.
		const session = await lookupSession(
			sessionStore,
			iss,
			sessionResult.data.payload.sid,
			sessionResult.data.payload.sub,
		);

		if (session.ended) {
			return { ok: false, error: "Session has ended", code: "session_ended", status: 400 };
		}

		return {
			ok: true,
			data: {
				verified: true,
				session,
				claims: sessionResult.data.payload,
			},
		};
	} catch (err) {
		return { ok: false, error: err.message, code: "invalid_session", status: 400 };
	}
}
