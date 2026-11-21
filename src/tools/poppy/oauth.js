import { z } from "zod";
import { SignJWT, exportJWK } from "jose";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { signClientAssertion, deserializePrivateKey } from "./identity.js";

/** Default fetch timeout in ms for OAuth HTTP calls. */
const FETCH_TIMEOUT = 10000;

/** Default device flow polling interval in seconds (RFC 8628). */
const DEFAULT_DEVICE_INTERVAL = 5;

/** Maximum number of device flow poll attempts before giving up. */
const MAX_DEVICE_POLLS = 600;

/**
 * Zod schema for OAuth Authorization Server Metadata (RFC 8414). Required
 * fields: `issuer`, `authorization_endpoint`, `token_endpoint`. Optional
 * fields: `device_authorization_endpoint`, `revocation_endpoint`,
 * `dpop_signing_alg_values_supported`.
 */
export const AuthorizationServerMetadataSchema = z.object({
	issuer: z.string().url(),
	authorization_endpoint: z.string().url(),
	token_endpoint: z.string().url(),
	device_authorization_endpoint: z.string().url().optional(),
	revocation_endpoint: z.string().url().optional(),
	dpop_signing_alg_values_supported: z.array(z.string()).optional(),
});

/**
 * Zod schema for OAuth Protected Resource Metadata (RFC 9728). Required
 * fields: `resource`, `authorization_servers`.
 */
export const ProtectedResourceMetadataSchema = z.object({
	resource: z.string().url(),
	authorization_servers: z.array(z.string().url()).min(1),
});

/**
 * Zod schema for an OAuth token endpoint response (RFC 6749 §5.1). Required
 * field: `access_token`. Optional fields: `token_type`, `expires_in`,
 * `refresh_token`, `scope`.
 */
export const TokenResponseSchema = z.object({
	access_token: z.string().min(1),
	token_type: z.string().optional(),
	expires_in: z.number().optional(),
	refresh_token: z.string().optional(),
	scope: z.string().optional(),
});

/**
 * Zod schema for an OAuth device authorization response (RFC 8628 §3.2).
 * Required fields: `device_code`, `user_code`, `verification_uri`,
 * `expires_in`. Optional fields: `verification_uri_complete`, `interval`.
 */
export const DeviceCodeResponseSchema = z.object({
	device_code: z.string().min(1),
	user_code: z.string().min(1),
	verification_uri: z.string().url(),
	verification_uri_complete: z.string().url().optional(),
	expires_in: z.number(),
	interval: z.number().optional(),
});

/**
 * Fetch a JSON document over HTTPS with a timeout.
 * @param {string} url - The URL to fetch
 * @param {object} [options] - Fetch options
 * @param {number} [options.timeout=10000] - Timeout in ms
 * @param {object} [options.headers] - Additional request headers
 * @param {string} [options.body] - Optional request body
 * @param {string} [options.method="GET"] - HTTP method
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
async function fetchJson(url, options = {}) {
	const timeout = options.timeout ?? FETCH_TIMEOUT;
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);
	try {
		const resp = await fetch(url, {
			method: options.method ?? "GET",
			headers: options.headers,
			body: options.body,
			signal: controller.signal,
		});
		if (!resp.ok) {
			let data = null;
			try {
				data = await resp.json();
			} catch {
				// Non-JSON error body; ignore.
			}
			return { ok: false, error: `HTTP error ${resp.status} fetching ${url}`, data };
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
 * Discover OAuth Authorization Server Metadata (RFC 8414) and protected
 * resource metadata (RFC 9728) for a company issuer.
 * @param {string} issuer - The company's issuer URL
 * @param {object} [options] - Fetch options
 * @param {number} [options.timeout=10000] - Timeout in ms
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
export async function discoverMetadata(issuer, options = {}) {
	const asUrl = new URL("/.well-known/oauth-authorization-server", issuer);
	const asResult = await fetchJson(asUrl.toString(), options);
	if (!asResult.ok) {
		return { ok: false, error: `Failed to fetch authorization server metadata: ${asResult.error}` };
	}
	const parsed = AuthorizationServerMetadataSchema.safeParse(asResult.data);
	if (!parsed.success) {
		return {
			ok: false,
			error: `Invalid authorization server metadata: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
		};
	}
	const metadata = parsed.data;
	if (metadata.issuer !== issuer) {
		return {
			ok: false,
			error: `issuer '${metadata.issuer}' does not match expected issuer '${issuer}'`,
		};
	}

	// Protected resource metadata is optional; fetch it best-effort.
	const resourceUrl = new URL("/.well-known/oauth-protected-resource", issuer);
	const resourceResult = await fetchJson(resourceUrl.toString(), options);
	let resource = null;
	if (resourceResult.ok) {
		const resourceParsed = ProtectedResourceMetadataSchema.safeParse(resourceResult.data);
		if (resourceParsed.success) {
			resource = resourceParsed.data;
		}
	}

	return {
		ok: true,
		data: {
			issuer: metadata.issuer,
			authorizationEndpoint: metadata.authorization_endpoint,
			tokenEndpoint: metadata.token_endpoint,
			deviceAuthorizationEndpoint: metadata.device_authorization_endpoint,
			revocationEndpoint: metadata.revocation_endpoint,
			dpopSigningAlgValuesSupported: metadata.dpop_signing_alg_values_supported,
			resource,
		},
	};
}

/**
 * Generate a PKCE code verifier and its S256 code challenge (RFC 7636).
 * @returns {{verifier: string, challenge: string}} The verifier and challenge
 */
