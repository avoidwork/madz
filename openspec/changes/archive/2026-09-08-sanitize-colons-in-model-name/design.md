## Context

The `createDeepAgentsOrchestrator` function in `src/agent/deepAgents.js` constructs a model identifier for the harness profile registry key using a template literal: `` `${providerName}:${providerConfig.model}` ``. When `providerConfig.model` contains a colon (e.g., `qwen3.8:27b-mlx`), the resulting key has two colons, which fails the `deepagents` library's `validateProfileKey()` validation (single-colon format required).

The fix is a one-line sanitization: apply `.replace(/:/g, "-")` to the model name portion of the template literal. The original `providerConfig.model` is preserved for API calls via `createChatModel(providerConfig)`.

## Goals / Non-Goals

**Goals:**
- Sanitize colons in model names when constructing the harness profile registry key
- Preserve the original model name for API calls
- Add unit tests covering colon sanitization edge cases
- Ensure zero regressions in existing behavior

**Non-Goals:**
- Modifying the `deepagents` library's key validation
- Changing how model names are passed to API calls
- Supporting colons in provider names

## Decisions

1. **String replacement over encoding** — Using `.replace(/:/g, "-")` is simpler and more readable than URL-encoding or base64-encoding the model name. Hyphens are safe in registry keys and preserve readability.
2. **Global replace (`/g` flag)** — Using the global flag handles model names with multiple colons (e.g., `a:b:c` → `a-b-c`), which is more robust than replacing only the first occurrence.
3. **No validation change in deepagents** — The external library's validation is correct; the fix belongs in the caller.

## Risks / Trade-offs

- **[Low] Hyphen collision** — If a model name already contains hyphens, replacing colons with hyphens could theoretically create ambiguity. In practice, model names use colons as version/tag separators (e.g., `qwen3.8:27b-mlx`), and hyphens are already used within model name components. No realistic collision scenario exists.
- **[Low] No-op for clean names** — Model names without colons pass through `.replace(/:/g, "-")` unchanged, so there is zero performance or behavior impact for the common case.
