# Design

## Context

See proposal.md - Why. The `textToSpeechImpl` function in `src/tools/tts/index.js` currently wraps every return value in `JSON.stringify(...)`. The helper `callTtsApi` already returns native `{ ok, buffer?, error? }` objects; only the impl stringifies them. The `textToSpeech` tool is wrapped by `@langchain/core/tools` `tool()`.

## Goals / Non-Goals

**Goals:**
- `textToSpeechImpl` returns native structured objects on every code path.
- JSDoc reflects the structured return shape.
- Unit tests assert native object shape directly.

**Non-Goals:**
- No change to `callTtsApi`, config loading, the tool schema, or the `tool()` wrapper.
- No change to the `MEDIA:` path format or the saved filename convention.
- No change to error message text.

## Decisions

**Decision: Return native objects from the impl, not from the wrapper.**
The issue explicitly targets `textToSpeechImpl`. The `tool()` wrapper may still serialize the return value for the LLM, but the impl returns native objects as required. This keeps the change minimal and localized.

**Decision: Preserve existing error messages and success payload fields.**
Downstream consumers may rely on the exact error strings and the `path`/`model`/`voice` fields. Changing them would be a breaking change beyond the issue's scope.

**Decision: Update tests to read object properties directly.**
The existing tests call `JSON.parse(result)`. Since the impl now returns native objects, these calls are removed and assertions read `result.ok`, `result.error`, `result.path` directly.

## Risks / Trade-offs

- [The `tool()` wrapper may stringify the return for the LLM] → The impl still returns native objects; tests import `textToSpeechImpl` directly and assert the native shape.
- [Downstream callers that expect a string may break] → The issue explicitly requests this change; error messages and payload fields are preserved to minimize impact.

## Migration Plan

No migration needed. This is a localized refactor of return values and tests.

## Open Questions

None.
