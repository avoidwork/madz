# TUI.md Re-Audit Report

**Date:** 2026-06-16
**Status:** ✅ All sections now covered

## Re-Audit Results

| TUI.md Section | Coverage | Spec File |
|----------------|----------|-----------|
| §1 Philosophy | ✅ | proposal.md |
| §2 Architecture | ✅ | design.md |
| §3 Scrolling & Viewport | ✅ | tui-streaming-hook, tui-file-structure |
| **§4 The Cursor** | ✅ **NEW** | **tui-cursor-positioning** |
| **§5 Message Display** | ✅ **NEW** | **tui-message-display** |
| §6 Runtime Configuration | ✅ | tui-runtime-toggles |
| §7 Command Parser | ✅ | tui-command-registry |
| §8 Interaction Model | ✅ | tui-command-registry |
| **§9 Status Bar** | ✅ **ENHANCED** | **tui-runtime-toggles** (expanded) |
| **§10 Edge Cases & Resilience** | ✅ **NEW** | **tui-resilience** |
| §11 Implementation Notes | ✅ | design.md |
| §12 Streaming Architecture | ✅ | tui-streaming-hook |
| **§13 Session & Persistence** | ✅ **ENHANCED** | **tui-file-structure** (expanded) |
| §14 Onboarding & Banner | ✅ | tui-file-structure |
| §15 Summary | ✅ | proposal.md |
| §16 Architectural Debt | ✅ | proposal.md, design.md |
| §17 Implementation Spec | ✅ | All specs |

## Summary

- **3 new specs created:** tui-cursor-positioning, tui-message-display, tui-resilience
- **2 specs enhanced:** tui-runtime-toggles (status bar), tui-file-structure (session & persistence)
- **1 file updated:** tasks.md (expanded from 9 groups/58 tasks to 13 groups/77 tasks)
- **All 17 sections of TUI.md now covered**
