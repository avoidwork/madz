## 1. Remove duplicate skills prompt injection

- [x] 1.1 Delete `buildSkillsMapping()` function and its call site from `src/agent/deepAgents.js`

## 2. Normalize skill path formats

- [x] 2.1 Change `getSkillPathsForAgent()` in `src/skills/registry.js` to return relative paths via `#relativePath()`
