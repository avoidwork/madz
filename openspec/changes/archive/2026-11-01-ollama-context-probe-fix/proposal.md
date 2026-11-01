# Proposal

## Why

The Ollama context-window probe in `src/provider/modelInfo.js` never matches the real `/api/show` response shape. It iterates `Object.values(model_info)` and checks `family.context_length`, but Ollama returns `model_info` as a flat object of dotted keys (e.g. `"gemma4.context_length": 131072`). The branch is therefore dead, the probe returns `undefined` for stock Ollama models, and the summarization trigger in `src/agent/deepAgents.js` falls back to the configured 128000-token default — wrong for small local models, which silently truncate leading context.

## What Changes

- Rewrite the Ollama branch of `getModelContextLength` to parse the flat `model_info` shape: scan `Object.entries(model_info)` for keys ending in `.effective_context_length` (highest precedence, since it is `min(native, OLLAMA_CONTEXT_LENGTH)`), then `.context_length` (native).
- Preserve the `num_ctx` fallback (parsed from the `parameters` string) as the final resort for users who set it explicitly.
- Continue returning `undefined` when no usable field exists, preserving the caller's graceful fallback.
- Correct the false-confidence unit test at `tests/unit/provider/modelInfo.test.js:88` from the nested shape to the flat shape, and add a precedence test and a neither-field case.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `model-context-length`: The "Ollama native endpoint returns context_length" scenario currently encodes the nested shape `model_info.<family>.context_length`, which Ollama never emits. Correct it to the flat dotted-key shape (`model_info["<family>.context_length"]`), and add a scenario for `effective_context_length` taking precedence over native `context_length`.

## Impact

- **Code**: `src/provider/modelInfo.js` (Ollama branch, lines 142-151).
- **Tests**: `tests/unit/provider/modelInfo.test.js` (correct line 88, add two cases).
- **No schema, config, or call-site changes**: the OpenAI-compatible `/models` candidate, `buildShowUrl`, and the `deepAgents.js` call site are all correct and untouched.
- **No new dependencies.**

## Non-goals

- Changing the OpenAI-compatible `/models` candidate (vLLM `max_model_len`, Copilot `limits.max_prompt`, opencode `max_prompt_tokens`) — that path is correct.
- Changing `buildShowUrl` — URL construction is correct.
- Changing the `deepAgents.js` call site or the 80% trigger derivation — correct, simply unblocked by this fix.
- Changing the `num_ctx` fallback test — it is correct.
