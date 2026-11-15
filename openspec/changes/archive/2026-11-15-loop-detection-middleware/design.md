# Design

## Context

The orchestrator is a deepagents agent built in `createDeepAgentsOrchestrator` (`src/agent/deepAgents.js`). It composes a `middleware` array passed to `createDeepAgent`. Existing middleware (`tokenBudgetMiddleware`, `summarizationMiddleware`, `copilotRetryMiddleware`) live in `src/provider/` and use `createMiddleware` from `langchain`. The agent already exposes `agent.compactContext`, wired to `/compact` in `index.js`, and uses a closure (`compactOnContextWindowExceeded`) to trigger compaction from a middleware. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- Detect message and reasoning loops independently via content hashing.
- Inject a `HumanMessage("You're looping")` nudge on detection.
- Escalate to the existing compaction path when the loop persists.
- Make behavior configurable with production-safe defaults.

**Non-Goals:**
- Not modifying the existing `streaming-loop-detection` sentence sampler or the streaming pipeline.
- Not changing subagent model calls — only the orchestrator's model calls.
- Not adding a hard interrupt/throw.

## Decisions

### Use `beforeModel` hook, not `wrapModelCall`

The `beforeModel` hook receives `(state, runtime)` and can return a partial state update. Returning `{ messages: [new HumanMessage("You're looping")] }` appends a message the model sees on its next turn. `wrapModelCall` inspects/modifies the outgoing request but cannot cleanly append to state. This matches the summarization middleware pattern (`src/provider/summarizationMiddleware.js`).

### Hash message text and reasoning independently

Two separate rolling windows (message hashes, reasoning hashes) prevent a reasoning-only loop from being masked by changing message text, and vice versa. Content extraction reuses the patterns in `src/stream/transformers/turn.js` (`additional_kwargs.reasoning_content`, content blocks with `type: "reasoning"`, `hasContent()`).

### Per-thread state keyed by `thread_id`

The middleware maintains a `Map` keyed by `runtime.configurable.thread_id`. Each entry holds the message hash window, reasoning hash window, and escalation timestamps. This keeps concurrent threads independent.

### Escalation via closure callback

The middleware takes an `onCompact` callback. In `deepAgents.js`, this is set via closure after the agent exists (mirroring `compactOnContextWindowExceeded`) so it can call `agent.compactContext`. When the escalation count is reached within the window, the middleware invokes `onCompact` instead of injecting another nudge.

### Config via Zod schema

A new `loopDetection` schema follows the `summarization.js` pattern (`.strict().default({})`), registered in `config.js` and `schemas/index.js`. Defaults: `enabled: true`, `windowSize: 10`, `threshold: 2`, `escalationCount: 3`, `escalationWindowMs: 60000`. Disabled config returns `null` (no middleware), so it is a true no-op.

## Risks / Trade-offs

- **False positives on legitimate repetition** → The threshold (default 2) and window (default 10) are conservative; the nudge is a gentle message, not a hard stop. Configurable.
- **Injected nudge pollutes conversation history** → The nudge is a `HumanMessage` that becomes part of state. It is a fixed literal, but repeated nudges before escalation could accumulate. The escalation counter bounds this (3 within 60s, then compact).
- **Compaction on escalation is disruptive** → Compaction summarizes history. This is intentional — a persistent loop indicates the context is the problem. The escalation window (60s) prevents premature compaction.
- **Middleware ordering** → Registered alongside existing middleware; `beforeModel` hooks compose independently. No interference with token-budget or summarization expected.
