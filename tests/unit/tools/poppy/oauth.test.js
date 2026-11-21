import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, decodeJwt, decodeProtectedHeader } from "jose";
import {
	AuthorizationServerMetadataSchema,
	ProtectedResourceMetadataSchema,
	TokenResponseSchema,
	DeviceCodeResponseSchema,
	generatePkce,
	buildAuthorizationUrl,
	validateIss,
	generateDpopProof,
	discoverMetadata,
	exchangeCode,
	requestDeviceCode,
	pollDeviceToken,
	refreshToken,
	revokeToken,
	execute,
} from "../../../../src/tools/poppy/oauth.js";

const ISSUER = "https://company.example.com";
const CLIENT_ID = "https://agent.example.com";
const REDIRECT_URI = "https://agent.example.com/callback";
const SCOPE = "openid profile";

const AS_METADATA = {
	issuer: ISSUER,
	authorization_endpoint: "https://company.example.com/authorize",
	token_endpoint: "https://company.example.com/token",
	device_authorization_endpoint: "https://company.example.com/device",
	revocation_endpoint: "https://company.example.com/revoke",
	dpop_signing_alg_values_supported: ["ES256"],
};

async function makeKeys() {
	const { publicKey, privateKey } = await generateKeyPair("ES256", { extractable: true });
	return { publicKey, privateKey };
}

describe("poppy oauth - schema validation", () => {
	it("accepts valid authorization server metadata", () => {
		const result = AuthorizationServerMetadataSchema.safeParse(AS_METADATA);
		assert.strictEqual(result.success, true);
	});

	it("rejects authorization server metadata missing required fields", () => {
		const result = AuthorizationServerMetadataSchema.safeParse({ issuer: ISSUER });
		assert.strictEqual(result.success, false);
	});

	it("accepts valid protected resource metadata", () => {
		const result = ProtectedResourceMetadataSchema.safeParse({
			resource: "https://company.example.com/api",
			authorization_servers: [ISSUER],
		});
		assert.strictEqual(result.success, true);
	});

	it("rejects protected resource metadata missing authorization_servers", () => {
		const result = ProtectedResourceMetadataSchema.safeParse({
			resource: "https://company.example.com/api",
		});
		assert.strictEqual(result.success, false);
	});

	it("accepts a valid token response", () => {
		const result = TokenResponseSchema.safeParse({
			access_token: "access-token",
			token_type: "Bearer",
			expires_in: 3600,
			refresh_token: "refresh-token",
		});
		assert.strictEqual(result.success, true);
	});

	it("rejects a token response missing access_token", () => {
		const result = TokenResponseSchema.safeParse({ token_type: "Bearer" });
		assert.strictEqual(result.success, false);
	});

	it("accepts a valid device code response", () => {
		const result = DeviceCodeResponseSchema.safeParse({
			device_code: "device-code",
			user_code: "ABCD-EFGH",
			verification_uri: "https://company.example.com/device",
			expires_in: 600,
			interval: 5,
		});
		assert.strictEqual(result.success, true);
	});

	it("rejects a device code response missing device_code", () => {
		const result = DeviceCodeResponseSchema.safeParse({
			user_code: "ABCD-EFGH",
			verification_uri: "https://company.example.com/device",
			expires_in: 600,
		});
		assert.strictEqual(result.success, false);
	});
});

describe("poppy oauth - generatePkce", () => {
	it("derives an S256 code challenge from the verifier", () => {
		const { verifier, challenge } = generatePkce();
		assert.ok(verifier);
		assert.ok(challenge);
		assert.notStrictEqual(verifier, challenge);
	});

	it("produces unique verifiers", () => {
		const a = generatePkce();
		const b = generatePkce();
		assert.notStrictEqual(a.verifier, b.verifier);
	});
});

