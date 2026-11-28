import { test, describe } from "node:test";
import assert from "node:assert";
import {
	LangChainOAuthClientProvider,
	createAuthProvider,
} from "../../../../src/tools/mcp/authProvider.js";

describe("LangChainOAuthClientProvider", () => {
	describe("construction", () => {
		test("creates a provider from config", () => {
			const provider = createAuthProvider({
				clientId: "my-client",
				scopes: ["app:mcp", "offline"],
			});
			assert.ok(provider instanceof LangChainOAuthClientProvider);
		});

		test("exposes a non-interactive redirectUrl", () => {
			const provider = createAuthProvider({});
			assert.strictEqual(provider.redirectUrl, undefined);
		});

		test("exposes client metadata with scopes", () => {
			const provider = createAuthProvider({
				clientId: "my-client",
				scopes: ["app:mcp", "offline"],
			});
			assert.deepStrictEqual(provider.clientMetadata, {
				redirect_uris: [],
				client_name: "my-client",
				scope: "app:mcp offline",
			});
		});

		test("omits scope from client metadata when no scopes are set", () => {
			const provider = createAuthProvider({ clientId: "my-client" });
			assert.deepStrictEqual(provider.clientMetadata, {
				redirect_uris: [],
				client_name: "my-client",
			});
		});
	});

	describe("client information", () => {
		test("returns undefined before registration", () => {
			const provider = createAuthProvider({});
			assert.strictEqual(provider.clientInformation(), undefined);
		});

		test("stores and returns client information", () => {
			const provider = createAuthProvider({});
			provider.saveClientInformation({ client_id: "registered" });
			assert.deepStrictEqual(provider.clientInformation(), { client_id: "registered" });
		});
	});

	describe("tokens", () => {
		test("returns undefined before authorization", () => {
			const provider = createAuthProvider({});
			assert.strictEqual(provider.tokens(), undefined);
		});

		test("stores and returns tokens", () => {
			const provider = createAuthProvider({});
			provider.saveTokens({ access_token: "abc", token_type: "Bearer" });
			assert.deepStrictEqual(provider.tokens(), {
				access_token: "abc",
				token_type: "Bearer",
			});
		});
	});

	describe("PKCE code verifier", () => {
		test("returns empty string before a verifier is saved", () => {
			const provider = createAuthProvider({});
			assert.strictEqual(provider.codeVerifier(), "");
		});

		test("stores and returns the code verifier", () => {
			const provider = createAuthProvider({});
			provider.saveCodeVerifier("verifier");
			assert.strictEqual(provider.codeVerifier(), "verifier");
		});
	});

	describe("redirectToAuthorization", () => {
		test("stores a token when authenticate completes immediately", async () => {
			const provider = createAuthProvider({
				provider: "mcp",
				scopes: ["app:mcp"],
				userId: "user-1",
			});
			// Stub the LangChain Auth client to avoid network calls.
			provider._client = {
				authenticate: async () => ({ status: "completed", token: "tok-123" }),
			};
			await provider.redirectToAuthorization(new URL("https://app.base44.com/authorize"));
			assert.deepStrictEqual(provider.tokens(), {
				access_token: "tok-123",
				token_type: "Bearer",
			});
		});

		test("polls for a token when authenticate returns a pending authId", async () => {
			const provider = createAuthProvider({
				provider: "mcp",
				scopes: ["app:mcp"],
				userId: "user-1",
			});
			provider._client = {
				authenticate: async () => ({ status: "pending", authId: "auth-1" }),
				waitForCompletion: async () => ({ status: "completed", token: "tok-456" }),
			};
			await provider.redirectToAuthorization(new URL("https://app.base44.com/authorize"));
			assert.deepStrictEqual(provider.tokens(), {
				access_token: "tok-456",
				token_type: "Bearer",
			});
		});
	});
});
