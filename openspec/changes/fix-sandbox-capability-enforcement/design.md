## Context

The sandbox runner (`src/sandbox/runner.js`) spawns child processes to execute skill scripts in isolation. It calls `enforceCapabilities(permissions)` to map skill permissions to resource access rules, but the result is stored in an unused `_rules` variable and never applied to the spawned process. This means spawned processes have unrestricted access regardless of the permissions granted to the skill.

## Goals / Non-Goals

**Goals:**
- Apply the `resources` array from `enforceCapabilities()` to the spawned child process
- Use Node.js `--permission` flag to enforce capability restrictions on Node.js scripts
- Ensure existing tests continue to pass
- Add test coverage for permission enforcement

**Non-Goals:**
- Modifying `enforceCapabilities()` function (it works correctly)
- Supporting `--permission` flag for non-Node.js interpreters (python, bash, ruby, etc.)
- Adding new permission types or changing the permission model

## Decisions

1. **Use `resources` array, not `rules` object**: The `resources` array contains the original permission strings (e.g., `filesystem:read`, `network:outbound`) which are directly compatible with Node.js's `--permission` flag. The `rules` object contains structured `{ resource, action }` pairs that would require additional transformation.

2. **Gate on Node.js scripts only**: The `--permission` flag is Node.js-specific (v20.0+). Adding it to non-Node.js scripts (python, bash, ruby, etc.) would cause errors. We only add the flag when `ext === "js" || ext === "mjs"`.

3. **Add to `execArgv`, not `args`**: Node.js flags like `--permission` belong in `execArgv` (passed to the Node.js binary itself), not in `args` (passed as script arguments). This aligns with the existing pattern for `--max-old-space-size=512`.

4. **Only apply when non-empty**: If `resources.length === 0` (no permissions granted), don't add the `--permission` flag. This avoids passing an empty or meaningless flag.

## Risks / Trade-offs

- **Node.js version compatibility**: The `--permission` flag requires Node.js v20.0+. If an older version is used, the flag will cause an error. → Mitigation: Only applied when permissions are explicitly granted, and the project requires Node.js 24+ per skill compatibility.
- **Non-Node.js scripts unaffected**: Python, bash, ruby, and other scripts won't have capability restrictions enforced. → Mitigation: This is acceptable as the `--permission` flag is Node.js-specific. Other interpreters would need their own sandboxing mechanisms.
- **Minimal change scope**: This is a surgical fix to a single line. → Mitigation: Low risk of introducing regressions.

## Migration Plan

No migration needed. This is a bug fix that makes the sandbox behave as originally intended. The change is backward compatible — processes that had no permissions specified will continue to work as before (no `--permission` flag added).

## Open Questions

None. The fix is straightforward and well-understood.