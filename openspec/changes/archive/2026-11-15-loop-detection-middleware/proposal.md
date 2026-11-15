# Proposal

## Why

Models occasionally get stuck repeating the same 1-3 lines of message or reasoning text over and over. This burns tokens, stalls the turn, and produces a useless response. There is currently no guardrail at the orchestrator level: the agent keeps calling the model until the recursion limit or a manual interrupt stops it. A lightweight loop detector that nudges the model back on track — and compacts context if the nudge fails — prevents wasted spend and unblocks the user.

## What Changes

- Add a `LoopDetection` middleware (`src/provider/loopDetectionMiddleware.js`) that hashes the most recent message text and reasoning content independently per thread.
- When a hash appears more than the configured threshold within a rolling window, inject a `HumanMessage("You're looping")` into the model state so the model sees it on its next turn.
- Track loop-injection frequency per thread; when the escalation count is reached within the escalation window, invoke the agent's existing compaction path (`agent.compactContext`) instead of nudging again.
- Add a `loopDetection` config section (`src/config/schemas/loopDetection.js`) with production-safe defaults.
- Register the middleware in `createDeepAgentsOrchestrator` (`src/agent/deepAgents.js`).

## Capabilities

### New Capabilities
- `model-loop-detection`: Detects when the model repeats the same message or reasoning content across successive calls, injects a "You're looping" nudge, and escalates to context compaction when the loop persists. This is distinct from the existing `streaming-loop-detection` capability, which samples sentence boundaries in the streaming output pipeline.

### Modified Capabilities
<!-- No existing capability's requirements change. -->

## Impact

- **New file**: `src/provider/loopDetectionMiddleware.js`
- **New file**: `src/config/schemas/loopDetection.js`
- **New file**: `tests/unit/provider/loopDetectionMiddleware.test.js`
- **Modified**: `src/agent/deepAgents.js` (register middleware, wire `onCompact` callback)
- **Modified**: `src/config/schemas/config.js` (register schema)
- **Modified**: `src/config/schemas/index.js` (export schema)
- **Modified**: `config.yaml` (add `loopDetection:` section)
- **Dependencies**: `node:crypto` (sha256 hashing), `@langchain/core/messages` (`HumanMessage`). No new npm packages.

## Non-goals

- Not modifying the existing `streaming-loop-detection` sentence sampler or the streaming pipeline.
- Not changing subagent model calls — only the orchestrator's model calls.
- Not adding a hard interrupt/throw; the nudge + compaction escalation is preferred.