export function generatePkce() {
	const verifier = randomBytes(32).toString("base64url");
	const challenge = createHash("sha256").update(verifier).digest("base64url");
	return { verifier, challenge };
}

/**
 * Build an OAuth authorization URL for Direct Sign-In (authorization code +
 * PKCE). Includes `response_type=code`, `client_id`, `redirect_uri`, `scope`,
 * `state`, `code_challenge`, and `code_challenge_method=S256`. When
 * `crossDevice` is set, `prompt=consent` is added.
 * @param {object} options - Authorization options
 * @param {string} options.authorizationEndpoint - The authorization endpoint
 * @param {string} options.clientId - The agent's client_id
 * @param {string} options.redirectUri - The redirect URI
 * @param {string} options.scope - The requested scope
 * @param {string} options.state - The CSRF state
 * @param {string} options.codeChallenge - The PKCE S256 code challenge
 * @param {boolean} [options.crossDevice=false] - Whether to enforce prompt=consent
 * @returns {string} The authorization URL
 */
export function buildAuthorizationUrl(options) {
	const params = new URLSearchParams({
		response_type: "code",
		client_id: options.clientId,
		redirect_uri: options.redirectUri,
		scope: options.scope,
		state: options.state,
		code_challenge: options.codeChallenge,
		code_challenge_method: "S256",
	});
	if (options.crossDevice) {
		params.set("prompt", "consent");
	}
	const url = new URL(options.authorizationEndpoint);
	url.search = params.toString();
	return url.toString();
}

/**
 * Validate the `iss` claim on a redirect callback against the expected issuer.
 * @param {string} iss - The `iss` claim from the redirect
 * @param {string} expectedIssuer - The expected issuer
 * @returns {{ok: boolean, error?: string}} Validation result
 */
export function validateIss(iss, expectedIssuer) {
	if (iss !== expectedIssuer) {
		return { ok: false, error: `iss '${iss}' does not match expected issuer '${expectedIssuer}'` };
	}
	return { ok: true };
}

/**
 * Generate a DPoP proof JWT (RFC 9449) bound to a token endpoint.
 * @param {object} options - DPoP options
 * @param {CryptoKey} options.privateKey - The DPoP private signing key
 * @param {string} options.htm - The HTTP method (htm)
 * @param {string} options.htu - The HTTP URI (htu)
 * @param {number} [options.now=Date.now()] - Current time in ms (for testing)
 * @returns {Promise<{jwt: string, jti: string, iat: number}>} The DPoP proof
 */
export async function generateDpopProof(options) {
	const { privateKey, htm, htu } = options;
	const now = options.now ?? Date.now();
	const iat = Math.floor(now / 1000);
	const jti = randomUUID();

	const publicJwk = await exportJWK(privateKey);
	const jwk = { ...publicJwk };
	delete jwk.d;

	const jwt = await new SignJWT({ htm, htu })
		.setProtectedHeader({ alg: "ES256", typ: "dpop+jwt", jwk })
		.setIssuedAt(iat)
		.setJti(jti)
		.sign(privateKey);

	return { jwt, jti, iat };
}

