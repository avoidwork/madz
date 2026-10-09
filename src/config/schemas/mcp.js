import { z } from "zod";

/**
 * A single MCP server connection, discriminated by `transport`.
 *
 * Mirrors `@langchain/mcp-adapters` v2's `Connection` schema:
 * - `stdio` — local process-spawned server (`command`, `args`, optional `env`)
 * - `http` — Streamable HTTP (the default for remote servers)
 * - `sse` — HTTP + SSE (backwards compatibility)
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
			agents: z.array(z.string()).optional(),
		})
		.strict(),
	z
		.object({
			transport: z.literal("sse"),
			url: z.string().url(),
			agents: z.array(z.string()).optional(),
		})
		.strict(),
]);

/**
 * Configuration for Model Context Protocol (MCP) servers.
 *
 * A root-level `mcp` key defines named servers. Each server specifies a
 * transport and its connection parameters. At startup, madz connects to each
 * server, discovers its tools via `MCPAdapter.listTools()`, and registers them
 * alongside the built-in tools.
 */
export const McpSchema = z
	.object({
		servers: z.record(z.string(), McpServerSchema).default({}),
	})
	.strict()
	.default({ servers: {} });