describe("poppy oauth - buildAuthorizationUrl", () => {
	it("includes all required parameters", () => {
		const url = buildAuthorizationUrl({
			authorizationEndpoint: "https://company.example.com/authorize",
			clientId: CLIENT_ID,
			redirectUri: REDIRECT_URI,
			scope: SCOPE,
			state: "state-123",
			codeChallenge: "challenge-abc",
		});
		const parsed = new URL(url);
		assert.strictEqual(parsed.searchParams.get("response_type"), "code");
		assert.strictEqual(parsed.searchParams.get("client_id"), CLIENT_ID);
		assert.strictEqual(parsed.searchParams.get("redirect_uri"), REDIRECT_URI);
		assert.strictEqual(parsed.searchParams.get("scope"), SCOPE);
		assert.strictEqual(parsed.searchParams.get("state"), "state-123");
		assert.strictEqual(parsed.searchParams.get("code_challenge"), "challenge-abc");
		assert.strictEqual(parsed.searchParams.get("code_challenge_method"), "S256");
	});

	it("enforces prompt=consent for cross-device Direct Sign-In", () => {
		const url = buildAuthorizationUrl({
			authorizationEndpoint: "https://company.example.com/authorize",
			clientId: CLIENT_ID,
			redirectUri: REDIRECT_URI,
			scope: SCOPE,
			state: "state-123",
			codeChallenge: "challenge-abc",
			crossDevice: true,
		});
		const parsed = new URL(url);
		assert.strictEqual(parsed.searchParams.get("prompt"), "consent");
	});

	it("omits prompt=consent for same-device Direct Sign-In", () => {
		const url = buildAuthorizationUrl({
			authorizationEndpoint: "https://company.example.com/authorize",
			clientId: CLIENT_ID,
			redirectUri: REDIRECT_URI,
			scope: SCOPE,
			state: "state-123",
			codeChallenge: "challenge-abc",
		});
		const parsed = new URL(url);
		assert.strictEqual(parsed.searchParams.get("prompt"), null);
	});
});

describe("poppy oauth - validateIss", () => {
	it("accepts a matching issuer", () => {
		const result = validateIss(ISSUER, ISSUER);
		assert.strictEqual(result.ok, true);
	});

	it("rejects a mismatched issuer", () => {
		const result = validateIss("https://evil.example.com", ISSUER);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /does not match/);
	});
});

describe("poppy oauth - generateDpopProof", () => {
	it("generates a DPoP proof with typ dpop+jwt", async () => {
		const { privateKey } = await makeKeys();
		const result = await generateDpopProof({
			privateKey,
			htm: "POST",
			htu: "https://company.example.com/token",
		});
		assert.ok(result.jwt);
		assert.ok(result.jti);
		assert.ok(result.iat > 0);
		const header = decodeProtectedHeader(result.jwt);
		assert.strictEqual(header.typ, "dpop+jwt");
		assert.strictEqual(header.alg, "ES256");
		assert.ok(header.jwk);
		const payload = decodeJwt(result.jwt);
		assert.strictEqual(payload.htm, "POST");
		assert.strictEqual(payload.htu, "https://company.example.com/token");
	});
});

describe("poppy oauth - discoverMetadata", () => {
	it("discovers authorization server metadata and validates issuer", async () => {
		mock.method(global, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => AS_METADATA,
		}));
		const result = await discoverMetadata(ISSUER);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.issuer, ISSUER);
		assert.strictEqual(result.data.authorizationEndpoint, AS_METADATA.authorization_endpoint);
		assert.strictEqual(result.data.tokenEndpoint, AS_METADATA.token_endpoint);
		assert.strictEqual(
			result.data.deviceAuthorizationEndpoint,
			AS_METADATA.device_authorization_endpoint,
		);
		assert.strictEqual(result.data.revocationEndpoint, AS_METADATA.revocation_endpoint);
		assert.deepStrictEqual(result.data.dpopSigningAlgValuesSupported, ["ES256"]);
	});

	it("rejects an issuer mismatch", async () => {
		mock.method(global, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => ({ ...AS_METADATA, issuer: "https://evil.example.com" }),
		}));
		const result = await discoverMetadata(ISSUER);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /does not match expected issuer/);
	});

	it("rejects malformed metadata", async () => {
		mock.method(global, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => ({ issuer: ISSUER }),
		}));
		const result = await discoverMetadata(ISSUER);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /Invalid authorization server metadata/);
	});

	it("rejects a non-200 metadata response", async () => {
		mock.method(global, "fetch", async () => ({
			ok: false,
			status: 404,
			json: async () => ({}),
		}));
		const result = await discoverMetadata(ISSUER);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /HTTP error 404/);
	});
});

