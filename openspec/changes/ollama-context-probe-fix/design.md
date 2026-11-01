# Design

## Context

The Ollama branch of `getModelContextLength` in `src/provider/modelInfo.js` (lines 142-151) iterates `Object.values(model_info)` and checks `family.context_length`. Ollama's real `/api/show` response returns `model_info` as a flat object of dotted keys (e.g. `"gemma4.context_length": 131072`), so every value is a scalar and the check is always false. The branch is dead; the probe returns `undefined` for stock Ollama models. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- Parse the flat `model_info` shape Ollama actually emits.
- Prefer `effective_context_length` over native `context_length`.
- Preserve the `num_ctx` fallback and the graceful `undefined` fallback.
- Correct the false-confidence test and add regression coverage.

**Non-Goals:**
- No change to the OpenAI-compatible `/models` candidate, `buildShowUrl`, or the `deepAgents.js` call site.
- No schema, config, or dependency changes.

## Decisions

- **Flat-key scan over `Object.entries(model_info)`.** Match keys ending in `.effective_context_length` first (return immediately), then `.context_length` (capture as native). This handles any family key and any number of families.
  - *Alternative considered:* regex on the stringified object — rejected as fragile and untestable.
- **Prefer `effective_context_length`.** It is `min(native, OLLAMA_CONTEXT_LENGTH)` and reflects the runtime cap that actually governs truncation. Returning native when effective is absent preserves the current behavior for models that report only native.
- **Keep `num_ctx` last.** It is parsed from the `parameters` string and only present when the user set it explicitly; placing it last ensures it never shadows a real `context_length`.
- **Use ADDED spec requirements, not MODIFIED.** The existing "Ollama native endpoint returns context_length" scenario encodes the nested shape that never worked; correcting it in place would require rewriting a >500-char requirement. Adding new requirements for the flat shape and the precedence rule is cleaner and avoids the length constraint.

## Risks / Trade-offs

- [Multiple families in `model_info`] → The scan returns the first `effective_context_length` found; for a single loaded model this is unambiguous, and Ollama reports one family per model.
- [`effective_context_length` not present in older Ollama builds] → The native `context_length` fallback covers this; behavior degrades gracefully to the current native value.
- [Test shape drift] → The corrected test pins the exact flat key format Ollama emits, so a future shape change fails loudly rather than silently.
