import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as discovery from "./discovery.js";
import * as identity from "./identity.js";
import * as session from "./session.js";
import * as oauth from "./oauth.js";
import * as verify from "./verify.js";
import * as api from "./api.js";
import * as conversation from "./conversation.js";
import * as browser from "./browser.js";

/**
 * Registry of Poppy actions, keyed by action name. Each action module exports
 * an `execute` function that the dispatcher routes to, mirroring the sql/nosql
 * driver/engine pattern.
 */
export const ACTIONS = {
	discover: discovery,
	identity,
	session,
	oauth,
	verify,
	api,
	conversation,
	browser,
};

/**
 * Zod schema for the `poppy` tool input.
 *
 * A single flat object with an `action` enum so the serialized JSON schema is
 * a plain object rather than a top-level `oneOf`. Per-action field validity is
 * enforced in `superRefine` against the action's own requirements, mirroring
 * the `image` tool. Each action module exports a handler that the dispatcher
 * routes to.
 */
export const poppySchema = z
	.object({
		action: z
			.enum([
				"discover",
				"identity",
				"session",
				"oauth",
				"verify",
				"api",
				"conversation",
				"browser",
			])
			.describe("The Poppy operation to perform"),
		// discover
		domain: z.string().optional().describe("The company domain to discover (e.g. example.com)"),
		// identity
		op: z.string().optional().describe("The identity operation to perform"),
		clientId: z.string().optional().describe("The agent's client_id URL"),
		clientName: z.string().optional().describe("The agent's display name"),
		jwksUri: z.string().optional().describe("The public JWKS URL"),
		redirectUris: z.array(z.string()).optional().describe("Valid redirect URIs"),
		logoUri: z.string().optional().describe("Optional logo URL"),
		alg: z.string().optional().describe("The signing algorithm (ES256 or PS384)"),
		keyId: z.string().optional().describe("Identifier for a persisted key"),
		audience: z.string().optional().describe("The company's issuer (audience)"),
		uri: z.string().optional().describe("A redirect URI to validate"),
		doc: z.record(z.unknown()).optional().describe("A client metadata document to validate"),
		// session
		userId: z.string().optional().describe("The user ID (subject)"),
		method: z.string().optional().describe("The HTTP method (htm)"),
		url: z.string().optional().describe("The request URL (htu)"),
		agentId: z.string().optional().describe("Optional agent ID"),
		accessToken: z.string().optional().describe("Optional access token for the ath claim"),
		delegation: z.string().optional().describe("The delegation JWT (for the poppy_dlg header)"),
		// oauth
		issuer: z.string().optional().describe("The company's OAuth issuer URL"),
		redirectUri: z.string().optional().describe("The redirect URI for Direct Sign-In"),
		scope: z.string().optional().describe("The requested OAuth scope"),
		state: z.string().optional().describe("The CSRF state for Direct Sign-In"),
		code: z.string().optional().describe("The authorization code for Direct Sign-In exchange"),
		codeVerifier: z.string().optional().describe("The PKCE code verifier"),
		crossDevice: z
			.boolean()
			.optional()
			.describe("Whether to enforce prompt=consent for cross-device Direct Sign-In"),
		refreshToken: z.string().optional().describe("The refresh token to rotate"),
		token: z.string().optional().describe("The token to revoke"),
		tokenTypeHint: z.string().optional().describe("The token type hint for revocation"),
		poll: z.boolean().optional().describe("Whether to poll the device flow for tokens"),
		// verify
		session: z.string().optional().describe("The Poppy-Session JWT to verify"),
		// api
		task: z.string().optional().describe("The task to match against an API"),
		apiType: z.string().optional().describe("The API type (openapi or mcp)"),
		endpoint: z.string().optional().describe("The API endpoint URL"),
		path: z.string().optional().describe("The request path for an OpenAPI call"),
		body: z.unknown().optional().describe("The request body"),
		version: z.string().optional().describe("The Poppy protocol version"),
		extensions: z.record(z.string(), z.array(z.unknown())).optional().describe("Poppy extensions"),
		grantedScopes: z.string().optional().describe("The granted scopes"),
		idempotencyKey: z.string().optional().describe("The idempotency key for safe retries"),
		poppyJson: z.unknown().optional().describe("The parsed poppy.json document"),
		tokenEndpoint: z.string().optional().describe("The token endpoint for MCP token requests"),
		// conversation
		id: z.string().optional().describe("The conversation ID"),
		message: z.unknown().optional().describe("The message body"),
		requestId: z.string().optional().describe("The request ID for safe retries"),
		wait: z.number().optional().describe("The wait query parameter"),
		cursor: z.string().optional().describe("The cursor query parameter"),
		parentConversationId: z
			.string()
			.optional()
			.describe("The parent conversation ID for a direct conversation"),
		userRequestedEventId: z
			.string()
			.optional()
			.describe("The user-requested event ID for a direct conversation"),
		// browser
		disabled: z.boolean().optional().describe("Whether web browsing is disabled"),
		unscoped: z.boolean().optional().describe("Whether the web channel is unscoped"),
	})
	.superRefine((data, ctx) => {
		const { action } = data;
		const rejectField = (field, allowedActions) => {
			if (data[field] !== undefined && !allowedActions.includes(action)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: [field],
					message: `'${field}' is only valid for the '${allowedActions.join("' or '")}' action`,
				});
			}
		};
		// discover-only fields
		rejectField("domain", ["discover"]);
		// identity/session/oauth/verify/api fields
		rejectField("op", ["identity", "session", "oauth", "api", "conversation", "browser"]);
		rejectField("clientId", ["identity", "oauth"]);
		rejectField("clientName", ["identity"]);
		rejectField("jwksUri", ["identity"]);
		rejectField("redirectUris", ["identity"]);
		rejectField("logoUri", ["identity"]);
		rejectField("alg", ["identity"]);
		rejectField("keyId", ["identity"]);
		rejectField("audience", ["identity", "verify"]);
		rejectField("uri", ["identity"]);
		rejectField("doc", ["identity"]);
		// session/verify fields
		rejectField("userId", ["session"]);
		rejectField("method", ["session", "verify", "api"]);
		rejectField("url", ["session", "verify"]);
		rejectField("agentId", ["session"]);
		rejectField("accessToken", ["session", "verify", "conversation", "browser"]);
		rejectField("delegation", ["session"]);
		// oauth-only fields
		rejectField("issuer", ["oauth"]);
		rejectField("redirectUri", ["oauth"]);
		rejectField("scope", ["oauth", "api", "browser"]);
		rejectField("state", ["oauth"]);
		rejectField("code", ["oauth"]);
		rejectField("codeVerifier", ["oauth"]);
		rejectField("crossDevice", ["oauth"]);
		rejectField("refreshToken", ["oauth"]);
		rejectField("token", ["oauth"]);
		rejectField("tokenTypeHint", ["oauth"]);
		rejectField("poll", ["oauth"]);
		// verify/conversation fields
		rejectField("session", ["verify", "conversation", "browser"]);
		// api-only fields
		rejectField("task", ["api"]);
		rejectField("apiType", ["api"]);
		rejectField("endpoint", ["api", "conversation", "browser"]);
		rejectField("path", ["api"]);
		rejectField("body", ["api"]);
		rejectField("version", ["api"]);
		rejectField("extensions", ["api"]);
		rejectField("grantedScopes", ["api"]);
		rejectField("idempotencyKey", ["api"]);
		rejectField("poppyJson", ["api"]);
		rejectField("tokenEndpoint", ["api"]);
		// conversation-only fields
		rejectField("id", ["conversation"]);
		rejectField("message", ["conversation"]);
		rejectField("requestId", ["conversation"]);
		rejectField("wait", ["conversation"]);
		rejectField("cursor", ["conversation"]);
		rejectField("parentConversationId", ["conversation"]);
		rejectField("userRequestedEventId", ["conversation"]);
		// browser-only fields
		rejectField("disabled", ["browser"]);
		rejectField("unscoped", ["browser"]);

		if (action === "discover") {
			if (!data.domain) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["domain"],
					message: "domain is required for the 'discover' action",
				});
			}
		} else if (action === "identity") {
			if (!data.op) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["op"],
					message: "op is required for the 'identity' action",
				});
			}
		} else if (action === "session") {
			if (!data.op) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["op"],
					message: "op is required for the 'session' action",
				});
			}
		} else if (action === "oauth") {
			if (!data.op) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["op"],
					message: "op is required for the 'oauth' action",
				});
			}
		} else if (action === "verify") {
			if (!data.session) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["session"],
					message: "session is required for the 'verify' action",
				});
			}
		} else if (action === "api") {
			if (!data.op) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["op"],
					message: "op is required for the 'api' action",
				});
			}
		} else if (action === "conversation") {
			if (!data.op) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["op"],
					message: "op is required for the 'conversation' action",
				});
			}
		} else if (action === "browser") {
			if (!data.op) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["op"],
					message: "op is required for the 'browser' action",
				});
			}
		}
	});