describe("poppy oauth - exchangeCode", () => {
	it("exchanges a code for tokens with a client assertion", async () => {
		const { privateKey } = await makeKeys();
		let capturedBody = null;
		mock.method(global, "fetch", async (_url, opts) => {
			capturedBody = opts.body;
			return {
				ok: true,
				status: 200,
				json: async () => ({
					access_token: "access-token",
					token_type: "Bearer",
					refresh_token: "refresh-token",
				}),
			};
		});
		const result = await exchangeCode({
			tokenEndpoint: "https://company.example.com/token",
			clientId: CLIENT_ID,
			redirectUri: REDIRECT_URI,
			code: "auth-code",
			codeVerifier: "verifier",
			privateKey,
			issuer: ISSUER,
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.access_token, "access-token");
		assert.ok(capturedBody.includes("grant_type=authorization_code"));
		assert.ok(capturedBody.includes("client_assertion="));
	});

	it("rejects an invalid_grant response", async () => {
		const { privateKey } = await makeKeys();
		mock.method(global, "fetch", async () => ({
			ok: false,
			status: 400,
			json: async () => ({ error: "invalid_grant" }),
		}));
		const result = await exchangeCode({
			tokenEndpoint: "https://company.example.com/token",
			clientId: CLIENT_ID,
			redirectUri: REDIRECT_URI,
			code: "auth-code",
			codeVerifier: "verifier",
			privateKey,
			issuer: ISSUER,
		});
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /Token exchange failed/);
	});

	it("rejects an invalid_scope response", async () => {
		const { privateKey } = await makeKeys();
		mock.method(global, "fetch", async () => ({
			ok: false,
			status: 400,
			json: async () => ({ error: "invalid_scope" }),
		}));
		const result = await exchangeCode({
			tokenEndpoint: "https://company.example.com/token",
			clientId: CLIENT_ID,
			redirectUri: REDIRECT_URI,
			code: "auth-code",
			codeVerifier: "verifier",
			privateKey,
			issuer: ISSUER,
		});
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /Token exchange failed/);
	});

	it("rejects a malformed token response", async () => {
		const { privateKey } = await makeKeys();
		mock.method(global, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => ({ token_type: "Bearer" }),
		}));
		const result = await exchangeCode({
			tokenEndpoint: "https://company.example.com/token",
			clientId: CLIENT_ID,
			redirectUri: REDIRECT_URI,
			code: "auth-code",
			codeVerifier: "verifier",
			privateKey,
			issuer: ISSUER,
		});
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /Invalid token response/);
	});
});

describe("poppy oauth - requestDeviceCode", () => {
	it("requests a device code", async () => {
		mock.method(global, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => ({
				device_code: "device-code",
				user_code: "ABCD-EFGH",
				verification_uri: "https://company.example.com/device",
				expires_in: 600,
				interval: 5,
			}),
		}));
		const result = await requestDeviceCode({
			deviceAuthorizationEndpoint: "https://company.example.com/device",
			clientId: CLIENT_ID,
			scope: SCOPE,
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.device_code, "device-code");
		assert.strictEqual(result.data.user_code, "ABCD-EFGH");
		assert.strictEqual(result.data.verification_uri, "https://company.example.com/device");
	});

	it("rejects a device code request failure", async () => {
		mock.method(global, "fetch", async () => ({
			ok: false,
			status: 400,
			json: async () => ({ error: "invalid_request" }),
		}));
		const result = await requestDeviceCode({
			deviceAuthorizationEndpoint: "https://company.example.com/device",
			clientId: CLIENT_ID,
			scope: SCOPE,
		});
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /Device code request failed/);
	});

	it("rejects a malformed device code response", async () => {
		mock.method(global, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => ({ user_code: "ABCD-EFGH" }),
		}));
		const result = await requestDeviceCode({
			deviceAuthorizationEndpoint: "https://company.example.com/device",
			clientId: CLIENT_ID,
			scope: SCOPE,
		});
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /Invalid device code response/);
	});
});

