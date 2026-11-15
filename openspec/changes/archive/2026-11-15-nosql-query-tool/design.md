# Design

## Context

See proposal.md - Why. The harness has a SQL tool (`src/tools/sql/index.js`) built on a registry/plugin architecture with per-driver modules under `src/tools/sql/drivers/`. The NoSQL tool mirrors this pattern exactly, with engines under `src/tools/nosql/engines/`.

## Goals / Non-Goals

**Goals:**
- A `nosql` tool supporting MongoDB and Redis via a registry/plugin architecture.
- Engine-scoped operations with strict per-engine Zod validation.
- Lazy connection lifecycle with timeout discipline and close-on-shutdown.
- Config schema with empty safe defaults and env-var credential sourcing.

**Non-Goals:**
- Merging with the SQL tool (issue #1803) — different query models, kept separate.
- Shelling out via `process`.
- Supporting every NoSQL engine — only MongoDB and Redis in this change.

## Decisions

### Registry/plugin architecture for engines

The core `nosqlImpl` dispatches by looking up the engine in an `ENGINES` map keyed by engine name. Each engine module exports `name`, `connectionSchema`, `operationSchema`, and `execute(input, options)`. This mirrors `src/tools/sql/index.js` and its `DRIVERS` map.

**Alternatives considered:**
- Hardcoded `if (engine === "mongodb")` branches — rejected: not extensible, violates the amendment requirement.
- A single unified operation schema across engines — rejected: MongoDB and Redis have fundamentally different query models.

### Discriminated union on `engine`

The tool's input schema uses `z.discriminatedUnion("engine", [...])` so each engine carries its own connection and operation schema. Adding an engine requires only a new engine module, one `ENGINES` map entry, and one discriminated-union variant.

### Lazy connection lifecycle

Each engine module owns its client. The client is created lazily on first operation, reused for subsequent operations, and released via a `close()` method. The tool's `closeAll()` iterates the `ENGINES` map and calls `close()` on each engine that exposes it.

**Alternatives considered:**
- Connecting at module import — rejected: wastes resources when the tool is registered but never used.

### Driver selection

- **MongoDB**: official `mongodb` driver (v7.x). Uses `MongoClient` with `client.connect()`, `client.db()`, `db.collection()`.
- **Redis**: `ioredis` (v6.x). Uses `new Redis(options)` with `redis.on("error", ...)`.

**Alternatives considered:**
- `node-redis` for Redis — rejected in favor of `ioredis` per the issue's driver contract.

### Config schema with safe defaults

A `nosql` config section is added to `ConfigSchema` with empty safe defaults for every key, following `src/config/schemas/sql.js`. The section defaults to `{}` so an absent `nosql:` block is valid. Credentials default to `""` (not configured) and are sourced from `process.env` at load time.

### Env-var naming convention

The `nosql` key is added to both `DROPPED_KEYS` lists in `src/config/loader.js`. Since `nosql` is a dropped container key, the engine name is the first env-var segment: `MONGODB_HOST` → `nosql.mongodb.host`, `REDIS_PASSWORD` → `nosql.redis.credentials.password`.

## Risks / Trade-offs

- **In-memory integration tests are slow** → Keep integration tests focused on a small set of operations; use `mongodb-memory-server` and `ioredis-mock`.
- **Discriminated union strictness** → Each engine's operation schema must be strict; test that invalid operations are rejected.
- **Connection leaks** → Ensure `close()` is called on shutdown; test the close path.
- **Env-var collision** → `nosql` is a dropped key; verify `MONGODB_*` and `REDIS_*` env vars don't collide with other config sections.

## Migration Plan

No migration — this is a new tool. Deploy by merging the feature branch; the tool registers when `network:outbound`, `filesystem:read`, and `filesystem:write` permissions are enabled.

## Open Questions

None.
