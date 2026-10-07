## Context

The `decision` tool is registered and callable but always fails with a misleading "not configured" error, even when `agent.decision.baseUrl` is set in config. In `src/tools/index.js`, `buildToolConfig` builds a `runtimeOptions` object that includes `decisionConfig: config?.agent?.decision`. However, the `decision` case in the registration switch pushes `TOOLS[toolName]` as a bare static instance, which never receives `runtimeOptions.decisionConfig`. When invoked, `decisionImpl` reads `options.decisionConfig` as `undefined` and returns the "not configured" error.

## Goals / Non-Goals

**Goals:**
- Bind `decisionConfig` into the `decision` tool at registration so the configured `agent.decision.baseUrl` is actually used at invoke time.
- Preserve the existing registration gate (requires `hasAllPerms` and `decisionConfig?.baseUrl`).
- Add a regression test proving `decisionConfig` is threaded through to `decisionImpl`.

**Non-Goals:**
- No change to `decisionImpl`'s core logic, schema, or the Ollama call path.
- No change to the registration gate or permission model.
- No change to the config schema for `agent.decision`.

## Decisions

**Decision: Inject `decisionConfig` via a closure at registration.**

Wrap `decisionImpl` in a closure that injects `decisionConfig` from `runtimeOptions.decisionConfig`:

```js
case "decision": {
  if (!hasAllPerms || !runtimeOptions.decisionConfig?.baseUrl) continue;
  const decisionTool = tool((input, options = {}) =>
    decisionImpl(input, { ...options, decisionConfig: runtimeOptions.decisionConfig })
  , { name: "decision", description: "...", schema: DecisionToolSchema });
  tools.push(decisionTool);
  continue;
}
```

**Alternatives considered:**
- *Have `decisionImpl` read `agent.decision` from the loaded config directly.* Simpler, but couples `decisionImpl` to the global config singleton and bypasses the `runtimeOptions` pattern used by every other tool. Rejected in favor of the closure approach, which is consistent with how the registration gate already reads `runtimeOptions`.
- *Mutate the shared `decision` instance.* Rejected — it would leak state across registrations and break the singleton's immutability.

**Rationale:** The closure approach keeps `decisionImpl` pure (it still reads `options.decisionConfig`), preserves tool metadata, and is consistent with the existing `runtimeOptions` pattern.

## Risks / Trade-offs

- [Closure captures `runtimeOptions.decisionConfig` at registration] → Mitigation: `runtimeOptions` is scoped to each `buildToolConfig` call, so each registration gets its own config snapshot. No shared mutable state.
- [Wrapped tool must preserve metadata for schema validation tests] → Mitigation: The closure passes `{ name: "decision", description, schema: DecisionToolSchema }` to `tool()`, matching the original.
- [Double-wrapping or mutating the shared `decision` instance] → Mitigation: We create a new `tool()` instance per registration; the original `decision` export is untouched.
