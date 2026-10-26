## 1. Fix the git tool cwd resolution

- [ ] 1.1 Import `getProjectCwd` from `../../workspace/project.js` and `config` from `../../config/loader.js` in `src/tools/git/index.js`
- [ ] 1.2 Change `const cwd = options.cwd;` to `const cwd = options.cwd || getProjectCwd() || config.cwd || process.cwd();` in `gitImpl`

## 2. Fix the process tool cwd resolution

- [ ] 2.1 Import `getProjectCwd` from `../../workspace/project.js` and `config` from `../../config/loader.js` in `src/tools/process/index.js`
- [ ] 2.2 Replace `cwd: process.cwd()` in `executeForeground` with `cwd: getProjectCwd() || config.cwd || process.cwd()`
- [ ] 2.3 Replace `cwd: process.cwd()` in `executeBackground` with `cwd: getProjectCwd() || config.cwd || process.cwd()`

## 3. Add regression tests

- [ ] 3.1 Add cwd-resolution tests to `tests/unit/tools/git.test.js` (git status succeeds against selected project; explicit options.cwd overrides)
- [ ] 3.2 Add cwd-resolution tests to `tests/unit/tools/process.test.js` (process pwd resolves to active project cwd)

## 4. Verify

- [ ] 4.1 Run `npm run test`
- [ ] 4.2 Run `npm run lint`
- [ ] 4.3 Run `npm run coverage`
