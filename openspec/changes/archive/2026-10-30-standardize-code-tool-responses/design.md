# Design

## Context

See proposal.md - Why. The `code` tool's `searchCodeImpl` and `indexCodeImpl` currently return bare strings. This change standardizes them to return structured objects `{ ok: true, ... }` / `{ ok: false, error: ... }`. The existing specs `code-search` and `piscina-worker-indexing` define the behavior that is being modified.

## Goals / Non-Goals

**Goals:**
- Make `searchCodeImpl` and `indexCodeImpl` return structured objects on all paths.
- Preserve the existing search/index algorithms and result ranking.
- Update unit tests to assert the new shapes.

**Non-Goals:**
- No change to the `searchCode` / `indexCode` tool wrappers or their zod schemas.
- No change to the vector store, embedder, Piscina pool, or indexer worker internals.
- No change to the search/index algorithms or result ranking.

## Decisions

### Structured objects over bare strings
The current bare-string returns make success/failure indistinguishable and data unparseable. Structured objects `{ ok: true, ... }` / `{ ok: false, error: ... }` are the idiomatic choice. Alternatives considered: `JSON.stringify`-wrapped strings (rejected — still strings, not parseable) and keeping bare strings (rejected — not machine-parseable).

### `searchCodeImpl` success shape: `{ ok: true, results, count }`
On success, return `{ ok: true, results, count }` where `results` is an array of objects preserving the structured result fields (`filePath`, `lineStart`, `lineEnd`, `score`, `content`, `source`). The `count` field is `results.length`. This preserves the data that was previously flattened into a formatted string, while making it programmatically accessible.

### `searchCodeImpl` error shape: `{ ok: false, error }`
Every error path (unknown project, store open failure, FTS search failure, no matching code, no results matching filter, embed failure, no embedding generated, hybrid search failure, search failure) returns `{ ok: false, error }` with a descriptive message.

### `indexCodeImpl` success shape: `{ ok: true, results }`
On success, return `{ ok: true, results }` where `results` is an array of per-project objects `{ name, indexed, skipped, errors }`. This replaces the previous string pushes and `results.join("\n")`.

### `indexCodeImpl` per-project error handling
Per-project failures (project not found, pool worker crash) are represented as `{ name, error }` entries within the `results` array, so partial failures are still reported per project. The overall result remains `{ ok: true, results }` unless no projects are configured, in which case it returns `{ ok: false, error }`.

## Risks / Trade-offs

- **Consumers expecting strings** → This is a breaking change for any consumer that parsed the bare-string output. The tool wrappers (`searchCode`, `indexCode`) are unchanged and will pass the structured object through; downstream consumers must be updated to read `result.ok`, `result.results`, etc.
- **Test churn** → Existing tests assert on string content and must be rewritten to assert on structured fields. This is expected and covered by the test updates.
