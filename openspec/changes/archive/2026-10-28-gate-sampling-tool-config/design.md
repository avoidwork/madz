## Context

The `sampling` tool is currently registered unconditionally in `buildToolConfig` (`src/tools/index.js`), sitting in the same `case` branch as `clarify` and `process`, which are exempt from permission/config gating. The `decision` tool, by contrast, is gated on `agent.decision.baseUrl` — it registers only when a non-empty base URL is present, and its system-prompt instruction is injected conditionally via a `DECISION_TOOL_INSTRUCTION` token.

This change brings `sampling` in line with `decision`: an `agent.sampling` boolean controls registration, and the system-prompt instruction is injected only when the tool is enabled.

## Goals / Non-Goals

**Goals:**
- Add an `agent.sampling` boolean config flag (default `true`) that gates `sampling` tool registration.
- Mirror the `decision` tool's config-gated registration pattern.
- Inject the sampling instruction in the system prompt only when the tool is enabled.
- Preserve current behavior by default (tool stays registered unless explicitly disabled).

**Non-Goals:**
- No change to the sampling tool's capture behavior, rate limiting, capacity limits, or ephemeral memory TTL.
- No change to the `decision` tool's gating.
- No change to `telemetry.sampling` (a separate concern).

## Decisions

### 1. Config shape: flat boolean under `agent`
The flag lives at `agent.sampling` as a flat boolean, rather than `agent.sampling.enabled`. This mirrors the user's explicit choice and keeps the config minimal. It also avoids confusion with `telemetry.sampling`, which is a separate object.

- **Alternative considered:** `agent.sampling.enabled` (object) — more extensible but heavier for a single boolean. Rejected for simplicity.
- **Alternative considered:** top-level `sampling.enabled` — collides conceptually with `telemetry.sampling`. Rejected.

### 2. Default `true` preserves behavior
`sampling: z.boolean().default(true)` in `AgentSchema` means an absent flag leaves the tool registered. The gate expression `config?.agent?.sampling !== false` treats `undefined` as enabled, so partial configs in tests still register the tool.

### 3. Registration gated in `buildToolConfig`
`sampling` moves out of the exempt `case "clarify"/"process"` branch into its own `case "sampling"` that checks `runtimeOptions.samplingEnabled`. A new `samplingEnabled` key is added to `runtimeOptions` and to `CONSUMED_RUNTIME_OPTION_KEYS` (the guard test in `tests/unit/tool_index.test.js` fails CI if a runtime-option key is added without a consumer).

### 4. System-prompt instruction tokenized
The static sampling block in `prompts/SYSTEM_PROMPT.md` is replaced with a `<!-- SAMPLING_TOOL_INSTRUCTION -->` token. `loadSystemPrompt` (`src/memory/prompts.js`) replaces it with the instruction when `agent.sampling !== false`, or removes it when disabled — mirroring the `DECISION_TOOL_INSTRUCTION` handling.

### 5. Env var via schema-driven reverse map
No manual env-var wiring is needed. The schema-driven reverse map in `src/config/loader.js` auto-derives `AGENT_SAMPLING` from the new `agent.sampling` field, so `AGENT_SAMPLING=false` disables the tool without touching config.yaml.

## Risks / Trade-offs

- **[Behavior change if flag is misconfigured]** → Default `true` and the `!== false` gate mean an absent or malformed flag keeps the tool enabled; only an explicit `false` disables it.
- **[Prompt/tool drift]** → If the tool is disabled but the prompt token is left in place, the agent is told to use a tool that isn't registered. Mitigated by injecting the instruction conditionally from the same config value that gates registration.
- **[Coverage]** → New gating paths need tests. Covered by gating tests in `tool_index.test.js` and token tests in `prompts.test.js`.
