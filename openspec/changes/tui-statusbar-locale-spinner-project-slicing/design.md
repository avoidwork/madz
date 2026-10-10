## Context

The TUI status bar (`src/tui/statusBar.js`) is a React/Ink component rendered on every interaction. It currently has three defects:

1. **Locale**: `formatNumber` and `formatSize` both call `Intl.DateTimeFormat().resolvedOptions().locale` to get the user's locale for number formatting. This is semantically wrong — the date-format locale can differ from the number-format locale in some environments — and it re-resolves the locale on every render.
2. **Spinner color**: The streaming spinner is hardcoded to `color: "cyan"`. The user gets no visual signal about how close the conversation is to the model's context window.
3. **Project slicing**: The project path is sliced with `project.includes("projects/") ? project.slice(project.lastIndexOf("projects/") + "projects/".length) : project`. This only works when the path literally contains `projects/` and is fragile across platforms and trailing slashes.

The active provider config is available in the TUI via `getActiveProviderConfig(config)` (in `src/provider/index.js`), which returns the provider object keyed by name in `config.providers`. The orchestrator (`src/agent/deepAgents.js`) already resolves the model's real context length via `getModelContextLength(providerConfig)` and mutates the shared config singleton for the summarization trigger.

## Goals / Non-Goals

**Goals:**
- Use the number-format locale for number formatting, cached once at module load.
- Color the streaming spinner by context-window utilization (0-60% cyan, 61-80% orange, 81-100% red), falling back to cyan when no context window is configured.
- Slice the project path with `path.basename()`, preserving the full-path fallback.
- Add a `contextWindow` config field (default 128000) to the OpenAI and Copilot provider schemas and `config.yaml`, and update it at runtime from the resolved model context length.
- Thread `contextWindow` from the active provider config through `app.js` → `inputArea.js` → `StatusBar`.

**Non-Goals:**
- No change to status bar element visibility configuration.
- No change to the context-window display semantics.
- No change to the spinner animation type or the always-render streaming indicator.

## Decisions

### Decision 1: Cache the number-format locale at module load

Replace both `Intl.DateTimeFormat().resolvedOptions().locale` calls with a single module-level `const locale = Intl.NumberFormat().resolvedOptions().locale;`. This is correct (number formatting should use the number-format locale) and avoids re-resolving on every render. **Alternative considered:** calling `Intl.NumberFormat().resolvedOptions().locale` inline in each function — rejected because it re-resolves the locale on every render and duplicates the call.

### Decision 2: Pure helper for context-utilization color

Add an exported pure function `getContextUtilizationColor(contextSize, contextWindow)` that returns `"cyan"` for 0-60%, `"orange"` for 61-80%, `"red"` for 81-100%, and `"cyan"` when `contextWindow` is 0/unset. The thresholds are inclusive at the lower bound and exclusive at the upper bound (60% → cyan, 61% → orange, 80% → orange, 81% → red, 100% → red). **Alternative considered:** computing the color inline in the component — rejected because a pure function is unit-testable and keeps the component readable.

### Decision 3: `contextWindow` config field, default 128000

Add `contextWindow: z.number().int().positive().default(128000)` to both `OpenaiProviderConfigSchema` and `CopilotProviderConfigSchema` alongside `maxTokens`, and mirror it in `config.yaml`. The default of 128000 (128k) matches the common GPT-4o context window. **Alternative considered:** deriving the default from the model name — rejected because it would require a model→context map and drift as models change.

### Decision 4: Update `contextWindow` from the resolved model context length

In `src/agent/deepAgents.js`, in the block that already calls `getModelContextLength(providerConfig)` and mutates `config.summarization.trigger`, also update the active provider's `contextWindow` when `contextLength !== undefined`. The active provider is keyed by name in `config.providers`, so use `getActiveProviderName(config)` to determine the key and mutate `config.providers[<name>].contextWindow = contextLength`. This mirrors the existing pattern that mutates the shared config singleton so the `/settings` view reflects the live value. **Alternative considered:** passing the context length through a separate channel — rejected because the config singleton is already the established mutation path for the summarization trigger.

### Decision 5: Thread `contextWindow` through the TUI

In `src/tui/app.js`, derive `contextWindow` from `activeProvider?.contextWindow || 0` alongside the existing `tokenBudget` derivation, and pass it to `InputArea`. In `src/tui/inputArea.js`, accept a `contextWindow` prop (default 0) and forward it to the `StatusBar`. In `src/tui/statusBar.js`, add a `contextWindow` prop (default 0) and use `getContextUtilizationColor(contextSize, contextWindow)` for the streaming spinner's color.

## Risks / Trade-offs

- **[Spinner color is a coarse 3-band indicator]** → This matches the issue's explicit thresholds; a continuous gradient would be over-engineering.
- **[When `contextWindow` is 0/unset, the spinner falls back to cyan]** → This preserves the previous behavior for users without the config field, so no regression.
- **[The runtime `contextWindow` update mutates the shared config singleton]** → This is the established pattern for the summarization trigger; the mutation is idempotent and only runs at agent init.
- **[`path.basename()` changes behavior for paths with trailing slashes]** → `path.basename("/path/to/projects/foo/")` returns `"foo"`, which is the desired behavior; the full-path fallback is preserved for non-`projects/` paths.
