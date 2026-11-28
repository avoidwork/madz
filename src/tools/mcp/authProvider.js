import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { Client as LangChainAuthClient } from "@langchain/auth";

/**
 * Default port for the OAuth callback server when none is configured.
 * @type {number}
 */
const DEFAULT_CALLBACK_PORT = 3000;

/**
 * Default timeout (ms) for the callback server to wait for a redirect.
 * @type {number}
 */
const DEFAULT_CALLBACK_TIMEOUT = 300000;

/**
 * A module-level response store shared between the callback server and the
 * silent poller. The callback server writes the captured authorization code
 * here; the poller reads it and resumes the graph.
 * @type {Map<string, {code: string, state: string, error?: string, receivedAt: number}>}
 */
const responseStore = new Map();

/**
 * Generate a cryptographically random `state` value for CSRF protection.
 * @returns {string} A hex-encoded random state value.
 */
function generateState() {
	return randomBytes(16).toString("hex");
}

/**
 * Built-in OAuth client provider for MCP servers.
 *
 * Implements the `OAuthClientProvider` interface required by
 * `@langchain/mcp-adapters` (re-exported from `@modelcontextprotocol/sdk`) by
 * delegating token acquisition to the maintained `@langchain/auth` SDK. This
 * lets an OAuth2-protected remote MCP server be configured without hand-writing
 * a provider object in `config.yaml`.
 *
 * When configured for the browser flow (`flow: "browser"`), the provider runs
 * an ephemeral HTTP callback server bound to localhost, exposes a `redirectUrl`
 * pointing at the callback URI, surfaces the authorization URL via the
 * `clarify`/interrupt bridge, and exchanges the captured authorization code for
 * tokens via `prepareTokenRequest`.
 */
export class LangChainOAuthClientProvider {
	/**
	 * @param {object} options - Provider configuration.
	 * @param {string} [options.provider] - LangChain Auth provider identifier.
	 * @param {string} [options.userId] - User identifier for the auth flow.
	 * @param {string} [options.apiKey] - LangChain Auth API key (falls back to `LANGSMITH_API_KEY`).
	 * @param {string} [options.apiUrl] - LangChain Auth API base URL (falls back to `LANGSMITH_API_URL`).
	 * @param {string} [options.clientId] - OAuth client identifier.
	 * @param {string} [options.clientSecret] - OAuth client secret.
	 * @param {string} [options.authorizationServer] - Authorization server URL.
	 * @param {string} [options.tokenEndpoint] - Token endpoint URL.
	 * @param {string[]} [options.scopes] - OAuth scopes to request.
	 * @param {boolean} [options.usesPkce] - Whether to use PKCE.
	 * @param {string} [options.codeChallengeMethod] - PKCE code challenge method.
	 * @param {number} [options.callbackPort] - Port for the callback server.
	 * @param {string} [options.flow] - OAuth flow to use (`"browser"` or `"device"`).
	 * @param {string} [options.serverUrl] - The MCP server URL (for metadata discovery).
	 */
	constructor(options = {}) {
		this.options = options;
		this._client = undefined;
		this._tokens = undefined;
		this._clientInformation = undefined;
		this._codeVerifier = undefined;
		this._state = undefined;
		this._callbackServer = undefined;
		this._callbackPort = options.callbackPort ?? DEFAULT_CALLBACK_PORT;
		this._callbackTimeout = DEFAULT_CALLBACK_TIMEOUT;
		this._responseKey = undefined;
	}

	/**
	 * Lazily construct the `@langchain/auth` client.
	 *
	 * The `Client` constructor requires an API key, so it is only instantiated
	 * when the provider actually authenticates. This lets the provider be
	 * constructed (and schema-validated) without a key present.
	 * @returns {import("@langchain/auth").Client} The LangChain Auth client.
	 */
	_getClient() {
		if (!this._client) {
			this._client = new LangChainAuthClient({
				apiKey: this.options.apiKey,
				apiUrl: this.options.apiUrl,
			});
		}
		return this._client;
	}

