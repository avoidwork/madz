## 1. Add dependency

- [ ] 1.1 Add `piscina` (^5.3.2) to `package.json` dependencies

## 2. Create worker entry file

- [ ] 2.1 Create `src/vector/indexer.worker.js` that accepts plain project config, creates the store + embedder internally, and calls `reindex`

## 3. Modify indexCode tool

- [ ] 3.1 Modify `src/tools/code/indexCode.js` to dispatch project config to a Piscina pool and await the result
- [ ] 3.2 Preserve the `indexCode` tool schema (`project`, `force`) and the `${name}: ${indexed} indexed, ...` return format
- [ ] 3.3 Handle pool errors gracefully, returning `${name}: error — ${err.message}` on failure

## 4. Add tests

- [ ] 4.1 Add `tests/unit/tools/codeIndex.test.js` mocking the Piscina pool's `run` method
- [ ] 4.2 Cover: no projects configured, unknown project, pool error, force re-index

## 5. Verify

- [ ] 5.1 Run `npm run test`
- [ ] 5.2 Run `npm run lint`
- [ ] 5.3 Run `npm run coverage`
