# Proposal

## Why

The Poppy (Personal Agent Protocol) integration was built across issues 01-13 and is fully implemented in `src/tools/poppy/*` with corresponding OpenSpec specs under `openspec/specs/poppy-*`. However, there is currently no user-facing documentation for it. Users cannot discover how to configure or use the protocol without reading source code.

## What Changes

- Add `docs/POPPY.md` as the canonical Poppy reference, documenting all 11 `poppy` tool actions (`discover`, `identity`, `session`, `oauth`, `verify`, `api`, `conversation`, `browser`, `tasks`, `extensions`, `security`).
- Include configuration examples for the company's `poppy.json` document and the agent's client metadata document (CIMD).
- Include end-to-end usage examples for discovering a company, signing in via OAuth Direct Sign-In, and completing a task.
- Update `README.md` with a concise Poppy overview section linking to the protocol spec and `docs/POPPY.md`.
- Update `docs/README.md` document map to include `docs/POPPY.md`.

## Capabilities

### New Capabilities

None. This is a documentation-only change; no spec-level behavior changes.

### Modified Capabilities

None. No existing capability requirements change.

## Impact

- `docs/POPPY.md` (new) — canonical Poppy reference.
- `README.md` (modified) — add Poppy overview section.
- `docs/README.md` (modified) — add POPPY.md to the document map.

## Non-goals

- No runtime code changes to the Poppy integration.
- No changes to `src/tools/poppy/*` behavior.
- No new protocol capabilities or spec deltas.
