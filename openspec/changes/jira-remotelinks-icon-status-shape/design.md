# Design

## Context

See proposal.md - Why. The `jira` tool's `remoteLinks` action sends `icon` and
`status` as plain strings, but the Jira Data Center REST API v2 remote-link schema
defines both as objects. The fix is confined to `src/tools/jira/index.js` and its
tests.

## Goals / Non-Goals

**Goals:**
- Type `icon` and `status` in the `link` sub-object as objects matching the Jira DC
  API v2 remote-link schema.
- Preserve the core create/list remote-link flow (url + title) unchanged.

**Non-Goals:**
- No change to any other Jira action.
- No unrelated refactoring.

## Decisions

- **`icon` object shape**: `z.object({ url16x16: z.string().optional(), title:
  z.string().optional(), link: z.string().optional() })`. All fields optional so
  callers may supply partial objects. This matches the documented
  `icon: { url16x16, title, link }` shape.
- **`status` object shape**: `z.object({ resolved: z.boolean().optional(), icon:
  z.object({ url16x16: z.string().optional(), title: z.string().optional(), link:
  z.string().optional() }).optional() })`. `resolved` is boolean per the API; the
  nested `icon` reuses the same object shape. Other documented fields are not
  modeled because the API's `status` object is open-ended and the tool only needs to
  pass through what the caller supplies.
- **Request builder**: The `remoteLinks` case already assigns
  `object.icon = input.link.icon` and `object.status = input.link.status` verbatim.
  Once the schema yields objects, these pass through unchanged into `{ object }` —
  no change to the assignment logic is required.
- **Alternatives considered**: Keeping `icon`/`status` as `z.record(z.string(),
  z.unknown())` was rejected because it loses field-level validation and the
  documented shape is a fixed object. Modeling every documented `status` field was
  rejected as YAGNI — the tool passes through what the caller supplies.

## Risks / Trade-offs

- [Strict schema rejects unknown fields in `link`] → The `link` sub-object remains
  strict; callers must use the documented field names. This is consistent with the
  existing strict top-level schema.
- [Partial `icon`/`status` objects] → All nested fields are optional, so partial
  objects validate and pass through without error.
