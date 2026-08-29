## Context

The TUI (Ink-based terminal UI) is the primary user-facing interface for the madz AI harness. It renders a conversation panel, input bar, status bar, and various panels. The App component is the root React component that manages all state including `inputText` (updated on every keystroke). Currently, every state change triggers a full render tree diff in Ink, causing visible sluggishness during typing.

## Goals / Non-Goals

**Goals:**
- Eliminate unnecessary re-renders of ConversationPanel when its props are stable
- Prevent render cascade from inputText changes by memoizing App with a custom comparator
- Remove redundant module-level cache from MarkdownText that is fragile and test-problematic
- Maintain all existing functionality — no behavioral changes

**Non-Goals:**
- Splitting App into isolated Ink apps (significant refactor, marginal gain)
- Adding useMemo/useCallback throughout the component tree (doesn't address root problem)
- Performance profiling or benchmarking (out of scope for this change)
- Changes to Ink or React versions

## Decisions

### Decision 1: Use React.memo for ConversationPanel with default shallow comparison

**Rationale:** ConversationPanel props (messages, assistantName, scrollRef, messageListRef) are stable references that don't change on every keystroke. Default shallow comparison is sufficient and requires no custom comparator. This is the simplest possible optimization with maximum impact.

**Alternatives considered:**
- Custom comparator: Unnecessary overhead for stable props
- useMemo for individual props: More complex, same result

### Decision 2: Use React.memo with custom areEqual for App

**Rationale:** App has many state variables that change frequently (inputText, statusMessage, chatHistory, historyIndex, inputFocused, showBanner, onboardingResponse). A custom comparator that ignores these while comparing stable props (config, registry, sessionState, etc.) prevents the render cascade without breaking legitimate re-renders.

**Alternatives considered:**
- Split into isolated Ink apps: Significant refactor, marginal gain over memoization
- useMemo/useCallback throughout: More changes, doesn't address root problem as cleanly

**Comparator design:**
```javascript
function areEqual(prevProps, nextProps) {
  // Ignore frequently-changing props
  if (prevProps.inputText !== nextProps.inputText) return false;
  if (prevProps.statusMessage !== nextProps.statusMessage) return false;
  if (prevProps.chatHistory !== nextProps.chatHistory) return false;
  if (prevProps.historyIndex !== nextProps.historyIndex) return false;
  if (prevProps.inputFocused !== nextProps.inputFocused) return false;
  if (prevProps.showBanner !== nextProps.showBanner) return false;
  if (prevProps.onboardingResponse !== nextProps.onboardingResponse) return false;
  // Compare all other props with shallow equality
  const stableProps = ['config', 'registry', 'sessionState', 'contextSize', 'isCompacting',
    'messageListRef', 'abortControllerRef', 'isStreamingRef', 'dispatchPromiseRef',
    'autoContinueCountRef', 'isAutoContinuingRef', 'streamingMsgIdRef',
    'lastInterruptTimeRef', 'exitRef', 'skillList', 'onboarding', 'onSaveSession',
    'gcManager', 'gcTrigger', 'scheduleManager'];
  for (const prop of stableProps) {
    if (prevProps[prop] !== nextProps[prop]) return false;
  }
  return true;
}
```

Wait — that's backwards. The comparator should return `true` when props are equal (no re-render needed). Let me correct:

```javascript
function areEqual(prevProps, nextProps) {
  // If stable props changed, re-render
  const stableProps = ['config', 'registry', 'sessionState', 'contextSize', 'isCompacting',
    'messageListRef', 'abortControllerRef', 'isStreamingRef', 'dispatchPromiseRef',
    'autoContinueCountRef', 'isAutoContinuingRef', 'streamingMsgIdRef',
    'lastInterruptTimeRef', 'exitRef', 'skillList', 'onboarding', 'onSaveSession',
    'gcManager', 'gcTrigger', 'scheduleManager'];
  for (const prop of stableProps) {
    if (prevProps[prop] !== nextProps[prop]) return false;
  }
  // Stable props unchanged — no re-render needed regardless of input props
  return true;
}
```

### Decision 3: Remove module-level cache from MarkdownText

**Rationale:** The module-level variables `lastContentRef` and `lastElementRef` implement a manual cache that is redundant with:
1. `React.memo(MarkdownTextInner)` — prevents re-renders when content prop is unchanged
2. `parseMarkdown` LRU cache — deduplicates parsed output

The module-level cache was added to prevent flicker during streaming, but the LRU cache handles this by returning the same parsed string for identical content, which React.memo then uses to skip re-renders.

**Alternatives considered:**
- Keep the module-level cache: More code, more fragility, no unique benefit
- Convert to React.useRef: More complex, same result as React.memo

## Risks / Trade-offs

**Risk:** App comparator may miss a frequently-changing prop → unnecessary re-renders continue.
→ **Mitigation:** The comparator explicitly lists all known stable props. If new state variables are added to App, they should be evaluated for inclusion in the comparator.

**Risk:** Removing module-level cache causes streaming flicker.
→ **Mitigation:** The LRU cache in parseMarkdown returns the same parsed string for identical content. React.memo then skips re-renders when the content prop is unchanged. This should be equivalent to the module-level cache behavior.

**Risk:** Custom comparator in App is fragile — must be updated when App props change.
→ **Mitigation:** The list of stable props is explicit and documented. New state variables added to App should be reviewed for inclusion.

## Migration Plan

No migration needed — this is a pure code change with no data migration or configuration changes.

## Open Questions

- Should the App comparator be extracted to a separate file for maintainability? (Probably not — it's small and tightly coupled to App props)
