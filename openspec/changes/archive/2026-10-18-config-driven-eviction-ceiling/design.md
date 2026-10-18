## Context

`deepagents@1.14.2` installs `FilesystemMiddleware` unconditionally inside `createDeepAgent`. Its `wrapToolCall` measures `stringifyToolContent(msg.content)` and, when the length exceeds `toolTokenLimitBeforeEvict * 4`, writes the payload to `/large_tool_results/<id>.txt` and substitutes the `TOO_LARGE_TOOL_MSG` prose (`node_modules/deepagents/dist/langsmith--RbtjNdQ.js:3135` defaults, `:3201` comparison, `:3210` eviction path, `:2269` template, `:3230` middleware name, `:7260` the library's own construction).

`readImage` returns `{ ok, mimeType, data }` JSON with base64 inline, so the measured length is the base64 length plus a small envelope. At the library default the largest surviving raw image is 59,967 bytes while `image.maxSize` defaults to 100,000. `ImageDispatch`'s `buildImageBlock` then `JSON.parse`s the prose, throws, logs `"[imageDispatch] failed to parse readImage tool result; skipping"` and returns `null` — vision silently fails.

Constraints:

- `createDeepAgent` accepts no eviction option. `readImage` is not in `TOOLS_EXCLUDED_FROM_EVICTION` (that list is the filesystem tools minus `execute`, and is module-private).
- `createFilesystemMiddleware`, `getHarnessProfile`, `createHarnessProfile`, `EMPTY_HARNESS_PROFILE` are exported from the package root. `resolveHarnessProfile` and `computeProfileFilesystemTools` are **not**.
- The same middleware also **supplies** the eight filesystem tools. An incomplete option set silently regresses tool availability.
- madz passes no `permissions` to `createDeepAgent`, so the library's instance is built with `permissions: []`.
- `config` is already in scope in `createDeepAgentsOrchestrator` (`src/agent/deepAgents.js:295`) and is already the 4th parameter of `createSubagentDefinitions` (`src/agent/deepAgents.js:47`).

## Goals / Non-Goals

**Goals:**

- `image.maxSize` governs the eviction ceiling, derived in base64 characters.
- The replacement **displaces** the library middleware (same `name`), it does not stack.
- The replacement contributes the identical filesystem tool set the library's would have.
- All 12 inline subagents share the ceiling; the inheritance gap is closed.
- A mistyped `image.maxSize` cannot disable eviction or create a context-window DoS.
- `readImage` results at exactly the ceiling survive; results above it still evict.

**Non-Goals:**

- Correcting `readImage`'s `encodedLimit = Math.ceil(sizeLimit * 1.33)` (separate bug; reproducing `* 1.33` here would inflate this ceiling 1.77x and bake the same inversion into a second file).
- Correcting `resizeScreenshot`'s raw-byte budget.
- Changing `readImage`'s return contract (`content_and_artifact` remains the documented fallback).
- New config keys, npm packages, or postinstall patches.

## Decisions

### D1 — Replace the middleware via same-name displacement

`mergeMiddlewareStack` → `mergeMiddleware$1` does `for (const middleware of custom) merged.set(middleware.name, middleware)` (`:4086`), so a custom entry with `name === "FilesystemMiddleware"` replaces the library's. This repo already depends on the mechanism: our `SummarizationMiddleware` displaces the library default purely by name (`src/agent/deepAgents.js:441`).

*Alternative considered:* postinstall patching of `node_modules/deepagents` (precedent: `scripts/patch-langchain-reasoning.mjs`). Rejected — brittle against upstream, and a supported seam exists.

### D2 — Derive the ceiling in base64 characters

```js
const ENVELOPE_HEADROOM = 128;
const sizeLimit = config.image?.maxSize || DEFAULT_IMAGE_MAX_SIZE;
const toolTokenLimitBeforeEvict = Math.ceil((sizeLimit + ENVELOPE_HEADROOM) / 4);
```

`readImage`'s docstring states the limit budgets the base64 output, so `maxSize` **is** the base64 budget. `ENVELOPE_HEADROOM` covers `{"ok":true,"mimeType":"image/png","data":""}` plus JSON escaping. Default `100000` → `25032` → ceiling `100128` chars, which accommodates a `100000`-char base64 payload plus envelope.

### D3 — Mirror the library's option set, re-implementing the two private helpers

`createFilesystemMiddleware({ backend, permissions: [], tools: profileFilesystemTools, toolTokenLimitBeforeEvict })`.

`computeProfileFilesystemTools(profile)` (`:7210`) returns `undefined` when the profile excludes nothing; otherwise the filtered list, with `read_file` unconditionally prepended. `resolveHarnessProfile` (`:7104`) tries exact `provider:model`, then `providerHint:identifierHint`, then a bare identifier containing a colon, then the bare provider, then `EMPTY_HARNESS_PROFILE`. Neither is exported, so both are re-implemented locally, commented with the dist line they mirror.

Probed today: `anthropic:claude-sonnet-4-6` and `openai:gpt-5.1-codex` → `excludedTools = []`; `openai:gpt-4o`, `openai:gpt-5`, `google:gemini-2.5-pro` → no profile, `EMPTY_HARNESS_PROFILE`. So `tools: undefined` is equivalent **today** — but we pass the derived value rather than omitting the option, so a profile that ever excludes a filesystem tool cannot silently re-enable it under the replacement.

Note: `ChatOpenAI` (from `@langchain/openai@1.6.2`) exposes `.model`, not `.model_name`/`.modelName`, so the library's own `getModelIdentifier` returns `undefined` for madz's instances. The local resolver reads `.model` and tolerates absent hints.

### D4 — One module, two exports, no orchestration logic

`src/agent/filesystemMiddleware.js` owns the arithmetic, the profile resolution, and the construction. `deepAgents.js` only calls it. Keeps `deepAgents.js` from growing further and makes the arithmetic unit-testable without booting an orchestrator.

### D5 — Attach the replacement to every inline subagent definition

`buildSubagentMiddleware` merges parent custom middleware only for the auto-injected `general-purpose` subagent (`:7313`); the 12 configured subagents receive `input.middleware ?? []` (`:7287`). So `createSubagentDefinitions` attaches `middleware: [createEvictionAwareFilesystemMiddleware({ backend, model: agentModel, config })]` to each definition. Because a per-agent temperature produces a per-agent model instance, the middleware is built from that subagent's own model so its profile derivation matches what `resolveSubagentProfile` would resolve.

### D6 — Clamp in the schema, guard in the derivation

`src/config/schemas/image.js` gains `.min(MIN).max(MAX)` on `maxSize` so a mistyped value is rejected at load. The derivation additionally clamps to `[MIN_CEILING, MAX_CEILING]` and falls back to the default when the value is not a finite positive number, so the ceiling can never be `0`, `NaN`, `Infinity`, or `undefined` — `createFilesystemMiddleware` treats a falsy `toolTokenLimitBeforeEvict` as "eviction disabled" (`if (!toolTokenLimitBeforeEvict) return …`, `:3196`).

## Risks / Trade-offs

- **[Name drift]** If the library renames the middleware, the merge stacks a second copy and the bug survives while looking fixed → unit test asserts `name === "FilesystemMiddleware"` and that the contributed tool set matches the library's.
- **[Private-helper drift]** `computeProfileFilesystemTools` / `resolveHarnessProfile` are re-implemented; an upstream change would not propagate → tests compare the replacement's contributed tool set against a freshly built library instance for the same profile; dist line references in comments make the upgrade audit mechanical.
- **[Higher ceiling = larger inline payloads]** → bounded by the schema clamp plus the derivation ceiling; eviction stays enabled; `readImage`'s size check remains the primary gate.
- **[Subagent middleware duplication]** 12 extra middleware instances at startup → construction is cheap (tool closures only); no I/O.
- **[`read_file` threshold rises with the ceiling]** `toolTokenLimitBeforeEvict` also threads into `createReadFileTool` → intended: one ceiling governs inline tool payloads. Documented in the spec so it is not discovered later.
- **[Ceiling correct against a number nothing else respects]** `readImage`'s inverted factor and `resizeScreenshot`'s raw-byte budget disagree with the docstring → deliberately out of scope; this change derives from the docstring reading and stays independent of the other two fixes.

## Migration Plan

Additive. Deploy with the change merged; no data migration, no config migration (existing `config.yaml` values remain valid, now clamped). Rollback is reverting the two commits — the library's default middleware resumes automatically because nothing was patched in `node_modules`.

## Open Questions

- Should `ENVELOPE_HEADROOM` be configurable? No (YAGNI) — 128 chars is 0.13% of the default budget and the JSON envelope is fixed-shape.
- Should the clamp bounds live in the schema only? No — the derivation guard is defence in depth against a caller that bypasses `loadConfig()` (e.g. a hand-built config object in a test or a future code path).
