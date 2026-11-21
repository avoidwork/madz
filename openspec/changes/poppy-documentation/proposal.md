# Proposal

## Why

The Poppy (Personal Agent Protocol) integration was built across issues 01-13 but has no user-facing documentation. Users cannot discover how to configure or use the protocol, which blocks adoption of a significant new capability.

## What Changes

- Add a dedicated Poppy documentation page (`docs/POPPY.md`) covering discovery, identity, sessions, OAuth, APIs, conversations, browser join, task coverage, extensions, and security.
- Add configuration examples for the `poppy.json` document and the agent's client metadata document.
- Add usage examples showing how to discover a company, sign in, and complete a task.
- Update the README with a Poppy overview and a link to the protocol spec.
- Add references to the protocol spec sections for each capability.
- Update `docs/README.md` document map to include the new page.

## Capabilities

### New Capabilities

None. This is a documentation-only change; no spec-level behavior changes.

### Modified Capabilities

None. This change does not alter any system behavior, so no spec deltas are required.

## Non-goals

- No changes to the `src/tools/poppy/*` implementation.
- No new Poppy actions or protocol features.
- No changes to tool registration or permissions.

## Impact

- `docs/POPPY.md` (new)
- `README.md`
- `docs/README.md`
- Protocol reference: https://personalagentprotocol.org/docs/1.0/spec
