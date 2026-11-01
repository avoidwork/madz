# Tasks

## 1. Fix the npm cache ownership ordering

- [ ] 1.1 In `Dockerfile`, add `ENV NPM_CONFIG_CACHE=/home/madz/.npm` in the runtime stage so the cache path is explicit and stable (verify the line is present and the path matches the `HOME`-derived cache location).
- [ ] 1.2 In `Dockerfile`, add `RUN chown -R madz:node /home/madz/.npm` immediately after the global npm installs (after the `npm install -g @fission-ai/openspec@latest` line) so the cache is re-owned by `madz:node` after every global install (verify the chown appears after both `npm install -g` lines).
- [ ] 1.3 In `Dockerfile`, add a build-time assertion `RUN test "$(stat -c '%U' /home/madz/.npm)" = madz` after the re-chown so the build fails if the cache is not owned by `madz` (verify the assertion line is present and runs after the re-chown).

## 2. Verify

- [ ] 2.1 Build the image (`npm run docker:build`) and assert `stat -c '%U:%G' /home/madz/.npm` returns `madz:node` in the built image; confirm the build-time assertion passes and the build succeeds. If a Docker daemon is unavailable in the build environment, verify the assertion logic by inspecting the Dockerfile ordering and note that the build assertion is the regression guard.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
