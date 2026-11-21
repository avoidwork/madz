# Design

## Context

See proposal.md - Why. The Poppy integration exists in `src/tools/poppy/` with modules for discovery, identity, session, oauth, verify, api, conversation, browser, tasks, extensions, and security. The `poppy` tool is registered in `src/tools/index.js` and requires `network:outbound`. The tool dispatches on an `action` enum with per-action field requirements enforced by `poppySchema` in `src/tools/poppy/index.js`. This change adds user-facing documentation only.

## Goals / Non-Goals

**Goals:**

- Produce a single, authoritative Poppy documentation page under `docs/` that covers every action the tool supports.
- Provide copy-adaptable configuration examples for `poppy.json` and the agent's client metadata document.
- Provide end-to-end usage examples for discovery, sign-in, and task completion.
- Surface Poppy in the README and the docs document map so users can find it.

**Non-Goals:**

- No changes to `src/tools/poppy/*` implementation.
- No new Poppy actions or protocol features.
- No changes to tool registration or permissions.

## Decisions

- **Single docs page (`docs/POPPY.md`) rather than scattering across existing pages.** The Poppy integration is a cohesive feature; one page keeps it discoverable and maintainable. Alternatives considered: appending to `docs/FEATURES.md` (would bloat an already-large reference) or creating multiple pages (fragmented). Chosen: one dedicated page, linked from the README and the docs document map.
- **Document every action the tool actually supports.** The page mirrors the `action` enum in `poppySchema` (discover, identity, session, oauth, verify, api, conversation, browser, tasks, extensions, security) so the docs never drift from the implementation. Each section documents the action's purpose, required fields, and a protocol spec reference.
- **README links to the docs page rather than duplicating content.** The README gets a concise Poppy overview and a link to `docs/POPPY.md` and the protocol spec, keeping the README scannable.
- **Use the canonical protocol spec URL** (https://personalagentprotocol.org/docs/1.0/spec) for references. Section anchors are referenced descriptively rather than as deep links that may break.

## Risks / Trade-offs

- [Docs drift from implementation] → The page is derived from the actual `poppySchema` and action modules; any future action change should update the page. The docs/README.md convention ("code is the source of truth") applies.
- [Protocol spec section anchors may change] → Reference the spec URL and describe sections by name rather than deep-linking to fragile anchors.
- [Documentation-only change has no automated coverage] → This is expected; the change is verified by review and by the docs conventions in docs/README.md.
