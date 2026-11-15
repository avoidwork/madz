# Proposal

## Why

The harness has HTTP tools (`api`, `graphql`) but no native relational database access. For distributed-systems and architecture workflows, direct SQL querying is a genuine blind spot. The only current path is `process` plus a CLI client, which is fragile and bypasses sandbox validation.

## What Changes

- Add a new `sql` tool (`src/tools/sql/index.js`) supporting `postgres`, `sqlite`, and `mysql` drivers, using parameterized queries exclusively.
- Use a registry/plugin architecture: one module per driver under `src/tools/sql/drivers/`, a `DRIVERS` map, and a discriminated union on `driver`.
- Register the tool in `src/tools/index.js` (import, `TOOLS` map, `TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, and a `case "sql"` in `buildToolConfig()`).
- Add the `sql` config schema (`src/config/schemas/sql.js`) with empty safe defaults, register in `ConfigSchema`, and add `sql` to `DROPPED_KEYS` in `src/config/loader.js`.
- Add unit tests (`tests/unit/tools/sql.test.js`) and an integration test (`tests/integration/tools/sql.test.js`) against an in-memory SQLite database.
- Add dependencies: `pg`, `better-sqlite3`, `mysql2`.

## Capabilities

### New Capabilities
- `sql-tool`: Running parameterized SQL queries against Postgres, SQLite, and MySQL databases, with sandbox allowlist enforcement on SQLite file paths.

### Modified Capabilities
<!-- No existing capability changes. -->

## Impact

- **Code**: `src/tools/sql/index.js` (new), `src/tools/sql/drivers/*.js` (new), `src/tools/index.js` (registry wiring), `src/config/schemas/sql.js` (new), `src/config/config.js` (ConfigSchema registration), `src/config/loader.js` (DROPPED_KEYS).
- **Tests**: `tests/unit/tools/sql.test.js`, `tests/integration/tools/sql.test.js` (new).
- **Dependencies**: `pg`, `better-sqlite3`, `mysql2` added to `package.json`.
- **Security**: Parameterized queries (A03 Injection), no shell interpolation, allowlist on SQLite file paths.

## Non-goals

- Not merging with the NoSQL tool (issue #1811) — different query models, kept separate.
- Not shelling out via `process`.
- Not using a query builder (e.g., `knex`) — it hides driver-specific parameterization and result shaping.
