## Context

`madz` is currently distributed only via Docker. The entry point `index.js` is a dual-mode script:
- **Interactive TUI** (`--mode interactive`) — Ink-based terminal UI
- **Chat mode** (default) — single-prompt, single-response via stdin or CLI args

The file already uses `process.argv[1] === fileURLToPath(import.meta.url)` to detect standalone execution. No `bin` field exists in `package.json`, so `npm install -g madz` would not create a `madz` command.

## Goals / Non-Goals

**Goals:**
- Make `madz` installable via `npm install -g madz` with a `madz` command on PATH
- Support both modes (interactive TUI and chat) through bin invocation
- Preserve the existing Docker distribution path
- Keep package.json compatible with current dev tooling (lint, test, coverage)

**Non-Goals:**
- Migrating away from Docker (Docker distribution continues unchanged)
- Adding new CLI arguments beyond what's already in index.js
- Changing the package name or major version bump

## Decisions

1. **Shebang on `index.js`** — Add `#!/usr/bin/env node` as the first line so the file is directly executable. Rationale: npm requires executable scripts to have a shebang. Using `env node` ensures portability.

2. **`bin` field in `package.json`** — Set `"bin": "index.js"`. Rationale: Minimal mapping. Users run `madz` and get the default chat mode, or `madz --mode interactive` for the TUI.

3. **No `esm` wrapper** — `index.js` already uses top-level await and `"type": "module"` in package.json. No need for a separate wrapper script.

4. **Keep `main` as `index.js`** — The module is also importable (exports config, sessionState, etc. at the bottom). Keeping `main` doubles as the bin target which is a common npm pattern.

5. **Add `files` field** — Explicitly list what gets published so irrelevant files (.husky, tests, devDeps configs) are excluded.

6. **Remove Docker push scripts from package.json** — The docker:push/docker:release scripts reference `$DOCKER_USER` which is a CI concern. Remove them from the default package.json to avoid exposing CI assumptions, but keep them as separate npm scripts users can add.

Actually, on reflection: **keep the docker scripts**. They only activate when env vars are set (e.g. `$DOCKER_USER`), and the Docker workflow is a first-class distribution channel for this project. Removing them would break the existing release process.

## Risks / Trade-offs

- **[Risk]** The TUI (Ink) requires React and ink dependency which are not devDeps. → They are already in `dependencies`, so `npm install -g` will install them. No issue.
- **[Risk]** Shebang line changes `index.js` git diff on every commit. → Add to `.oxlintignore` or ensure no lint tool treats shebang as a warning. This is standard practice; the shebang is ignored by Node.js when imported.
- **[Trade-off]** Adding `bin` means the package becomes both a library and a CLI. → This is fine; many npm packages do both (e.g., `jest`, `prettier`). The exports at the bottom of `index.js` work for importers; the bin entry works for CLI users.