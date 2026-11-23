# Design

## Context

See proposal.md - Why. The loop detector `createSegmentLoopDetector()` in `src/stream/loopDetector.js` keys state by `kind` plus an `id` (`kind\0id`), isolating each stream's state to the one stream a delta belongs to. Subagent reasoning is already fed to the detector keyed by `subagentId(namespace)` — the `tools:<id>` namespace segment — so concurrent subagents never mix. The remaining gap is subagent **message** text, which is currently excluded by the `if (!isSubagent)` guard in `drainStream`.

## Goals / Non-Goals

**Goals:**

- Feed subagent message text to the loop detector, keyed per subagent so concurrent subagents never share detector state.
- Gate subagent message detection by the same `loopDetection.subagent` toggle that gates subagent reasoning.
- Preserve existing behavior: subagent message text is not accumulated into the orchestrator's `content`, and subagent output stays routed to the subagent store.

**Non-Goals:**

- No change to the loop detector's core algorithm, worker, or windowing.
- No change to the orchestrator's own message-end detection (`currentMsgId`/`endMessage`).
- No schema change to `loopDetection.js` (the `subagent` field already exists).

## Decisions

**Decision: Reuse `subagentId(namespace)` as the message-stream key.**

Subagent reasoning is already keyed by `subagentId(namespace)` (the `tools:<id>` segment). Using the same id for subagent message text means a subagent's reasoning and message text share the same per-subagent namespace, and concurrent subagents never share detector state. This mirrors the existing pattern exactly and requires no new helper. Alternative considered: keying by the content-block index like the orchestrator's messages — rejected because the block index is not unique across concurrent subagents and would let two subagents' message streams collide.

**Decision: Gate subagent message detection by `includeSubagent` (`options.subagent !== false`).**

The `includeSubagent` flag already gates subagent reasoning. Applying the same flag to subagent message text keeps the two behaviors consistent and honors the existing `loopDetection.subagent` toggle (default `true`) that `index.js` already threads through as `subagent: loopConfig.subagent !== false`. No schema or wiring change is needed.

**Decision: Add an `else if (includeSubagent)` branch in the message-text block.**

The current block is `if (!isSubagent) { content += text; ...push("message", text, blockIndex) }`. The change adds an `else if (includeSubagent)` branch that pushes subagent message text keyed by `subagentId(namespace)`, without touching `content`. This keeps the orchestrator's accumulation and the subagent's detection cleanly separated.

**Decision: Reuse the existing subagent message turn lifecycle for state release.**

`endSubagentMessage(namespace)` already releases a subagent's detector state when a different message id arrives or a finish reason is carried. Because subagent message text is keyed by the same `subagentId(namespace)`, the same lifecycle releases the message stream's state at turn end. No new release path is needed.

## Risks / Trade-offs

- [Subagent message streams now count against the detector's `maxStreams` cap (default 4)] → This is consistent with the existing design, which already counts subagent reasoning and orchestrator streams against the same cap. No change needed.
- [Subagent message text could be double-counted with subagent reasoning if a subagent emits both] → The detector keys by `kind` plus id, so `message` and `reasoning` are separate streams even for the same subagent. No mixing.
