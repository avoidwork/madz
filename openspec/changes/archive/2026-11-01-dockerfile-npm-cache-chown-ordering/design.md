# Design

## Context

See proposal.md for motivation. In the final stage of `Dockerfile`, `ENV HOME=/home/madz`
(line 53) makes npm resolve its cache to `/home/madz/.npm`. The global installs
`npm install -g yarn pnpm` (line 67) and `npm install -g @fission-ai/openspec@latest`
(line 70) run as root and populate that cache as root. The earlier
`RUN chown -R madz:node /app /home/madz` (line 57) runs *before* those installs, so it
cannot fix the cache. The result is a root-owned `/home/madz/.npm` and `EACCES` for the
`madz` user at runtime.

## Goals / Non-Goals

**Goals:**
- Ensure `/home/madz/.npm` is owned by `madz:node` after all global npm installs.
- Make the fix robust so a future global install cannot silently re-break ownership.
- Fail the build loudly if the cache is not owned by `madz`.

**Non-Goals:**
- No change to which packages are installed, their versions, or the builder stage.
- No change to `docker-entrypoint.sh` (its ownership logic is already correct).
- No unit test for Dockerfile ownership (no such infrastructure exists).

## Decisions

- **Explicit re-chown after the global installs, not merely moving line 57.**
  Adding `RUN chown -R madz:node /home/madz/.npm` immediately after the global installs
  (after line 70) is the primary fix.
  - *Alternative considered:* move the line-57 `chown -R madz:node /app /home/madz` to
    after the global installs. Rejected as the sole fix because a future global install
    added later would re-break ownership. The explicit re-chown stays authoritative as
    long as it remains the last ownership operation on the cache.
- **Pin `ENV NPM_CONFIG_CACHE=/home/madz/.npm`.** Makes the cache path explicit and
  stable rather than implicitly derived from `HOME`, so the chown target is unambiguous
  and intent is documented.
  - *Alternative considered:* rely on `HOME`-derived cache resolution. Rejected — implicit
    resolution is the very thing that made the bug subtle.
- **Build-time assertion `RUN test "$(stat -c '%U' /home/madz/.npm)" = madz`.** Fails the
  build if the cache is not owned by `madz`, guaranteeing the regression cannot ship.
  - *Alternative considered:* a runtime check in `docker-entrypoint.sh`. Rejected — a
    runtime check lets a broken image ship; a build-time check is stricter and catches the
    problem at build time.
- **`stat -c '%U'` (GNU coreutils).** Present in `node:26-slim` (Debian-based), so the
  assertion is portable to the existing base image. No new dependency.

## Risks / Trade-offs

- [A future global install added after the re-chown re-breaks ownership] → The build-time
  assertion catches it: the build fails until the re-chown is moved after the new install.
- [`stat -c` unavailable on a non-GNU base] → The base is `node:26-slim` (Debian), which
  ships GNU coreutils; risk is negligible. If the base ever changes to a non-GNU image, the
  assertion would need `stat -f '%Su'` (BSD) — noted for maintainers.
- [Pinning `NPM_CONFIG_CACHE` changes cache location for any tool that reads it] → The
  pinned path equals the `HOME`-derived path (`/home/madz/.npm`), so behavior is unchanged;
  the pin only makes it explicit.

## Migration Plan

- No data migration. The change is a Dockerfile edit; the next image build picks it up.
- Rollback: revert the `Dockerfile` change and rebuild.

## Open Questions

- None.
