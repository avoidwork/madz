# Design

## Context

See proposal.md - Why. The harness has no native relational database access. The new `sql` tool follows the established tool convention in `src/tools/git/index.js`, `src/tools/archive/index.js`, and `src/tools/diagram/index.js`: the export is the tool name itself (`export const sql = tool(...)`), with `sqlImpl` as the implementation.

## Goals / Non-Goals

**Goals:**
- Run parameterized SQL queries against Postgres, SQLite, and MySQL.
- Use a registry/plugin architecture for driver extensibility.
- Enforce the sandbox allowlist on SQLite file paths via `validatePath()`.
- Validate all input via a Zod schema.
- Register the tool in `src/tools/index.js` with correct permissions and classifications.

**Non-Goals:**
- Not merging with the NoSQL tool (issue #1811) — different query models, kept separate.
- Not shelling out via `process`.
- Not using a query builder (e.g., `knex`).

## Decisions

### Decision 1: Tool export convention
Follow the `git`/`archive`/`diagram` convention exactly: `export const sql = tool((input, options = {}) => sqlImpl(input, options), { name: "sql", description, schema })`. Do **not** use a `createSqlTool()` factory.

### Decision 2: Registry/plugin architecture
One module per driver under `src/tools/sql/drivers/<driver>.js`. Each driver module exports `name`, `connectionSchema` (a Zod fragment), and `execute(input, options)`. `src/tools/sql/index.js` holds a `DRIVERS` map keyed by driver name. The core `sqlImpl` dispatches by looking up the driver in `DRIVERS` — it does NOT hardcode driver branches. The tool's input schema uses a discriminated union on `driver`.

### Decision 3: Drivers
- **Postgres** (`pg` v8.x+): `new Pool({ host, port, user, password, database })`, `pool.query(sql, params)` with `$1` placeholders, returns `{ rows, rowCount, fields }`.
- **SQLite** (`better-sqlite3` v13.x+): `new Database(filePath)` (synchronous), `db.prepare(sql)`, `stmt.run/get/all(params)` with `?` placeholders, returns `{ changes, lastInsertRowid }` / row objects.
- **MySQL** (`mysql2` v3.x+): `mysql2/promise`, `connection.execute(sql, params)` with `?` placeholders, returns `[rows, fields]` / `ResultSetHeader`.

Alternatives considered: `knex` (rejected — query builder hides driver-specific parameterization and result shaping).

### Decision 4: Config schema
Add `src/config/schemas/sql.js` with empty safe defaults (host, port, user, password, database, file). Register `sql: SqlConfigSchema.default({})` in `ConfigSchema`. Add `sql` to both `DROPPED_KEYS` lists in `src/config/loader.js` so env vars like `POSTGRES_HOST` map to `sql.postgres.host`.

### Decision 5: Registry wiring
Add `sql` to `src/tools/index.js`:
- Import from `./sql/index.js`
- `TOOL_PERMISSIONS`: `sql: ["network:outbound", "filesystem:read", "filesystem:write"]`
- `TOOL_CLASSIFICATIONS`: `sql: ["search", "research", "coding", "documentation", "debug"]`
- `TOOLS` map
- `case "sql"` in `buildToolConfig()`

## Risks / Trade-offs

- [SQL injection] → Parameterized queries exclusively; never string-concatenate user input.
- [Connection failures] → Return a structured error with a `kind`; timeout discipline per AGENTS.md §3.4.
- [SQLite file access] → Validate file path via `validatePath()`; support `:memory:`.
- [Driver extensibility] → Registry/plugin architecture keeps the core dispatch driver-agnostic.
