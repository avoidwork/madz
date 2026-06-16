# TUI.md Audit Report

**Date:** 2026-06-16
**Source:** `docs/TUI.md` (1000 lines, 17 sections)
**Generated Artifacts:** proposal.md, design.md, specs/ (5 spec files), tasks.md

## Audit Findings

### ✅ Well-Captured Sections

| TUI.md Section | Coverage | Notes |
|----------------|----------|-------|
| §1 Philosophy | ✅ | Captured in proposal.md "Why" section |
| §2 Architecture | ✅ | Captured in design.md "Context" section |
| §3 Scrolling & Viewport | ✅ | Covered in tui-streaming-hook (auto-scroll) and tui-file-structure |
| §6 Runtime Configuration | ✅ | Fully covered in tui-runtime-toggles spec |
| §7 Command Parser | ✅ | Fully covered in tui-command-registry spec |
| §8 Interaction Model | ✅ | Keyboard shortcuts and history covered in tui-command-registry |
| §11 Implementation Notes | ✅ | Ink patterns captured in design.md |
| §12 Streaming Architecture | ✅ | Fully covered in tui-streaming-hook spec |
| §14 Onboarding & Banner | ✅ | Covered in tui-file-structure spec |
| §15 Summary | ✅ | Captured in proposal.md |
| §16 Architectural Debt | ✅ | Fully captured in proposal.md and design.md |
| §17 Implementation Spec | ✅ | State shape, action types, command registry schema in specs |

### ❌ Missing / Incomplete Sections

| TUI.md Section | Gap | Severity | Action Needed |
|----------------|-----|----------|---------------|
| **§4 The Cursor** | No spec for cursor positioning, visibility toggling, cursorChar config | **HIGH** | Add `tui-cursor-positioning` spec |
| **§5 Message Display** | No spec for Message interface, role-based styling, memoization, markdown rendering | **HIGH** | Add `tui-message-display` spec |
| **§9 Status Bar** | Toggle indicators mentioned but status bar component spec missing | **MEDIUM** | Add to tui-runtime-toggles or create `tui-status-bar` spec |
| **§10 Edge Cases & Resilience** | Terminal resize, streaming overflow, connection loss, model stuck in thinking loop, output retention — all missing | **HIGH** | Add `tui-resilience` spec |
| **§13 Session & Persistence** | Session lifecycle, context token calculation, GC integration — partially missing | **MEDIUM** | Add to existing specs or create `tui-session` spec |

### 📋 Detailed Gap Analysis

#### Gap 1: Cursor Positioning (Section 4)
**TUI.md says:**
- `useCursor` hook for cursor visibility/position
- Input focused → cursor shown at input position
- Input unfocused → cursor hidden
- `config.tui.cursorChar` for cursor character
- Blinking handled by terminal emulator

**Missing from specs:** No spec file covers cursor positioning or visibility toggling.

#### Gap 2: Message Display (Section 5)
**TUI.md says:**
- `Message` interface with role, content, time, streaming, reasoningContent, activeToolCall, toolCallDisplay, toolCalls, id
- Role-based styling: user=green, system=yellow, assistant=cyan
- `React.memo` with custom `areEqual` on MessageBubble
- Markdown rendering through `marked` + `marked-terminal` with parse cache
- Streaming cursor character (`█`) stripped before parsing

**Missing from specs:** No spec file covers the Message interface, role-based styling, memoization, or markdown rendering.

#### Gap 3: Edge Cases & Resilience (Section 10)
**TUI.md says:**
- Terminal resize: detect via `stdout.on("resize")`, call `remeasure()`
- Streaming overflow: content hash tracking, deferred `scrollToBottom()`
- Connection loss: error catch, system message, streaming message cleared, session saved
- Model stuck in thinking loop: auto-continue circuit breaker (configurable limit)
- Output retention: managed by sessionState, not TUI

**Missing from specs:** No spec file covers any of these edge cases.

#### Gap 4: Status Bar (Section 9)
**TUI.md says:**
- Status indicator: ● green (ready), ▶ yellow (streaming), ✖ red (error)
- Status message: "Ready", "Streaming...", "Compacting context..."
- Skill count, message count, context size
- Proposed: toggle/filter indicators `[ts:1 scroll:1]`

**Partially covered:** Toggle indicators mentioned in tui-runtime-toggles, but the status bar component itself has no spec.

#### Gap 5: Session & Persistence (Section 13)
**TUI.md says:**
- Session lifecycle: createSession → SessionStateManager → App receives as prop
- Context token calculation: tiktoken with character-count fallback
- GC integration: gcManager.onActivity called after each message exchange

**Partially covered:** Context token calculation mentioned in tui-file-structure, session lifecycle and GC integration not covered.

## Resolution Plan

### Priority 1: Add Missing Specs (HIGH severity)

1. **Create `tui-cursor-positioning` spec** — Cover cursor visibility, positioning, cursorChar config
2. **Create `tui-message-display` spec** — Cover Message interface, role-based styling, memoization, markdown rendering
3. **Create `tui-resilience` spec** — Cover terminal resize, streaming overflow, connection loss, model stuck loop, output retention

### Priority 2: Enhance Existing Specs (MEDIUM severity)

4. **Enhance `tui-runtime-toggles`** — Add status bar toggle indicators requirement
5. **Enhance `tui-file-structure`** — Add session lifecycle and GC integration requirements

### Priority 3: Update Tasks (LOW severity)

6. **Update `tasks.md`** — Add tasks for new spec implementations and cursor/message display components
