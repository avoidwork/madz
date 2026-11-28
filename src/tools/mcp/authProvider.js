import { Client as LangChainAuthClient } from "@langchain/auth";

/**
 * Built-in OAuth client provider for MCP servers.
 *
 * Implements the `OAuthClientProvider` interface required by
 * `@langchain/mcp-adapters` (re-exported from `@modelcontextprotocol/sdk`) by
 * delegating token acquisition to the maintained `@langchain/auth` SDK. This
 * lets an OAuth2-protected remote MCP server be configured without hand-writing
 * a provider object in `config.yaml`.
 *
 * The provider is constructed from the typed `authProvider` config object
 * (see `src/config/schemas/mcp.js`). It uses `@langchain/auth`'s `Client` to
 * initiate the OAuth flow and poll for the resulting token.
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
	 */
	constructor(options = {}) {
		this.options = options;
		this._client = undefined;
		this._tokens = undefined;
		this._clientInformation = undefined;
		this._codeVerifier = undefined;
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
	 * The URL to redirect the user agent to after authorization.
	 *
	 * This provider uses the LangChain Auth hosted flow, which returns an
	 * authorization URL for the user to complete out-of-band, so no local
	 * redirect URL is required.
	 * @returns {undefined}
	 */
	get redirectUrl() {
		return undefined;
	}

	/**
	 * Metadata about this OAuth client.
	 * @returns {object} OAuth client metadata.
	 */
	get clientMetadata() {
		const scopes = this.options.scopes?.join(" ") || undefined;
		return {
			redirect_uris: [],
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
	 * Invoked to redirect the user agent to the given URL to begin the
	 * authorization flow.
	 *
	 * This provider uses the LangChain Auth hosted flow: it initiates the
	 * authentication via `@langchain/auth`'s `Client` and polls for the token.
	 * @param {URL} authorizationUrl - The authorization URL.
	 */
	async redirectToAuthorization(_authorizationUrl) {
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
}

/**
 * Construct a built-in OAuth client provider from a typed `authProvider`
 * config object.
 *
 * @param {object} config - The `authProvider` config object from an MCP server.
 * @returns {LangChainOAuthClientProvider} A configured provider instance.
 */
export function createAuthProvider(config) {
	return new LangChainOAuthClientProvider(config);
}