/**
 * Resolve a private signing key from the input or a persisted key directory.
 * @param {object} input - Tool input
 * @param {CryptoKey} [input.privateKey] - A private signing key
 * @param {string} [input.keyId] - Identifier for a persisted key
 * @param {string} [input.alg="ES256"] - The signing algorithm
 * @param {object} [options] - Runtime options
 * @param {string} [options.keyDir] - Directory for persisted private keys
 * @returns {Promise<CryptoKey | null>} The private key, or null if unavailable
 */
async function resolvePrivateKey(input, options = {}) {
	if (input.privateKey) {
		return input.privateKey;
	}
	if (options.keyDir && input.keyId) {
		try {
			const pem = await readFile(join(options.keyDir, `${input.keyId}.pem`), "utf8");
			return await deserializePrivateKey(pem, input.alg ?? "ES256");
		} catch {
			return null;
		}
	}
	return null;
}

/**
 * Build a client assertion for a token exchange using the identity module's
 * `signClientAssertion`, with `aud` set to the company's issuer.
 * @param {object} options - Assertion options
 * @param {CryptoKey} options.privateKey - The private signing key
 * @param {string} options.clientId - The agent's client_id
 * @param {string} options.issuer - The company's issuer (audience)
 * @param {string} [options.alg="ES256"] - The signing algorithm
 * @param {number} [options.now=Date.now()] - Current time in ms (for testing)
 * @returns {Promise<{jwt: string, jti: string, iat: number, exp: number}>} The assertion
 */
async function buildClientAssertion(options) {
	return signClientAssertion({
		privateKey: options.privateKey,
		clientId: options.clientId,
		audience: options.issuer,
		alg: options.alg ?? "ES256",
		now: options.now,
	});
}