describe("poppy oauth - pollDeviceToken", () => {
	it("polls until approved", async () => {
		let calls = 0;
		mock.method(global, "fetch", async () => {
			calls++;
			if (calls < 3) {
				return {
					ok: false,
					status: 400,
					json: async () => ({ error: "authorization_pending" }),
				};
			}
			return {
				ok: true,
				status: 200,
				json: async () => ({ access_token: "access-token", token_type: "Bearer" }),
			};
		});
		const result = await pollDeviceToken({
			tokenEndpoint: "https://company.example.com/token",
			clientId: CLIENT_ID,
			deviceCode: "device-code",
			interval: 0,
			expiresIn: 600,
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.access_token, "access-token");
	});

	it("handles access_denied", async () => {
		mock.method(global, "fetch", async () => ({
			ok: false,
			status: 400,
			json: async () => ({ error: "access_denied" }),
		}));
		const result = await pollDeviceToken({
			tokenEndpoint: "https://company.example.com/token",
			clientId: CLIENT_ID,
			deviceCode: "device-code",
			interval: 0,
			expiresIn: 600,
		});
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /denied/);
	});

	it("handles expired_token", async () => {
		mock.method(global, "fetch", async () => ({
			ok: false,
			status: 400,
			json: async () => ({ error: "expired_token" }),
		}));
		const result = await pollDeviceToken({
			tokenEndpoint: "https://company.example.com/token",
			clientId: CLIENT_ID,
			deviceCode: "device-code",
			interval: 0,
			expiresIn: 600,
		});
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /expired/);
	});

	it("times out when the device code expires", async () => {
		mock.method(global, "fetch", async () => ({
			ok: false,
			status: 400,
			json: async () => ({ error: "authorization_pending" }),
		}));
		const result = await pollDeviceToken({
			tokenEndpoint: "https://company.example.com/token",
			clientId: CLIENT_ID,
			deviceCode: "device-code",
			interval: 0,
			expiresIn: 0,
			now: Date.now(),
		});
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /expired/);
	});
});

describe("poppy oauth - refreshToken", () => {
	it("rotates a refresh token", async () => {
		const { privateKey } = await makeKeys();
		mock.method(global, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => ({
				access_token: "new-access-token",
				token_type: "Bearer",
				refresh_token: "new-refresh-token",
			}),
		}));
		const result = await refreshToken({
			tokenEndpoint: "https://company.example.com/token",
			clientId: CLIENT_ID,
			refreshToken: "old-refresh-token",
			privateKey,
			issuer: ISSUER,
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.access_token, "new-access-token");
		assert.strictEqual(result.data.refresh_token, "new-refresh-token");
	});

	it("rejects an invalid refresh token", async () => {
		const { privateKey } = await makeKeys();
		mock.method(global, "fetch", async () => ({
			ok: false,
			status: 400,
			json: async () => ({ error: "invalid_grant" }),
		}));
		const result = await refreshToken({
			tokenEndpoint: "https://company.example.com/token",
			clientId: CLIENT_ID,
			refreshToken: "old-refresh-token",
			privateKey,
			issuer: ISSUER,
		});
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /Refresh failed/);
	});
});

