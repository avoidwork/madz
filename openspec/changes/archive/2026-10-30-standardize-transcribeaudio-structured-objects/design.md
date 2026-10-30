# Design

## Context

See proposal.md - Why. The `transcribeAudioImpl` function in `src/tools/audio/index.js` wraps every return value in `JSON.stringify(...)`. The helper functions `callTranscribeApi` (line 66) and `transcribeLocal` (line 129) already return native `{ ok, text?, error? }` objects — only the impl stringifies them. The tool is wrapped by LangChain's `tool()` helper.

## Goals / Non-Goals

**Goals:**
- Make `transcribeAudioImpl` return native structured objects on all code paths.
- Update JSDoc and tool description to reflect the structured return.
- Update unit tests to assert the native object shape.

**Non-Goals:**
- No change to the tool's Zod schema, name, or registration.
- No change to the helper functions.
- No wrapper class introduced.

## Decisions

**Decision: Return native objects directly, removing all `JSON.stringify` wrappers.**
The impl already has access to native `{ ok, text?, error? }` objects from its helpers. Wrapping them in `JSON.stringify` adds a serialization round-trip that forces callers to parse. Removing the wrappers and returning the objects directly is the minimal, consistent change.

**Alternative considered: Keep returning strings.** Rejected because it breaks consistency with native-object tools and forces manual parsing on every call.

**Alternative considered: Return a wrapper class.** Rejected as over-engineering for a simple structured object.

**Decision: Update JSDoc and description, not runtime behavior of the `tool()` wrapper.**
The LangChain `tool()` wrapper passes through the impl's return value. Only the JSDoc `@returns` (impl line 151, wrapper line 217) and the `description` string ("Returns a JSON string...") need updating to document the structured object.

## Risks / Trade-offs

- [Breaking change for any caller relying on the stringified return] → Within this repo, the only consumers are the tests, which are updated in the same change. The spec delta marks this as **BREAKING**.
- [Tests currently `JSON.parse` the result] → Update all assertions in `tests/unit/tools/audio.test.js` to use the native object directly.

## Migration Plan

No deployment steps. The change is self-contained to the tool impl, JSDoc, and tests.

## Open Questions

None.
