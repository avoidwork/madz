import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair } from "jose";
import { execute } from "../../../../src/tools/poppy/oauth.js";

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

describe("poppy - integration oauth", () => {
	it("performs Direct Sign-In against a mock OAuth server", async () => {
		const { privateKey } = await generateKeyPair("ES256", { extractable: true });
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
			if (href.includes("/token")) {
				return {
					ok: true,
					status: 200,
					json: async () => ({
						access_token: "access-token",
						token_type: "Bearer",
						refresh_token: "refresh-token",
					}),
				};
			}
			return { ok: false, status: 404, json: async () => ({}) };
		});

		const result = await execute({
			op: "direct_sign_in",
			issuer: ISSUER,
			clientId: CLIENT_ID,
			redirectUri: REDIRECT_URI,
			scope: SCOPE,
			code: "auth-code",
			codeVerifier: "verifier",
			iss: ISSUER,
			privateKey,
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.access_token, "access-token");
		assert.strictEqual(result.data.refresh_token, "refresh-token");
	});

	it("performs Device Sign-In against a mock OAuth server", async () => {
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
			if (href.includes("/device")) {
				return {
					ok: true,
					status: 200,
					json: async () => ({
						device_code: "device-code",
						user_code: "ABCD-EFGH",
						verification_uri: "https://company.example.com/device",
						verification_uri_complete: "https://company.example.com/device?user_code=ABCD-EFGH",
						expires_in: 600,
						interval: 5,
					}),
				};
			}
			if (href.includes("/token")) {
				return {
					ok: true,
					status: 200,
					json: async () => ({
						access_token: "access-token",
						token_type: "Bearer",
						refresh_token: "refresh-token",
					}),
				};
			}
			return { ok: false, status: 404, json: async () => ({}) };
		});

		const result = await execute({
			op: "device_sign_in",
			issuer: ISSUER,
			clientId: CLIENT_ID,
			scope: SCOPE,
			poll: true,
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.access_token, "access-token");
		assert.strictEqual(result.data.refresh_token, "refresh-token");
	});

	it("rotates a refresh token against a mock OAuth server", async () => {
		const { privateKey } = await generateKeyPair("ES256", { extractable: true });
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
			if (href.includes("/token")) {
				return {
					ok: true,
					status: 200,
					json: async () => ({
						access_token: "new-access-token",
						token_type: "Bearer",
						refresh_token: "new-refresh-token",
					}),
				};
			}
			return { ok: false, status: 404, json: async () => ({}) };
		});

		const result = await execute({
			op: "refresh_token",
			issuer: ISSUER,
			clientId: CLIENT_ID,
			refreshToken: "old-refresh-token",
			privateKey,
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.access_token, "new-access-token");
		assert.strictEqual(result.data.refresh_token, "new-refresh-token");
	});

	it("revokes a token against a mock OAuth server", async () => {
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
			if (href.includes("/revoke")) {
				return { ok: true, status: 200, json: async () => ({}) };
			}
			return { ok: false, status: 404, json: async () => ({}) };
		});

		const result = await execute({
			op: "revoke_token",
			issuer: ISSUER,
			clientId: CLIENT_ID,
			token: "access-token",
			tokenTypeHint: "access_token",
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.revoked, true);
	});
});
