## Why

When the `OPENAI_MODEL` environment variable contains a colon (e.g., `qwen3.8:27b-mlx`), the harness profile registry key constructed in `src/agent/deepAgents.js` ends up with two colons (e.g., `openai:qwen3.8:27b-mlx`). The `deepagents` library's `validateProfileKey()` rejects keys with more than one colon, causing the application to crash at startup. This is a regression for users of OpenAI-compatible models whose identifiers include a colon.

## What Changes

- **`src/agent/deepAgents.js`**: Apply `.replace(/:/g, "-")` to the model name when constructing the `modelIdentifier` for `registerHarnessProfile()`. The original `providerConfig.model` value is preserved for API calls.
- **`tests/unit/deepAgents.test.js`**: Add test cases verifying colon sanitization in the model identifier, including edge cases (multiple colons, leading/trailing colons, no colons).

## Capabilities

### New Capabilities
- `model-name-sanitization`: Sanitize colons in model names when constructing internal registry keys, ensuring compatibility with the `deepagents` library's key validation.

### Modified Capabilities
*(None — no existing spec-level behavior changes.)*

## Impact

- **`src/agent/deepAgents.js`**: One-line change in the template literal at line ~193.
- **`tests/unit/deepAgents.test.js`**: New test cases for colon sanitization.
- **No new dependencies.** No config changes. No API contract changes.
- The `deepagents` library's `validateProfileKey()` is external and unchanged.
- `registerHarnessProfile` is called only once in the codebase, making the fix isolated and low-risk.

## Non-goals

- Changing the `deepagents` library's key validation logic.
- Modifying how model names are passed to API calls (`createChatModel`).
- Supporting colons in provider names (provider names are fixed constants).
