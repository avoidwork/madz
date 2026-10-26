## 1. Fix the git tool cwd resolution

- [x] 1.1 Import `getProjectCwd` from `../../workspace/project.js` and `config` from `../../config/loader.js` in `src/tools/git/index.js`
- [x] 1.2 Change `const cwd = options.cwd;` to `const cwd = options.cwd || getProjectCwd() || config.cwd || process.cwd();` in `gitImpl`

## 2. Fix the process tool cwd resolution

- [x] 2.1 Import `getProjectCwd` from `../../workspace/project.js` and `config` from `../../config/loader.js` in `src/tools/process/index.js`
- [x] 2.2 Replace `cwd: process.cwd()` in `executeForeground` with `cwd: getProjectCwd() || config.cwd || process.cwd()`
- [x] 2.3 Replace `cwd: process.cwd()` in `executeBackground` with `cwd: getProjectCwd() || config.cwd || process.cwd()`

## 3. Add regression tests

- [x] 3.1 Add cwd-resolution tests to `tests/unit/tools/git.test.js` (git status succeeds against selected project; explicit options.cwd overrides)
- [x] 3.2 Add cwd-resolution tests to `tests/unit/tools/process.test.js` (process pwd resolves to active project cwd)

## 4. Verify

- [x] 4.1 Run `npm run test`
- [x] 4.2 Run `npm run lint`
- [x] 4.3 Run `npm run coverage`
