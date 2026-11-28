import { z } from "zod";

/**
 * Configuration for an OAuth2 client provider on an MCP server.
 *
 * This is a typed object (not `z.unknown()`) so the config loader's
 * `buildReverseMap`/`syncEnv` can recurse into it and materialize
 * `MCP_<SERVER>_AUTHPROVIDER_*` environment variables. It is passed through
 * to `@langchain/mcp-adapters` as the `authProvider` on `http`/`sse` servers.
 *
 * The fields configure the built-in OAuth client provider backed by
 * `@langchain/auth`. `provider`, `userId`, `apiKey`, and `apiUrl` configure
 * the LangChain Auth `Client`; `clientId`, `clientSecret`,
 * `authorizationServer`, `tokenEndpoint`, `scopes`, `usesPkce`, and
 * `codeChallengeMethod` describe the OAuth client.
 */
export const AuthProviderSchema = z
	.object({
		provider: z.string().optional(),
		userId: z.string().optional(),
		apiKey: z.string().optional(),
		apiUrl: z.string().url().optional(),
		clientId: z.string().optional(),
		clientSecret: z.string().optional(),
		authorizationServer: z.string().url().optional(),
		tokenEndpoint: z.string().url().optional(),
		scopes: z.array(z.string()).optional(),
		usesPkce: z.boolean().optional(),
		codeChallengeMethod: z.string().optional(),
	})
	.strict();

/**
 * A single MCP server connection, discriminated by `transport`.
 *
 * Mirrors `@langchain/mcp-adapters` v2's `Connection` schema:
 * - `stdio` — local process-spawned server (`command`, `args`, optional `env`)
 * - `http` — Streamable HTTP (the default for remote servers)
 * - `sse` — HTTP + SSE (backwards compatibility)
 *
 * The `http` and `sse` variants also accept optional `headers` (a flat
 * `string -> string` record) and `authProvider` (a typed OAuth2 provider
 * config passed through to the adapter) for OAuth2-protected remote servers.
 *
 * Each server also carries an optional `agents` list used to classify its
 * discovered tools for subagent assignment. When absent, tools default to the
 * orchestrator only.
 */
const McpServerSchema = z.discriminatedUnion("transport", [
	z
		.object({
			transport: z.literal("stdio"),
			command: z.string().min(1),
			args: z.array(z.string()).default([]),
			env: z.record(z.string(), z.string()).optional(),
			agents: z.array(z.string()).optional(),
		})
		.strict(),
	z
		.object({
			transport: z.literal("http"),
			url: z.string().url(),
			headers: z.record(z.string(), z.string()).optional(),
			authProvider: AuthProviderSchema.optional(),
			agents: z.array(z.string()).optional(),
		})
		.strict(),
	z
		.object({
			transport: z.literal("sse"),
			url: z.string().url(),
			headers: z.record(z.string(), z.string()).optional(),
			authProvider: AuthProviderSchema.optional(),
			agents: z.array(z.string()).optional(),
		})
		.strict(),
]);

/**
 * Configuration for Model Context Protocol (MCP) servers.
 *
 * A root-level `mcp` key is a record of named servers. Each server specifies a
 * transport and its connection parameters. At startup, madz connects to each
 * server, discovers its tools via `MCPAdapter.listTools()`, and registers them
 * alongside the built-in tools.
 */
export const McpSchema = z.record(z.string(), McpServerSchema).default({});
