# Design

## Context

See proposal.md — Why. App-centric tools are generated and destroyed dynamically on demand, and each generation reads the live `process.cwd()` (or `config.cwd`, which mirrors it). `config.cwd` is set to `process.cwd()` in `src/config/loader.js` and is intentionally moved by the TUI via `safeChdir()` when the user switches projects. Because tools capture the cwd at generation time, a tool generated after a `/projects` switch writes app files into the project instead of the app root. See specs `app-root-path`, `config-system`, and `tui-project-cwd`.

## Goals / Non-Goals

**Goals:**
- Introduce a single immutable `config.appPath` captured once at bootstrap, before any chdir.
- Route all app-file-writing tools/consumers to resolve against `loadConfig().appPath`.
- Keep `config.cwd` semantics intact for TUI project-switching display.
- Validate `appPath` to an absolute, existing directory at bootstrap.
- Add a regression test that fails if `appPath` is removed.

**Non-Goals:**
- No runtime mutation API for `appPath` (supersedes #2103).
- No change to project discovery/listing.
- No change to `config.cwd` tracking behavior.

## Decisions

### Decision 1: One frozen config field over a setConfig API
`appPath` is a plain string field on the config object, pinned once in `doBootstrap()`. This is simpler and safer than the validated `setConfig()` API + module-unfreezing in #2103: it cannot be re-pointed at runtime, which is exactly the invariant we want.
*Alternative considered:* the #2103 approach (validated mutation API, unfreeze 7 modules) — rejected as more complex and unnecessary.

### Decision 2: Pin in `doBootstrap()`, not in `loadConfig()`
`loadConfig()` runs on every call and always sets `config.cwd = process.cwd()`. Pinning `appPath` there would re-capture the cwd on each call and defeat the purpose. `doBootstrap()` runs exactly once, before any `safeChdir()`, so `config.cwd` there equals the true app root. We set `config.appPath` from that value immediately after `config = loadConfig()` in `doBootstrap()`.
*Alternative considered:* setting `appPath` inside `loadConfig()` — rejected because `loadConfig()` is called repeatedly and after chdir.

### Decision 3: Read `loadConfig().appPath` at resolution time in app-centric modules
The seven app-centric modules currently capture `const cwd = config.cwd` / `loadConfig().cwd` at module load. Since these modules are re-imported dynamically per tool generation, reading `loadConfig().appPath` as the default parameter value (or at the point of resolution) yields the stable app root each time. Exported signatures and default-parameter behavior are preserved — callers passing an explicit `cwdParam` still override.
*Alternative considered:* mutating the frozen module-level `cwd` constant — rejected; the constant is captured at import and the whole point is to stop trusting the mutable cwd.

### Decision 4: `config.cwd` stays for display; only app-file writers switch
`src/tui/app.js` calls `safeChdir(config.cwd || process.cwd())` and the TUI status bar displays the active project. Those consumers keep `config.cwd`. Only consumers that place app files switch to `appPath`.

### Decision 5: Code-search and output-dir scoping
The code-search index DB path (`src/tools/code/searchCode.js`) and the pptx/tts default output directories are treated as app-scoped (they are part of the harness's own state, not the user's project). The `pptx` `alloweddir || process.cwd()` default is switched to the app root so generated files land in the app workspace, not an arbitrary cwd.

## Risks / Trade-offs

- [A module cached at import reads a stale appPath] → Mitigation: app-centric modules read `loadConfig().appPath` at resolution time (default-param or inline), and `loadConfig()` returns the cached config whose `appPath` was pinned once at bootstrap.
- [Empty `appPath` when cwd is unresolvable] → Mitigation: bootstrap normalizes via `path.resolve` and confirms existence; if it cannot, `appPath` stays `""` and tools fall back to their existing default behavior rather than crashing. The regression test exercises the populated case.
- [Switching a project-scoped consumer by mistake] → Mitigation: code search is reviewed and treated as app-scoped for its index location; TUI display consumers are explicitly left on `config.cwd`.
- [Regression test uses `process.chdir()` and pollutes other tests] → Mitigation: restore `process.cwd()` in `afterEach` and use a temp directory for the fake project.

## Migration Plan

No deployment migration: `appPath` defaults to `""` and is populated at runtime by bootstrap. No `config.yaml` change is required. Rollback is a normal revert of the branch; since `appPath` is additive and unused by callers that still read `config.cwd`, reverting restores prior behavior exactly.

## Open Questions

None.
