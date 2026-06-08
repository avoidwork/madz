## 1. Add shebang and bin to index.js

- [ ] 1.1 Add `#!/usr/bin/env node` as line 1 of `index.js`
- [ ] 1.2 Verify `process.argv[1]` detection in `index.js` is compatible with shebang execution (no false positives from Node.js requiring the file)

## 2. Update package.json

- [ ] 2.1 Add `"bin": "index.js"` to `package.json`
- [ ] 2.2 Add `"files"` field listing: `["index.js", "src/", "config.yaml", "memory/", "skills/", "README.md", "LICENSE"]`
- [ ] 2.3 Verify `main` field still points to `index.js` (it already does, confirm no change needed)
- [ ] 2.4 Confirm all runtime dependencies (`ink`, `react`, `@langchain/langgraph`, `js-yaml`, etc.) are in `dependencies` not `devDependencies`
- [ ] 2.5 Preserve all existing Docker scripts (`docker:build`, `docker:push`, `docker:release`, etc.)

## 3. Verify argument parsing covers bin use cases

- [ ] 3.1 Verify `--mode interactive` argument parsing from `index.js:213-215` works when launched as `madz --mode interactive`
- [ ] 3.2 Verify `--session-id` / `-s` flag parsing from `index.js:231-234` works when launched as `madz "msg" --session-id abc`
- [ ] 3.3 Verify the `--json` flag mentioned in README is implemented (check if it exists; if not, note as out-of-scope)
- [ ] 3.4 Verify default message `"Hello"` fallback from `index.js:239` works when no args are given

## 4. Pre-publish validation

- [ ] 4.1 Run `npm pack` to verify tarball contents exclude `tests/`, `.husky/`, `.oxlint.json`, etc.
- [ ] 4.2 Extract tarball and verify `index.js` has shebang and is executable
- [ ] 4.3 Run full test suite: `npm run test` and `npm run coverage` — all pass
- [ ] 4.4 Run lint/format: `npm run lint` — no errors
