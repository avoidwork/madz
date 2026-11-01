# Proposal

## Why

In the final stage of `Dockerfile`, `RUN chown -R madz:node /app /home/madz` (line 57)
runs *before* the global npm installs `npm install -g yarn pnpm` (line 67) and
`npm install -g @fission-ai/openspec@latest` (line 70). Because `ENV HOME=/home/madz`
(line 53) makes npm resolve its cache to `/home/madz/.npm`, those root-run installs
populate that cache as `root`, and nothing re-chowns it afterward. The `madz` user then
hits `EACCES` on `/home/madz/.npm` at runtime. This change fixes the ordering and makes
the ownership robust and self-verifying.

## What Changes

- Add an explicit `RUN chown -R madz:node /home/madz/.npm` immediately after the global
  npm installs (after line 70), so the cache is re-owned by `madz:node` after every
  global install.
- Pin `ENV NPM_CONFIG_CACHE=/home/madz/.npm` so the cache path is explicit and stable
  rather than implicitly derived from `HOME`.
- Add a build-time assertion `RUN test "$(stat -c '%U' /home/madz/.npm)" = madz` that
  fails the build if the cache is not owned by `madz`, so the regression cannot ship.
- Leave the existing line-57 `chown -R madz:node /app /home/madz` in place; the new
  explicit cache re-chown + assertion is the authoritative ownership check for the cache.

## Capabilities

### New Capabilities
- `dockerfile-npm-cache-ownership`: The Dockerfile runtime stage SHALL ensure the npm
  cache directory (`/home/madz/.npm`) is owned by `madz:node` after all global npm
  installs, SHALL pin the cache path via `NPM_CONFIG_CACHE`, and SHALL fail the build if
  the cache is not owned by `madz`.

### Modified Capabilities
- None.

## Impact

- **Code:** `Dockerfile` (final stage, lines 53–70 region).
- **No source-code or test changes.** This is a build/CI tooling fix. There is no
  unit-test infrastructure for Dockerfile ownership; the build-time assertion *is* the
  regression guard.
- **No new dependencies.** `stat` (GNU coreutils) is present in `node:26-slim`.

## Non-goals

- Changing which global packages are installed, their versions, or the builder stage.
- Changing runtime behavior other than correct cache ownership.
- Changing `docker-entrypoint.sh` ownership logic (already correct).
- Adding a unit test for Dockerfile ownership (no such infrastructure exists).
