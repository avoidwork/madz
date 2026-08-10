## Context

`src/session/index.js` exports both re-exports from other modules and the standalone function `ensureSessionsDir`. This function creates the sessions directory if it doesn't exist — a responsibility that logically belongs in `factory.js` alongside `createSession`.

## Goals / Non-Goals

**Goals:**
- Move `ensureSessionsDir` to `factory.js`
- Make `index.js` a pure barrel file

**Non-Goals:**
- Restructuring other barrel files
- Behavioral changes

## Decisions

1. **Move to factory.js:** `ensureSessionsDir` is part of session initialization, which is the responsibility of `factory.js`. This is the most logical home.

2. **No new file:** Adding a separate `ensureDir.js` would be overkill for a single function. `factory.js` is the right place.

## Risks / Trade-offs

- **Circular dependency:** If `factory.js` imports from `index.js`, moving the function could create a cycle. Mitigation: verify no such import exists.
- **Consumer breakage:** Any file importing `ensureSessionsDir` from the barrel needs to update its import path. Mitigation: grep the codebase for all consumers.