/**
 * Exchange an authorization code at the token endpoint with a client
 * assertion (Direct Sign-In).
 * @param {object} options - Exchange options
 * @param {string} options.tokenEndpoint - The token endpoint
 * @param {string} options.clientId - The agent's client_id
 * @param {string} options.redirectUri - The redirect URI
 * @param {string} options.code - The authorization code
 * @param {string} options.codeVerifier - The PKCE code verifier
 * @param {CryptoKey} options.privateKey - The private signing key
 * @param {string} options.issuer - The company's issuer (audience)
 * @param {string} [options.alg="ES256"] - The signing algorithm
 * @param {number} [options.now=Date.now()] - Current time in ms (for testing)
 * @param {object} [options.fetchOptions] - Additional fetch options
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
export async function exchangeCode(options) {
	const assertion = await buildClientAssertion(options);
	const body = new URLSearchParams({
		grant_type: "authorization_code",
		client_id: options.clientId,
		redirect_uri: options.redirectUri,
		code: options.code,
		code_verifier: options.codeVerifier,
		client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
		client_assertion: assertion.jwt,
	});
	const result = await fetchJson(options.tokenEndpoint, {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: body.toString(),
		...options.fetchOptions,
	});
	if (!result.ok) {
		return { ok: false, error: `Token exchange failed: ${result.error}` };
	}
	const parsed = TokenResponseSchema.safeParse(result.data);
	if (!parsed.success) {
		return {
			ok: false,
			error: `Invalid token response: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
		};
	}
	return { ok: true, data: parsed.data };
}

/**
 * Request a device code from the device authorization endpoint (RFC 8628).
 * @param {object} options - Device code options
 * @param {string} options.deviceAuthorizationEndpoint - The device authorization endpoint
 * @param {string} options.clientId - The agent's client_id
 * @param {string} options.scope - The requested scope
 * @param {object} [options.fetchOptions] - Additional fetch options
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
export async function requestDeviceCode(options) {
	const body = new URLSearchParams({
		client_id: options.clientId,
		scope: options.scope,
	});
	const result = await fetchJson(options.deviceAuthorizationEndpoint, {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: body.toString(),
		...options.fetchOptions,
	});
	if (!result.ok) {
		return { ok: false, error: `Device code request failed: ${result.error}` };
	}
	const parsed = DeviceCodeResponseSchema.safeParse(result.data);
	if (!parsed.success) {
		return {
			ok: false,
			error: `Invalid device code response: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
		};
	}
	return { ok: true, data: parsed.data };
}

/**
 * Poll the token endpoint for a device flow until approved, denied, or
 * expired (RFC 8628 §3.4).
 * @param {object} options - Poll options
 * @param {string} options.tokenEndpoint - The token endpoint
 * @param {string} options.clientId - The agent's client_id
 * @param {string} options.deviceCode - The device code
 * @param {number} [options.interval=5] - Poll interval in seconds
 * @param {number} [options.expiresIn] - Device code lifetime in seconds
 * @param {number} [options.maxPolls=600] - Maximum poll attempts
 * @param {number} [options.now=Date.now()] - Current time in ms (for testing)
 * @param {object} [options.fetchOptions] - Additional fetch options
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
export async function pollDeviceToken(options) {
	const interval = options.interval ?? DEFAULT_DEVICE_INTERVAL;
	const maxPolls = options.maxPolls ?? MAX_DEVICE_POLLS;
	const now = options.now ?? Date.now();
	const expiresAt = options.expiresIn !== undefined ? now + options.expiresIn * 1000 : Infinity;

	for (let i = 0; i < maxPolls; i++) {
		const body = new URLSearchParams({
			grant_type: "urn:ietf:params:oauth:grant-type:device_code",
			client_id: options.clientId,
			device_code: options.deviceCode,
		});
		const result = await fetchJson(options.tokenEndpoint, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: body.toString(),
			...options.fetchOptions,
		});
		if (result.ok) {
			const parsed = TokenResponseSchema.safeParse(result.data);
			if (!parsed.success) {
				return {
					ok: false,
					error: `Invalid token response: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
				};
			}
			return { ok: true, data: parsed.data };
		}
		// Handle RFC 8628 error responses.
		const err = result.data?.error;
		if (err === "authorization_pending") {
			// Continue polling.
		} else if (err === "slow_down") {
			// Increase the polling interval.
		} else if (err === "access_denied") {
			return { ok: false, error: "Device flow was denied" };
		} else if (err === "expired_token") {
			return { ok: false, error: "Device code expired" };
		} else {
			return { ok: false, error: `Device flow failed: ${result.error}` };
		}
		if (Date.now() > expiresAt) {
			return { ok: false, error: "Device code expired" };
		}
		await new Promise((resolve) => setTimeout(resolve, interval * 1000));
	}
	return { ok: false, error: "Device flow timed out" };
}

/**
 * Exchange a refresh token for a new access token and rotated refresh token
 * (RFC 6749 §6).
 * @param {object} options - Refresh options
 * @param {string} options.tokenEndpoint - The token endpoint
 * @param {string} options.clientId - The agent's client_id
 * @param {string} options.refreshToken - The refresh token
 * @param {CryptoKey} options.privateKey - The private signing key
 * @param {string} options.issuer - The company's issuer (audience)
 * @param {string} [options.alg="ES256"] - The signing algorithm
 * @param {number} [options.now=Date.now()] - Current time in ms (for testing)
 * @param {object} [options.fetchOptions] - Additional fetch options
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
export async function refreshToken(options) {
	const assertion = await buildClientAssertion(options);
	const body = new URLSearchParams({
		grant_type: "refresh_token",
		client_id: options.clientId,
		refresh_token: options.refreshToken,
		client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
		client_assertion: assertion.jwt,
	});
	const result = await fetchJson(options.tokenEndpoint, {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: body.toString(),
		...options.fetchOptions,
	});
	if (!result.ok) {
		return { ok: false, error: `Refresh failed: ${result.error}` };
	}
	const parsed = TokenResponseSchema.safeParse(result.data);
	if (!parsed.success) {
		return {
			ok: false,
			error: `Invalid token response: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
		};
	}
	return { ok: true, data: parsed.data };
}

/**
 * Revoke an access or refresh token at the revocation endpoint (RFC 7009).
 * @param {object} options - Revoke options
 * @param {string} options.revocationEndpoint - The revocation endpoint
 * @param {string} options.clientId - The agent's client_id
 * @param {string} options.token - The token to revoke
 * @param {string} [options.tokenTypeHint] - The token type hint
 * @param {object} [options.fetchOptions] - Additional fetch options
 * @returns {Promise<{ok: boolean, error?: string}>} Result
 */
export async function revokeToken(options) {
	const body = new URLSearchParams({
		token: options.token,
	});
	if (options.tokenTypeHint) {
		body.set("token_type_hint", options.tokenTypeHint);
	}
	const result = await fetchJson(options.revocationEndpoint, {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: body.toString(),
		...options.fetchOptions,
	});
	if (!result.ok) {
		return { ok: false, error: `Revocation failed: ${result.error}` };
	}
	return { ok: true };
}