describe("poppy oauth - revokeToken", () => {
	it("revokes a token", async () => {
		mock.method(global, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => ({}),
		}));
		const result = await revokeToken({
			revocationEndpoint: "https://company.example.com/revoke",
			clientId: CLIENT_ID,
			token: "access-token",
			tokenTypeHint: "access_token",
		});
		assert.strictEqual(result.ok, true);
	});

	it("reports a revocation failure", async () => {
		mock.method(global, "fetch", async () => ({
			ok: false,
			status: 400,
			json: async () => ({ error: "unsupported_token_type" }),
		}));
		const result = await revokeToken({
			revocationEndpoint: "https://company.example.com/revoke",
			clientId: CLIENT_ID,
			token: "access-token",
		});
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /Revocation failed/);
	});
});

describe("poppy oauth - execute", () => {
	it("discovers metadata", async () => {
		mock.method(global, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => AS_METADATA,
		}));
		const result = await execute({ op: "discover", issuer: ISSUER });
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.issuer, ISSUER);
	});

	it("rejects discover without an issuer", async () => {
		const result = await execute({ op: "discover" });
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /issuer is required/);
	});

	it("builds a Direct Sign-In authorization URL", async () => {
		mock.method(global, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => AS_METADATA,
		}));
		const result = await execute({
			op: "direct_sign_in",
			issuer: ISSUER,
			clientId: CLIENT_ID,
			redirectUri: REDIRECT_URI,
			scope: SCOPE,
			crossDevice: true,
		});
		assert.strictEqual(result.ok, true);
		assert.ok(result.data.authorizationUrl);
		assert.ok(result.data.state);
		assert.ok(result.data.codeVerifier);
		const parsed = new URL(result.data.authorizationUrl);
		assert.strictEqual(parsed.searchParams.get("response_type"), "code");
		assert.strictEqual(parsed.searchParams.get("prompt"), "consent");
	});

	it("rejects direct_sign_in missing required fields", async () => {
		const result = await execute({ op: "direct_sign_in", issuer: ISSUER });
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /issuer, clientId, redirectUri, and scope are required/);
	});

	it("validates iss on the redirect during Direct Sign-In exchange", async () => {
		const { privateKey } = await makeKeys();
		mock.method(global, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => AS_METADATA,
		}));
		const result = await execute({
			op: "direct_sign_in",
			issuer: ISSUER,
			clientId: CLIENT_ID,
			redirectUri: REDIRECT_URI,
			scope: SCOPE,
			code: "auth-code",
			codeVerifier: "verifier",
			iss: "https://evil.example.com",
			privateKey,
		});
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /does not match/);
	});

	it("requests a device code", async () => {
		mock.method(global, "fetch", async (url) => {
			const href = String(url);
			if (href.includes("oauth-authorization-server")) {
				return { ok: true, status: 200, json: async () => AS_METADATA };
			}
			if (href.includes("oauth-protected-resource")) {
				return {
					ok: true,
					status: 200,
					json: async () => ({
						resource: "https://company.example.com/api",
						authorization_servers: [ISSUER],
					}),
				};
			}
			return {
				ok: true,
				status: 200,
				json: async () => ({
					device_code: "device-code",
					user_code: "ABCD-EFGH",
					verification_uri: "https://company.example.com/device",
					expires_in: 600,
					interval: 5,
				}),
			};
		});
		const result = await execute({
			op: "device_sign_in",
			issuer: ISSUER,
			clientId: CLIENT_ID,
			scope: SCOPE,
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.userCode, "ABCD-EFGH");
		assert.strictEqual(result.data.verificationUri, "https://company.example.com/device");
	});

	it("rejects device_sign_in missing required fields", async () => {
		const result = await execute({ op: "device_sign_in", issuer: ISSUER });
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /issuer, clientId, and scope are required/);
	});

	it("rejects an unknown operation", async () => {
		const result = await execute({ op: "nope" });
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /Unknown oauth operation/);
	});
});
