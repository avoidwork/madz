## Context

The init-time GitHub Copilot OAuth device flow in `index.js` selects the active provider via `Object.keys(config.providers)[0]` — the first config key — which ignores the `enabled` boolean. When Copilot is enabled but not the first provider, the startup check inspects a non-Copilot provider and never triggers the device flow. The dispatch path (`src/agent/deepAgents.js`) and the TUI (`src/tui/app.js`) already use `getActiveProviderName(config)` / `getActiveProviderConfig(config)` from `src/provider/openai.js`, which return the first provider whose `enabled !== false`.

## Goals / Non-Goals

**Goals:**
- Make the init-time Copilot device flow trigger whenever Copilot is the active (enabled) provider, regardless of config position.
- Reuse the existing shared selector so the startup check is consistent with the orchestrator, model factory, and TUI.

**Non-Goals:**
- No changes to the dispatch path, model factory, or TUI provider selection.
- No changes to the OAuth device flow itself (`copilotAuth.js`).
- No changes to the `enabled` schema or config validation.

## Decisions

**Use `getActiveProviderName(config)` in `index.js` instead of the raw first-key lookup.**

- **Why:** `getActiveProviderName` is the single source of truth for the enabled-based selection rule. It returns the first provider whose `enabled !== false`, falling back to `openai`. Reusing it avoids duplicating the selection logic and keeps the startup check consistent with the rest of the system.
- **Alternatives considered:**
  - Duplicate the `enabled !== false` logic inline in `index.js` — rejected because it creates a second, drift-prone copy of the selection rule.
  - Leave the first-key lookup — rejected because it is the root cause of the bug.

**Import `getActiveProviderName` from `./src/provider/openai.js`.**

- `getActiveProviderName` is already exported and used by `deepAgents.js` and `app.js`. Importing it in `index.js` is the minimal, consistent change.

## Risks / Trade-offs

- **[Behavior change for non-Copilot providers]** → The startup auth check now selects the enabled provider rather than the first key. For a single-provider config this is identical. For multi-provider configs, the check now correctly targets the enabled provider. Mitigation: the `if (activeProvider.type === "github-copilot")` guard means only Copilot configs are affected.
- **[No providers enabled]** → `getActiveProviderName` falls back to `openai`, preserving existing behavior. No mitigation needed.
