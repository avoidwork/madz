# Tasks

## 1. Click detection
- [x] 1.1 Add `onClick` to `useMouseScroll`, leaving the selection path unchanged.

## 2. Link spans
- [x] 2.1 Record spans in both `link()` branches and carry them in the parse cache.

## 3. Hit-testing and opener
- [x] 3.1 Add `src/tui/linkHit.js` and register markdown blocks in `messageBubble.js`.
- [x] 3.2 Add `src/tui/openUrl.js`.

## 4. Wiring
- [x] 4.1 Pass the gated click handler from `app.js`.

## 5. Tests and verification
- [x] 5.1 Unit tests for click-vs-drag, spans, hit-testing, protocol filtering, drag-on-link.
- [x] 5.2 `npm run lint`, tests and coverage; manual terminal verification noted as outstanding.