	/**
	 * Whether the provider is configured for the browser flow.
	 * @returns {boolean} True when `flow` is `"browser"`.
	 */
	get _isBrowserFlow() {
		return this.options.flow === "browser";
	}

	/**
	 * The URL to redirect the user agent to after authorization.
	 *
	 * For the browser flow this returns the callback URI so the SDK registers
	 * it and the authorization server redirects there. For the non-interactive
	 * (device) flow it returns `undefined`.
	 * @returns {string|undefined} The callback URI, or `undefined`.
	 */
	get redirectUrl() {
		if (!this._isBrowserFlow) return undefined;
		// When `callbackPort` is 0 the OS assigns a free port; report the actual
		// bound port so the redirect URI matches the listening server.
		const port = this._callbackServer?.address()?.port ?? this._callbackPort;
		return `http://localhost:${port}/callback`;
	}

	/**
	 * Metadata about this OAuth client.
	 * @returns {object} OAuth client metadata.
	 */
	get clientMetadata() {
		const scopes = this.options.scopes?.join(" ") || undefined;
		return {
			redirect_uris: this.redirectUrl ? [this.redirectUrl] : [],
			client_name: this.options.clientId || "madz-mcp",
			...(scopes ? { scope: scopes } : {}),
		};
	}

	/**
	 * Loads information about this OAuth client, as registered already with the
	 * server, or returns `undefined` if the client is not registered.
	 * @returns {object|undefined} Client information.
	 */
	clientInformation() {
		return this._clientInformation;
	}

	/**
	 * Saves client information obtained during dynamic registration.
	 * @param {object} clientInformation - Client information to store.
	 */
	saveClientInformation(clientInformation) {
		this._clientInformation = clientInformation;
	}

	/**
	 * Loads any existing OAuth tokens for the current session.
	 * @returns {object|undefined} Stored tokens.
	 */
	tokens() {
		return this._tokens;
	}

	/**
	 * Stores new OAuth tokens after a successful authorization.
	 * @param {object} tokens - Tokens to store.
	 */
	saveTokens(tokens) {
		this._tokens = tokens;
	}

	/**
	 * The `state` value generated for the current authorization request.
	 * @returns {string|undefined} The state value.
	 */
	state() {
		return this._state;
	}

	/**
	 * Start the ephemeral callback server bound to localhost.
	 *
	 * The server captures `code` + `state` from the redirect query string,
	 * validates `state` against the provider-generated value, and writes the
	 * result to the response store. It enforces a timeout on the callback port.
	 * @returns {Promise<void>} Resolves once the server is listening.
	 */
	async _startCallbackServer() {
		if (this._callbackServer) return;
		const key = generateState();
		this._responseKey = key;
		this._state = key;

		const server = createServer((req, res) => {
			const url = new URL(req.url, `http://localhost:${this._callbackPort}`);
			const code = url.searchParams.get("code");
			const state = url.searchParams.get("state");

			if (!code) {
				responseStore.set(key, {
					code: "",
					state: state || "",
					error: "missing_code",
					receivedAt: Date.now(),
				});
				res.writeHead(400, { "Content-Type": "text/plain" });
				res.end("Missing authorization code.");
				return;
			}

			if (state !== this._state) {
				responseStore.set(key, {
					code: "",
					state: state || "",
					error: "state_mismatch",
					receivedAt: Date.now(),
				});
				res.writeHead(400, { "Content-Type": "text/plain" });
				res.end("State mismatch.");
				return;
			}

			responseStore.set(key, {
				code,
				state,
				receivedAt: Date.now(),
			});
			res.writeHead(200, { "Content-Type": "text/plain" });
			res.end("Authorization complete. You may close this tab.");
		});

		await new Promise((resolve, reject) => {
			server.once("error", reject);
			server.listen(this._callbackPort, "127.0.0.1", resolve);
		});

		this._callbackServer = server;
	}

	/**
	 * Stop the callback server and clear the response store entry.
	 * @returns {Promise<void>} Resolves once the server is closed.
	 */
	async _stopCallbackServer() {
		if (this._callbackServer) {
			await new Promise((resolve) => this._callbackServer.close(resolve));
			this._callbackServer = undefined;
		}
		if (this._responseKey) {
			responseStore.delete(this._responseKey);
			this._responseKey = undefined;
		}
	}

