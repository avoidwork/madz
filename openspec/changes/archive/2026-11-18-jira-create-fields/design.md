# Design

## Context

The `jira` tool's `create` action builds its request body in `buildRequest()` (`src/tools/jira/index.js`), currently emitting only `project`, `summary`, `issuetype`, `description`, and `assignee`. The input schema (`JiraInputSchema`) is strict, so any additional field the model passes is rejected outright. This forces the model to fall back to `curl` for issues that need components, labels, priority, or an epic link. See proposal.md - Why.

## Goals / Non-Goals

**Goals:**

- Let the `create` action set components, labels, and priority via typed inputs.
- Let the `create` action set any Jira field (including the epic link custom field) via a generic `fields` record.
- Keep the existing strict-schema guarantee that credentials and the base URL cannot be supplied by the model.
- Preserve the current behavior for all existing inputs.

**Non-Goals:**

- No new `jira` config keys; the epic link is set via a generic field, not a named config option.
- No changes to `update`, `transition`, or other actions.
- No Jira Cloud support (this targets Data Center REST API v2).

## Decisions

### Typed inputs plus a generic `fields` record

Add `components` (array of strings), `labels` (array of strings), and `priority` (string) to `JiraInputSchema`, plus a generic `fields` record (`z.record(z.string(), z.unknown())`) for arbitrary fields.

**Rationale:** The three named fields are common enough to warrant first-class, discoverable inputs the model can use without knowing Jira's internal field shapes. The generic record covers everything else — including the epic link, whose custom-field ID varies per instance and is discovered via the existing `fields` action. This matches the user's chosen approach.

**Alternatives considered:** A generic `fields` record only (simpler, but the model must know Jira's field shapes for common fields); a configurable epic-link custom-field ID (adds config surface for a value that's already discoverable at runtime).

### Typed inputs take precedence on collision

When both a typed input and the same field in `fields` are present, the typed input wins.

**Rationale:** Typed inputs are explicit and unambiguous; silently letting the generic record override them would be surprising. Precedence is deterministic and documented in the spec.

### Field shape mapping

- `components` → `fields.components = [{ name }]` (array of objects).
- `labels` → `fields.labels = [string]` (array of strings).
- `priority` → `fields.priority = { name }`.
- `fields` → merged directly into `fields`, after the typed inputs so typed inputs win.

**Rationale:** These are the shapes Jira Data Center REST API v2 expects for create.

## Risks / Trade-offs

- [The generic `fields` record lets the model set any field, including ones that could be destructive if misused] → This is inherent to Jira's create API; the model already has `update` with the same freedom. No new risk surface beyond what exists.
- [Typed inputs and the generic record could collide] → Resolved by deterministic precedence (typed wins), documented in the spec and covered by a test.
- [The epic link field ID is instance-specific] → The model discovers it via the existing `fields` action; no config needed.

## Migration Plan

No migration. This is purely additive to the `create` action; existing calls are unaffected.

## Open Questions

None.
