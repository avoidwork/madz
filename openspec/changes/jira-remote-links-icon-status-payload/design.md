# Design

## Context

See proposal.md - Why. The `jira` tool's `remoteLinks` action in `src/tools/jira/index.js` types `icon` and `status` as plain strings in the `link` sub-object of `JiraInputSchema`, but the Jira Data Center REST API v2 remote-link schema defines both as objects. The `remoteLinks` case in `buildRequest` passes these values through verbatim into the POST body `{ object }`, so the payload is malformed.

## Goals / Non-Goals

**Goals:**
- Make `icon` and `status` validate as objects matching the Jira Data Center REST API v2 remote-link schema.
- Preserve the existing create/list flow (`url` + `title`) unchanged.

**Non-Goals:**
- No changes to other `jira` actions, config, or the integration test.
- No new external dependencies.

## Decisions

- **Use Zod object schemas in `JiraInputSchema`.** Change `icon` to `z.object({ url16x16: z.string().optional(), title: z.string().optional(), link: z.string().optional() }).optional()` and `status` to `z.object({ resolved: z.boolean().optional(), icon: z.string().optional() }).optional()`. This keeps validation centralized in the existing schema and rejects malformed input before any request is sent.
  - *Alternative considered:* Validating in `buildRequest` manually. Rejected — it would duplicate validation logic and diverge from the project's Zod-first convention.
- **No change needed in `buildRequest`.** The `remoteLinks` case already assigns `object.icon = input.link.icon` and `object.status = input.link.status` verbatim. Once the schema yields objects, the values pass through unchanged. This keeps the change minimal and the core flow untouched.

## Risks / Trade-offs

- [Existing callers passing string `icon`/`status` will now fail validation] → This is the intended behavior; the API requires objects. The unit test is updated to reflect the object shape.
- [Partial objects (e.g., `icon` with only `url16x16`) must validate] → All sub-fields are optional, so partial objects pass and are sent as-is.

## Migration Plan

No deployment or rollback complexity — a single source file and its unit test change. The change ships with the next release.

## Open Questions

None.
