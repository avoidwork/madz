## Context

The project uses DeepAgents' CompositeBackend for filesystem routing. Currently two backends exist:
- coreBackend.js — FilesystemBackend sandboxed to process.cwd()
- contextBackend.js — FilesystemBackend sandboxed to memory/context/

The CompositeBackend is instantiated in `src/agent/deepAgents.js` with coreBackend at "/" and contextBackend at the context directory path. Subagents need dedicated backends to access src/, prompts/, tmp/, and workspace/ directories.

Existing backends follow a simple pattern: import FilesystemBackend from "deepagents", call with rootDir and virtualMode: true.

```
┌──────────────────────────────────────┐
│         CompositeBackend             │
│  ┌──────────┬────────────────┐       │
│  │   "/"    │ coreBackend    │       │
│  ├──────────┼────────────────┤       │
│  │ /memory  │ contextBackend │       │
│  ├──────────┤                │       │
│  │ /src     │ srcBackend     │       │
│  ├──────────┤                │       │
│  │ /prompts │ promptsBackend │       │
│  ├──────────┤                │       │
│  │ /tmp     │ tmpBackend     │       │
│  ├──────────┤                │       │
│  │ /workspace│ workspaceBack │       │
│  └──────────┴────────────────┘       │
└──────────────────────────────────────┘
```

## Goals / Non-Goals

**Goals:**
- Create four backend modules following the existing pattern (coreBackend, contextBackend)
- Wire all backends into the CompositeBackend in deepAgents.js
- Keep backends simple — one function each, no config loading needed

**Non-Goals:**
- Do NOT add permissions or capabilities to backends — they remain plain FilesystemBackend instances
- Do NOT change subagent tool routing or access control — that's future work
- Do NOT create workspace/ directory at build time — it should exist or be created separately
- Do NOT add tests for CompositeBackend integration — backends are trivial factories

## Decisions

1. **Backend modules mirror existing pattern.** Each backend is a single function that returns `new FilesystemBackend({ rootDir: join(cwd, "dir/"), virtualMode: true })`. The src/ and prompts/ directories already exist at the project root. The tmp/ directory is referenced in Docker volumes in README.md. The workspace/ directory is a new directory.

2. **Backends use cwd parameter, defaulting to process.cwd().** This matches contextBackend's pattern and allows testing flexibility. The coreBackend does not accept a cwd parameter (it always uses process.cwd()), but the new backends all follow contextBackend's approach for consistency and testability.

3. **Route paths are `/src`, `/prompts`, `/tmp`, `/workspace`.** This uses forward slashes to create clear route segments under the project root, matching how composite backend routing works.

4. **All backends are created in deepAgents.js, not lazily.** Since the orchestrator initialization already creates coreBackend and contextBackend synchronously, new backends follow the same pattern for consistency.

## Risks / Trade-offs

- [Risk: tmp/ directory may not exist] → **Mitigation:** FilesystemBackend with virtualMode: true creates files on-demand without needing the directory to pre-exist.
- [Risk: workspace/ directory does not exist] → **Mitigation:** Same — virtualMode handles on-demand creation.
- [Risk: CompositeBackend routing complexity] → **Mitigation:** The deepagents library handles route matching. Adding more backends is additive and doesn't affect existing routes.