/**
 * Dispatch the `poppy` tool on its `action` field.
 * @param {z.infer<typeof poppySchema>} input - Tool input
 * @param {object} [options] - Runtime options
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
export async function poppyImpl(input, options = {}) {
	const actionModule = ACTIONS[input.action];
	if (!actionModule) {
		return { ok: false, error: `Unknown poppy action: ${input.action}` };
	}
	return actionModule.execute(input, options);
}

/**
 * Poppy (Personal Agent Protocol) tool. Dispatches on an `action` enum:
 * `discover` (fetch and validate a company's poppy.json at
 * https://{domain}/.well-known/poppy.json) and `identity` (manage the agent's
 * client metadata document and signing keys). Requires `network:outbound`.
 */
export const poppy = tool(poppyImpl, {
	name: "poppy",
	description:
		"Poppy (Personal Agent Protocol) tool. Dispatches on an `action` enum: `discover` fetches and validates a company's poppy.json; `identity` manages the agent's client metadata document and signing keys; `session` generates Poppy-Session JWTs and issues delegations; `oauth` performs Direct Sign-In (authorization code + PKCE) and Device Sign-In (device authorization grant), refresh token rotation, revocation, and DPoP; `verify` verifies incoming Poppy-Session JWTs, delegations, and access tokens on company-side endpoints; `browser` joins a company's browser session via the browser-session endpoint. Requires network:outbound.",
	schema: poppySchema,
});
