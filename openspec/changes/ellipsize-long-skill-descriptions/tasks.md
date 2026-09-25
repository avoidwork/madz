## 1. Implementation

- [ ] 1.1 Add a named constant `DESCRIPTION_MAX_LENGTH = 500` and a pure `truncateDescription(desc, max = DESCRIPTION_MAX_LENGTH)` helper in `src/tui/skillsPanel.js`
- [ ] 1.2 Apply the truncation at render time in `src/tui/skillsPanel.js` so the description line uses the truncated value while leaving `skill.description` untouched

## 2. Testing

- [ ] 2.1 Add unit tests in `tests/unit/tui/skillsPanel.test.js` covering: description under the threshold renders unchanged, description over the threshold is truncated with an ellipsis, and a description exactly at the threshold is not truncated
- [ ] 2.2 Verify `npm run test`, `npm run lint`, and `npm run coverage` pass
