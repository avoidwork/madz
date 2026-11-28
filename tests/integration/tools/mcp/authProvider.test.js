import { describe, it } from "node:test";
import assert from "node:assert";
import { createServer } from "node:http";
import {
	LangChainOAuthClientProvider,
	createAuthProvider,
	readResponseStore,
} from "../../../../src/tools/mcp/authProvider.js";

/**
 * Integration tests for the browser-based OAuth2 flow with a container/host
 * bridge. These spin up a mock authorization server and a provider callback
 * server, then simulate the host browser redirect to the callback port.
 */

describe("MCP browser OAuth2 flow (integration)", () => {
	it("captures the authorization code via the callback server and exchanges it", async () => {
		// Mock authorization server that issues a code and redirects the browser
		// to the callback URI.
		const authServer = createServer((req, res) => {
			const url = new URL(req.url, "http://localhost");
			if (url.pathname === "/authorize") {
				const state = url.searchParams.get("state");
				const redirect = url.searchParams.get("redirect_uri");
				res.writeHead(302, { Location: `${redirect}?code=mock-code&state=${state}` });
				res.end();
				return;
			}
			res.writeHead(404);
			res.end();
		});
		await new Promise((resolve) => authServer.listen(0, "127.0.0.1", resolve));
		const authPort = authServer.address().port;

		const provider = createAuthProvider({ flow: "browser", callbackPort: 0 });
		await provider._startCallbackServer();
		const callbackPort = provider._callbackServer.address().port;
		const state = provider.state();

		// Build the authorization URL and simulate the browser flow. Follow the
		// redirect so the callback server actually receives the code.
		const authUrl = new URL(`http://localhost:${authPort}/authorize`);
		authUrl.searchParams.set("state", state);
		authUrl.searchParams.set("redirect_uri", `http://localhost:${callbackPort}/callback`);
		const res = await fetch(authUrl.href);
		assert.strictEqual(res.status, 200);

		// The callback server should have captured the code.
		const entry = readResponseStore();
		assert.strictEqual(entry.code, "mock-code");
		assert.strictEqual(entry.state, state);

		// The provider can exchange the code for tokens.
		provider.saveCodeVerifier("verifier");
		const params = provider.prepareTokenRequest("app:mcp");
		assert.strictEqual(params.get("grant_type"), "authorization_code");
		assert.strictEqual(params.get("code"), "mock-code");
		assert.strictEqual(params.get("code_verifier"), "verifier");
		assert.strictEqual(params.get("redirect_uri"), `http://localhost:${callbackPort}/callback`);

		await provider._stopCallbackServer();
		await new Promise((resolve) => authServer.close(resolve));
	});

	it("rejects a state mismatch from the mock authorization server", async () => {
		const provider = createAuthProvider({ flow: "browser", callbackPort: 0 });
		await provider._startCallbackServer();
		const callbackPort = provider._callbackServer.address().port;

		// Simulate a redirect with a wrong state.
		const res = await fetch(
			`http://localhost:${callbackPort}/callback?code=mock-code&state=wrong-state`,
		);
		assert.strictEqual(res.status, 400);
		const entry = readResponseStore();
		assert.strictEqual(entry.error, "state_mismatch");

		await provider._stopCallbackServer();
	});

	it("exposes a callback redirect URL and client metadata for the browser flow", () => {
		const provider = createAuthProvider({
			flow: "browser",
			callbackPort: 4567,
			clientId: "my-client",
		});
		assert.strictEqual(provider.redirectUrl, "http://localhost:4567/callback");
		assert.deepStrictEqual(provider.clientMetadata, {
			redirect_uris: ["http://localhost:4567/callback"],
			client_name: "my-client",
		});
		assert.ok(provider instanceof LangChainOAuthClientProvider);
	});
});
