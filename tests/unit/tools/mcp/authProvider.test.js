import { test, describe } from "node:test";
import assert from "node:assert";
import {
	LangChainOAuthClientProvider,
	createAuthProvider,
	readResponseStore,
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

		test("exposes a non-interactive redirectUrl by default", () => {
			const provider = createAuthProvider({});
			assert.strictEqual(provider.redirectUrl, undefined);
		});

		test("exposes a callback redirectUrl for the browser flow", () => {
			const provider = createAuthProvider({ flow: "browser", callbackPort: 4567 });
			assert.strictEqual(provider.redirectUrl, "http://localhost:4567/callback");
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

		test("includes the callback URI in client metadata for the browser flow", () => {
			const provider = createAuthProvider({
				flow: "browser",
				callbackPort: 4567,
				clientId: "my-client",
			});
			assert.deepStrictEqual(provider.clientMetadata, {
				redirect_uris: ["http://localhost:4567/callback"],
				client_name: "my-client",
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

	describe("browser flow callback server", () => {
		test("starts a callback server and captures a code with matching state", async () => {
			const provider = createAuthProvider({ flow: "browser", callbackPort: 0 });
			await provider._startCallbackServer();
			const port = provider._callbackServer.address().port;
			const state = provider.state();
			const res = await fetch(`http://localhost:${port}/callback?code=abc123&state=${state}`);
			assert.strictEqual(res.status, 200);
			const entry = readResponseStore();
			assert.strictEqual(entry.code, "abc123");
			assert.strictEqual(entry.state, state);
			await provider._stopCallbackServer();
		});

		test("rejects a redirect with a state mismatch", async () => {
			const provider = createAuthProvider({ flow: "browser", callbackPort: 0 });
			await provider._startCallbackServer();
			const port = provider._callbackServer.address().port;
			const res = await fetch(`http://localhost:${port}/callback?code=abc123&state=wrong`);
			assert.strictEqual(res.status, 400);
			const entry = readResponseStore();
			assert.strictEqual(entry.error, "state_mismatch");
			await provider._stopCallbackServer();
		});

		test("rejects a redirect with a missing code", async () => {
			const provider = createAuthProvider({ flow: "browser", callbackPort: 0 });
			await provider._startCallbackServer();
			const port = provider._callbackServer.address().port;
			const state = provider.state();
			const res = await fetch(`http://localhost:${port}/callback?state=${state}`);
			assert.strictEqual(res.status, 400);
			const entry = readResponseStore();
			assert.strictEqual(entry.error, "missing_code");
			await provider._stopCallbackServer();
		});

		test("clears the response store entry when stopped", async () => {
			const provider = createAuthProvider({ flow: "browser", callbackPort: 0 });
			await provider._startCallbackServer();
			const port = provider._callbackServer.address().port;
			const state = provider.state();
			await fetch(`http://localhost:${port}/callback?code=abc123&state=${state}`);
			await provider._stopCallbackServer();
			assert.strictEqual(readResponseStore(), undefined);
		});
	});

	describe("prepareTokenRequest", () => {
		test("returns authorization_code params for the browser flow", async () => {
			const provider = createAuthProvider({ flow: "browser", callbackPort: 4567 });
			provider.saveCodeVerifier("verifier");
			await provider._startCallbackServer();
			const port = provider._callbackServer.address().port;
			await fetch(`http://localhost:${port}/callback?code=code123&state=${provider.state()}`);
			const params = provider.prepareTokenRequest("app:mcp");
			assert.strictEqual(params.get("grant_type"), "authorization_code");
			assert.strictEqual(params.get("code"), "code123");
			assert.strictEqual(params.get("code_verifier"), "verifier");
			assert.strictEqual(params.get("redirect_uri"), "http://localhost:4567/callback");
			assert.strictEqual(params.get("scope"), "app:mcp");
			await provider._stopCallbackServer();
		});

		test("returns undefined for the non-interactive flow", () => {
			const provider = createAuthProvider({});
			assert.strictEqual(provider.prepareTokenRequest("app:mcp"), undefined);
		});
	});
});
