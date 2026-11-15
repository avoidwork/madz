# Proposal

## Why

The harness has HTTP tools (`api`, `graphql`) and a SQL tool, but no native NoSQL access. For distributed-systems and architecture workflows, direct access to document and key-value stores is a genuine blind spot. The only current path is `process` plus a CLI client, which is fragile and bypasses sandbox validation.

## What Changes

- Add a first-class `nosql` tool that queries MongoDB (document store) and Redis (key-value store) directly.
- Use a registry/plugin architecture for engine extensibility: each engine is a self-contained module under `src/tools/nosql/engines/`, and the core dispatch looks engines up in an `ENGINES` map rather than hardcoding branches.
- Add a `nosql` config section with empty safe defaults so the tool loads cleanly with zero configuration.
- Add `mongodb` and `ioredis` dependencies.
- Register the tool in `src/tools/index.js` with `network:outbound`, `filesystem:read`, and `filesystem:write` permissions.
- Add env-var naming convention support in `src/config/loader.js` so engine credentials resolve from `process.env` only.

## Capabilities

### New Capabilities
- `nosql-tool`: Provides direct query execution against non-relational stores (MongoDB, Redis) with a registry/plugin architecture for engine extensibility, Zod input validation, and sandbox-aware connection handling.

### Modified Capabilities
<!-- No existing capabilities have spec-level behavior changes. -->

## Impact

- **New files**: `src/tools/nosql/index.js`, `src/tools/nosql/engines/mongodb.js`, `src/tools/nosql/engines/redis.js`, `src/config/schemas/nosql.js`, `tests/unit/tools/nosql.test.js`, `tests/integration/tools/nosql.test.js`.
- **Modified files**: `src/tools/index.js` (register tool), `src/config/schemas/index.js` (export schema), `src/config/config.js` (add `nosql` section), `src/config/loader.js` (add `nosql` to `DROPPED_KEYS`), `package.json` (add `mongodb`, `ioredis`), `docs/CONFIGURATION.md` (document env vars).
- **Dependencies**: `mongodb` (v7.x), `ioredis` (v6.x).

## Non-goals

- Not merging with the SQL tool (issue #1803) — different query models, kept separate.
- Not shelling out via `process`.