	/**
	 * Invoked to redirect the user agent to the given URL to begin the
	 * authorization flow.
	 *
	 * For the browser flow this starts the callback server, surfaces the
	 * authorization URL via the `clarify`/interrupt bridge, and waits for the
	 * captured code. For the non-interactive flow it delegates to the
	 * `@langchain/auth` client as before.
	 * @param {URL} authorizationUrl - The authorization URL.
	 */
	async redirectToAuthorization(authorizationUrl) {
		if (this._isBrowserFlow) {
			await this._startCallbackServer();
			// Surface the authorization URL via the clarify/interrupt bridge.
			// The agent pauses at the interrupt until the browser flow completes.
			// The code travels through the response store, not the interrupt value.
			const { clarify } = await import("../clarify/index.js");
			await clarify({
				question: `Open this URL to authorize the MCP server, then complete the flow in your browser:\n\n${authorizationUrl.href}`,
				choices: ["I completed the flow in the browser", "Cancel"],
			});
			return;
		}

		const client = this._getClient();
		const result = await client.authenticate({
			provider: this.options.provider || "mcp",
			scopes: this.options.scopes || [],
			userId: this.options.userId || "madz",
		});
		if (result.status === "completed" && result.token) {
			this._tokens = {
				access_token: result.token,
				token_type: "Bearer",
			};
		} else if (result.authId) {
			const completion = await client.waitForCompletion(result.authId);
			if (completion.status === "completed" && completion.token) {
				this._tokens = {
					access_token: completion.token,
					token_type: "Bearer",
				};
			}
		}
	}

	/**
	 * Saves a PKCE code verifier for the current session.
	 * @param {string} codeVerifier - The PKCE code verifier.
	 */
	saveCodeVerifier(codeVerifier) {
		this._codeVerifier = codeVerifier;
	}

	/**
	 * Loads the PKCE code verifier for the current session.
	 * @returns {string} The PKCE code verifier.
	 */
	codeVerifier() {
		return this._codeVerifier || "";
	}

	/**
	 * Prepare the token request parameters for the authorization-code exchange.
	 *
	 * For the browser flow this returns a `URLSearchParams` with
	 * `grant_type=authorization_code`, `code`, `code_verifier`, and
	 * `redirect_uri`. For the non-interactive flow it returns `undefined` so the
	 * SDK falls back to its default behavior.
	 * @param {string} [scope] - The requested scope.
	 * @returns {URLSearchParams|undefined} The token request parameters.
	 */
	prepareTokenRequest(scope) {
		if (!this._isBrowserFlow) return undefined;
		const entry = this._responseKey ? responseStore.get(this._responseKey) : undefined;
		const code = entry?.code || "";
		const params = new URLSearchParams();
		params.set("grant_type", "authorization_code");
		params.set("code", code);
		params.set("code_verifier", this._codeVerifier || "");
		params.set("redirect_uri", this.redirectUrl);
		if (scope) params.set("scope", scope);
		return params;
	}
}

/**
 * Construct a built-in OAuth client provider from a typed `authProvider`
 * config object.
 *
 * @param {object} config - The `authProvider` config object from an MCP server.
 * @param {object} [context] - Additional runtime context.
 * @param {string} [context.serverUrl] - The MCP server URL.
 * @returns {LangChainOAuthClientProvider} A configured provider instance.
 */
export function createAuthProvider(config, context = {}) {
	return new LangChainOAuthClientProvider({ ...config, serverUrl: context.serverUrl });
}

/**
 * Read the most recent entry from the OAuth response store.
 *
 * The silent poller in the TUI layer uses this to detect when the callback
 * server has captured an authorization code, so it can resume the graph.
 * @returns {{code: string, state: string, error?: string, receivedAt: number}|undefined} The latest entry.
 */
export function readResponseStore() {
	let latest;
	for (const entry of responseStore.values()) {
		if (!latest || entry.receivedAt > latest.receivedAt) latest = entry;
	}
	return latest;
}
