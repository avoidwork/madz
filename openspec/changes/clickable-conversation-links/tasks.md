# Tasks

## 1. Click detection
- [ ] 1.1 Add `onClick` to `useMouseScroll`, leaving the selection path unchanged.

## 2. Link spans
- [ ] 2.1 Record spans in both `link()` branches and carry them in the parse cache.

## 3. Hit-testing and opener
- [ ] 3.1 Add `src/tui/linkHit.js` and register markdown blocks in `messageBubble.js`.
- [ ] 3.2 Add `src/tui/openUrl.js`.

## 4. Wiring
- [ ] 4.1 Pass the gated click handler from `app.js`.

## 5. Tests and verification
- [ ] 5.1 Unit tests for click-vs-drag, spans, hit-testing, protocol filtering, drag-on-link.
- [ ] 5.2 `npm run lint`, tests and coverage; manual terminal verification noted as outstanding.