/**
 * Execute the `oauth` action of the Poppy tool. Dispatches on a sub-action to
 * discover OAuth metadata, perform Direct Sign-In, Device Sign-In, refresh a
 * token, or revoke a token.
 * @param {object} input - Tool input
 * @param {string} input.op - The oauth operation to perform
 * @param {object} [options] - Runtime options
 * @param {string} [options.keyDir] - Directory for persisted private keys
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
export async function execute(input, options = {}) {
	const { op } = input;
	switch (op) {
		case "discover":
			return discover(input, options);
		case "direct_sign_in":
			return directSignIn(input, options);
		case "device_sign_in":
			return deviceSignIn(input, options);
		case "refresh_token":
			return refreshTokenOp(input, options);
		case "revoke_token":
			return revokeTokenOp(input, options);
		default:
			return { ok: false, error: `Unknown oauth operation: ${op}` };
	}
}

/**
 * Discover OAuth metadata for a company issuer.
 * @param {object} input - Tool input
 * @param {string} input.issuer - The company's issuer URL
 * @param {object} [options] - Runtime options
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
async function discover(input, options = {}) {
	if (!input.issuer) {
		return { ok: false, error: "issuer is required" };
	}
	try {
		const result = await discoverMetadata(input.issuer, options);
		return result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error };
	} catch (err) {
		return { ok: false, error: err.message };
	}
}

/**
 * Perform Direct Sign-In: build the authorization URL, validate `iss` on the
 * redirect, and exchange the code at the token endpoint with a client
 * assertion.
 * @param {object} input - Tool input
 * @param {string} input.issuer - The company's issuer URL
 * @param {string} input.clientId - The agent's client_id
 * @param {string} input.redirectUri - The redirect URI
 * @param {string} input.scope - The requested scope
 * @param {string} [input.state] - The CSRF state
 * @param {string} [input.code] - The authorization code (for exchange)
 * @param {string} [input.codeVerifier] - The PKCE code verifier
 * @param {boolean} [input.crossDevice=false] - Whether to enforce prompt=consent
 * @param {object} [options] - Runtime options
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
async function directSignIn(input, options = {}) {
	const { issuer, clientId, redirectUri, scope } = input;
	if (!issuer || !clientId || !redirectUri || !scope) {
		return { ok: false, error: "issuer, clientId, redirectUri, and scope are required" };
	}
	try {
		const metadata = await discoverMetadata(issuer, options);
		if (!metadata.ok) {
			return { ok: false, error: metadata.error };
		}
		const { authorizationEndpoint, tokenEndpoint } = metadata.data;

		// Build the authorization URL with PKCE.
		const { verifier, challenge } = generatePkce();
		const state = input.state ?? randomUUID();
		const authUrl = buildAuthorizationUrl({
			authorizationEndpoint,
			clientId,
			redirectUri,
			scope,
			state,
			codeChallenge: challenge,
			crossDevice: input.crossDevice ?? false,
		});

		// If no code is provided, return the authorization URL for the user.
		if (!input.code) {
			return {
				ok: true,
				data: {
					authorizationUrl: authUrl,
					state,
					codeVerifier: verifier,
				},
			};
		}

		// Validate the `iss` on the redirect before exchanging.
		if (input.iss) {
			const issResult = validateIss(input.iss, issuer);
			if (!issResult.ok) {
				return { ok: false, error: issResult.error };
			}
		}

		const privateKey = await resolvePrivateKey(input, options);
		if (!privateKey) {
			return { ok: false, error: "privateKey or keyDir/keyId is required for token exchange" };
		}

		const exchange = await exchangeCode({
			tokenEndpoint,
			clientId,
			redirectUri,
			code: input.code,
			codeVerifier: input.codeVerifier ?? verifier,
			privateKey,
			issuer,
			alg: input.alg,
			now: input.now,
			fetchOptions: options,
		});
		return exchange.ok ? { ok: true, data: exchange.data } : { ok: false, error: exchange.error };
	} catch (err) {
		return { ok: false, error: err.message };
	}
}

/**
 * Perform Device Sign-In: request a device code, surface the verification URI
 * and user code, and poll the token endpoint until approved, denied, or
 * expired.
 * @param {object} input - Tool input
 * @param {string} input.issuer - The company's issuer URL
 * @param {string} input.clientId - The agent's client_id
 * @param {string} input.scope - The requested scope
 * @param {boolean} [input.poll=false] - Whether to poll for tokens
 * @param {object} [options] - Runtime options
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
async function deviceSignIn(input, options = {}) {
	const { issuer, clientId, scope } = input;
	if (!issuer || !clientId || !scope) {
		return { ok: false, error: "issuer, clientId, and scope are required" };
	}
	try {
		const metadata = await discoverMetadata(issuer, options);
		if (!metadata.ok) {
			return { ok: false, error: metadata.error };
		}
		const { deviceAuthorizationEndpoint, tokenEndpoint } = metadata.data;
		if (!deviceAuthorizationEndpoint) {
			return { ok: false, error: "issuer does not advertise a device authorization endpoint" };
		}

		const deviceResult = await requestDeviceCode({
			deviceAuthorizationEndpoint,
			clientId,
			scope,
			fetchOptions: options,
		});
		if (!deviceResult.ok) {
			return { ok: false, error: deviceResult.error };
		}
		const device = deviceResult.data;

		if (!input.poll) {
			return {
				ok: true,
				data: {
					deviceCode: device.device_code,
					userCode: device.user_code,
					verificationUri: device.verification_uri,
					verificationUriComplete: device.verification_uri_complete,
					expiresIn: device.expires_in,
					interval: device.interval,
				},
			};
		}

		const pollResult = await pollDeviceToken({
			tokenEndpoint,
			clientId,
			deviceCode: device.device_code,
			interval: device.interval,
			expiresIn: device.expires_in,
			now: input.now,
			fetchOptions: options,
		});
		return pollResult.ok
			? { ok: true, data: pollResult.data }
			: { ok: false, error: pollResult.error };
	} catch (err) {
		return { ok: false, error: err.message };
	}
}

/**
 * Exchange a refresh token for a new access token and rotated refresh token.
 * @param {object} input - Tool input
 * @param {string} input.issuer - The company's issuer URL
 * @param {string} input.clientId - The agent's client_id
 * @param {string} input.refreshToken - The refresh token
 * @param {object} [options] - Runtime options
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
async function refreshTokenOp(input, options = {}) {
	const { issuer, clientId, refreshToken: refreshTokenValue } = input;
	if (!issuer || !clientId || !refreshTokenValue) {
		return { ok: false, error: "issuer, clientId, and refreshToken are required" };
	}
	try {
		const metadata = await discoverMetadata(issuer, options);
		if (!metadata.ok) {
			return { ok: false, error: metadata.error };
		}
		const privateKey = await resolvePrivateKey(input, options);
		if (!privateKey) {
			return { ok: false, error: "privateKey or keyDir/keyId is required for refresh" };
		}
		const result = await refreshToken({
			tokenEndpoint: metadata.data.tokenEndpoint,
			clientId,
			refreshToken: refreshTokenValue,
			privateKey,
			issuer,
			alg: input.alg,
			now: input.now,
			fetchOptions: options,
		});
		return result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error };
	} catch (err) {
		return { ok: false, error: err.message };
	}
}

/**
 * Revoke an access or refresh token at the revocation endpoint.
 * @param {object} input - Tool input
 * @param {string} input.issuer - The company's issuer URL
 * @param {string} input.token - The token to revoke
 * @param {string} [input.tokenTypeHint] - The token type hint
 * @param {object} [options] - Runtime options
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
async function revokeTokenOp(input, options = {}) {
	const { issuer, token } = input;
	if (!issuer || !token) {
		return { ok: false, error: "issuer and token are required" };
	}
	try {
		const metadata = await discoverMetadata(issuer, options);
		if (!metadata.ok) {
			return { ok: false, error: metadata.error };
		}
		if (!metadata.data.revocationEndpoint) {
			return { ok: false, error: "issuer does not advertise a revocation endpoint" };
		}
		const result = await revokeToken({
			revocationEndpoint: metadata.data.revocationEndpoint,
			clientId: input.clientId,
			token,
			tokenTypeHint: input.tokenTypeHint,
			fetchOptions: options,
		});
		return result.ok ? { ok: true, data: { revoked: true } } : { ok: false, error: result.error };
	} catch (err) {
		return { ok: false, error: err.message };
	}
}
