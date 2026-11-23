# Tasks

## 1. Fix parseArgs

- [ ] 1.1 Declare the `--message` option in `parseArgs()` in `index.js` and read it before falling back to positional args. Verify `parseArgs(["--message", "hello"]).message === "hello"` and `parseArgs(["hello"]).message === "hello"` and `parseArgs([]).message === undefined`.

## 2. Add unit test

- [ ] 2.1 Add a pure parsing unit test covering the `--message` flag form, the positional form, and the empty case. Verify the test passes without any LLM/network call.

## 3. Verify

- [ ] 3.1 Run `npm run test` and `npm run lint` and confirm no regressions.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
