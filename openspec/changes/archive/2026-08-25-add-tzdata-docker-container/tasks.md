# Tasks

- [ ] 1. Read the Dockerfile and identify the `apk add` line in the runtime stage (line 20)
- [ ] 2. Append `tzdata` to the existing `apk add --no-cache` command on line 20
- [ ] 3. Verify no `ENV TZ` is set in the Dockerfile (confirm UTC default behavior)
- [ ] 4. Read `docker-entrypoint.sh` and confirm it does not set or override `TZ`
- [ ] 5. Verify the Dockerfile builds successfully (dry-run or full build)
- [ ] 6. Verify timezone resolution works: `docker run --rm <image> date` shows UTC, `docker run --rm -e TZ=America/Toronto <image> date` shows Eastern Time
- [ ] 7. Run `npm run test` and `npm run coverage` to confirm no regressions
