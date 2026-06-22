## Context

The `src/logger.js` module implements a dual-file logging strategy using pino. It writes info/warn/debug messages to `madz.log` and error/fatal messages to `madz_error.log`. The current implementation uses `pino.multistream(streams)`, which was deprecated in pino v9 and removed in pino v10. The application's `package.json` specifies `"pino": "^10.3.1"`, so the code is incompatible with its declared dependency.

The logger module handles OS-specific log directory detection (Alpine, Linux, macOS, Windows), graceful fallback to `/tmp` if the primary directory is unwritable, and silent mode for tests. All of this logic is sound — only the final `pino()` constructor call needs updating.

## Goals / Non-Goals

**Goals:**
- Replace `pino.multistream(streams)` with the pino v10-compatible array-based destination API
- Preserve all existing behavior: dual-file routing, fallback logic, silent test mode, exported logger interface
- Remove the deprecated TODO comment

**Non-Goals:**
- Changing log format, structure, or verbosity
- Modifying log directory detection or fallback logic
- Adding new logging capabilities or transports
- Changing the exported logger API

## Decisions

### Decision: Use array syntax as second argument to `pino()`

**Rationale:** Pino v10 accepts an array of destinations as the second argument to the constructor. Each array element can be a stream object with `{ stream, level }` properties — exactly the structure already being built in the current code. This is a drop-in replacement requiring a single-line change.

**Alternatives considered:**
- `pino.destination()` with transport targets: More verbose, requires `pino/file` package for file destinations, overkill for this use case
- Custom transport: Unnecessary complexity for a simple file-routing scenario
- Keeping multistream with a pino v9 downgrade: Violates the declared dependency in package.json

### Decision: Accept changed error log routing

**Rationale:** The original `multistream()` routed error/fatal to both streams. The v10 array API routes each level to streams matching that level or higher. This means error logs will write to `madz_error.log` only, not `madz.log`. This is the more correct behavior for a dedicated error log and aligns with common logging practices.

**Impact:** Users who relied on errors appearing in `madz.log` will see them only in `madz_error.log` going forward. This is a behavioral correction, not a regression.

## Risks / Trade-offs

- **[Risk]** Error logs no longer appear in `madz.log` → **[Mitigation]** This is intentional and more correct. Document the change in the PR description.
- **[Risk]** Stream objects in array may need different structure than multistream expected → **[Mitigation]** The pino v10 docs confirm `{ stream, level }` objects are supported. The existing `streams` array already uses this structure.

## Migration Plan

1. Apply the code change to `src/logger.js`
2. Run the full test suite to verify no regressions
3. Verify the application starts without TypeError
4. Verify logs are written to the correct files

No rollback strategy needed — this is a single-file fix with no data migration.

## Open Questions

None. The fix is a straightforward API replacement.