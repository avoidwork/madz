## Why

`madz` is distributed via Docker but not publishable to npm as a CLI tool. Users cannot install it globally via `npm install -g madz` to run it from anywhere in their terminal. The entry point `index.js` already supports two execution modes (interactive TUI and single-prompt chat mode) gated behind `process.argv[1]` detection, but there is no `bin` field in `package.json` to expose it as a command-line tool.

## What Changes

- Add `bin` field to `package.json` pointing to `index.js` with a `#!/usr/bin/env node` shebang
- Update `package.json` to mark required runtime dependencies (not devDeps) as installable — remove Docker-specific build scripts
- Ensure `index.js` has a proper shebang line so it's directly executable after npm install
- Verify argument parsing in `index.js` handles bin invocation correctly (--json flag, --session-id/-s, --mode)

## Capabilities

### New Capabilities
- `npm-publish`: Publish `madz` to npm with proper `bin` field, shebang, and package metadata so users can install it globally via `npm install -g madz` and run `madz` from the terminal

### Modified Capabilities
- `docker-build`: Adjust Docker build scripts to not duplicate `bin` functionality; npm publish becomes the standard distribution path for CLI usage

## Impact

- `package.json` — adds `bin`, removes Docker push scripts from defaults, updates `main`/`files` if needed
- `index.js` — adds shebang line, ensures mode detection works when invoked as a bin command
- CI/release workflow — a separate release process can use `npm publish` after tests pass