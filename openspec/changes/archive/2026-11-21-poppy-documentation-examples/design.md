# Design

## Context

See proposal.md - Why. The Poppy integration is fully implemented in `src/tools/poppy/*` and specified under `openspec/specs/poppy-*`. This change adds user-facing documentation only; no runtime behavior changes. The `poppy` tool exposes 11 actions via a single `action` enum, each dispatching to a module in `src/tools/poppy/`.

## Goals / Non-Goals

**Goals:**
- Create a single canonical `docs/POPPY.md` reference covering all 11 Poppy actions.
- Provide configuration examples (`poppy.json` and the agent's client metadata document).
- Provide end-to-end usage examples.
- Surface a concise Poppy overview in `README.md` and register the doc in `docs/README.md`.

**Non-Goals:**
- No changes to `src/tools/poppy/*` behavior.
- No new protocol capabilities or spec deltas (`skip_specs: true`).
- No changes to the Poppy runtime or tool registration.

## Decisions

- **Single canonical document (`docs/POPPY.md`).** Rationale: the project keeps deep feature documentation in `docs/` (e.g., `FEATURES.md`, `CONFIGURATION.md`), and a dedicated Poppy doc keeps the integration discoverable and maintainable. Alternative considered: folding Poppy into `FEATURES.md` — rejected because the Poppy integration is large enough to warrant its own reference and the issue explicitly asks for a dedicated section.
- **Documentation is the deliverable; no code changes.** Rationale: the integration is already implemented and specified. Alternative considered: adding a Poppy entry to the built-in tools table in `FEATURES.md` — included as a cross-reference rather than a full rewrite to avoid duplication.
- **Each capability section references the protocol spec.** Rationale: the protocol spec at https://personalagentprotocol.org/docs/1.0/spec is the authoritative source; linking each capability to its section lets users cross-check. Alternative considered: duplicating spec text — rejected to avoid drift.
- **README gets a high-level overview only.** Rationale: the README is a landing page; deep detail lives in `docs/POPPY.md`. Alternative considered: full Poppy docs in README — rejected as too verbose.

## Risks / Trade-offs

- [Documentation may drift from source] → Cross-check each capability description against `src/tools/poppy/*` and `openspec/specs/poppy-*`; the code is the source of truth.
- [Protocol spec section numbers may be inaccurate] → Reference the canonical spec URL and verify section anchors; note the spec version (1.0).
- [Example documents may not match validation schemas] → Derive examples from the actual Zod schemas in `src/tools/poppy/*` and the spec requirements.

## Migration Plan

No runtime migration. The change is additive documentation; merge and publish normally.

## Open Questions

None.
