# Design: Core Architecture Spec

## Approach

This change adds a new spec (`app-architecture/spec.md`) that describes the application's entry point, boot sequence, subsystem wiring, and lifecycle — without modifying any code.

The spec is derived from the existing `index.js` entry point and the 28 existing subsystem specs. It serves as the top-level artifact in the OpenSpec hierarchy, referencing subsystem specs for detailed requirements.

## Structure

```
openspec/specs/app-architecture/spec.md    ← new
openspec/changes/core-architecture-spec/
  ├── proposal.md
  ├── specs/app-architecture/spec.md       ← new
  ├── design.md
  └── tasks.md
```

## Spec Organization

The spec is organized into 9 requirements, each with scenarios:

1. **Application Entry Point** — `index.js` as the single entry, CLI mode detection, exports
2. **Boot Sequence** — ordered initialization of 10 subsystems with dependency guarantees
3. **Subsystem Wiring** — how provider, agent, tools, session, and scheduler connect
4. **Provider Dispatch** — prompt assembly, agent invocation, result normalization
5. **Conversation Handler** — session restore, exchange recording, persistence
6. **Skill Invocation** — validation, permission resolution, execution context
7. **Shutdown Lifecycle** — session save, GC stop, telemetry flush, logger flush
8. **Configuration** — single source of truth, defaults, runtime mutation
9. **TUI Application** — Ink/React render, prop injection, exit handling
10. **Chat Mode Application** — single-message processing, JSON output, exit behavior

## Relationship to Existing Specs

This spec is a **parent** to the existing subsystem specs. It describes *how* they connect; each subsystem spec describes *what* that subsystem does in detail.

| This spec (app-architecture) | References |
|---|---|
| Boot sequence: crontab sync | `cron-scheduler/spec.md` |
| Boot sequence: onboarding | `session-management/spec.md` |
| Boot sequence: telemetry | `telemetry/spec.md` |
| Boot sequence: skill registry | `skills-registry/spec.md` |
| Boot sequence: memory loading | `memory-system/spec.md` |
| Boot sequence: GC manager | `memory-gc/spec.md` |
| Subsystem wiring: checkpointer | `checkpointer/spec.md` |
| Subsystem wiring: react agent | `react-agent/spec.md` |
| Provider dispatch | `react-agent/spec.md`, `tools-tier2/spec.md` |
| TUI application | `tui-interface/spec.md` |
| Chat mode | (implicit — no separate spec needed) |

## Implementation Strategy

This is a **spec-only** change. No code is modified. The tasks in `tasks.md` are intentionally left unchecked — they represent future work:

1. Create the spec artifact (this change)
2. Review and validate the spec against `index.js`
3. Link the spec into the OpenSpec index (if one exists)
4. Update AGENTS.md to reference this spec as the top-level architecture document

## Risk Assessment

- **Low risk** — no code changes, no behavior modifications
- **Potential gap** — the spec is a snapshot of the current `index.js`. If the entry point is refactored later, the spec should be updated to match
