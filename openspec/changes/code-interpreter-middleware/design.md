## Context

The madz orchestrator agent currently calls tools sequentially — one tool invocation per LLM turn. For workflows that require loops, parallel execution, or conditional branching, the orchestrator must emit dozens of individual tool calls, exhausting context window and increasing latency. The existing `process` tool (spawn-based Node.js) is heavier and lacks state persistence across calls.

The sandbox layer (`src/sandbox/`) already provides security primitives: path resolution, URL filtering, environment injection, capability enforcement, and timeout handling. A QuickJS-based VM layer reuses these patterns for JavaScript execution.

## Goals / Non-Goals

**Goals:**
- Expose an `eval` tool to the orchestrator that executes JavaScript in a sandboxed QuickJS VM
- Support three persistence modes: `thread` (state across turns), `turn` (state within a turn), `call` (fresh REPL per call)
- Optionally expose existing agent tools as JS functions (PTC) from within the VM
- Optionally expose subagent dispatch (`task()`) from within the VM
- Enforce memory limits, execution timeouts, and URL filtering within the VM
- Provide HMAC-signed snapshot/restore for state persistence in `thread` mode
- Integrate seamlessly with the existing orchestrator creation flow
- Make the feature fully configurable and opt-in (disabled by default)

**Non-Goals:**
- Replacing the existing `process` tool for general-purpose shell execution
- Building a full workflow engine or DAG-based orchestration system
- Supporting languages other than JavaScript in the VM
- Persisting VM state to disk (in-memory only)
- Multi-tenant VM isolation (single-tenant per instance)
- Hot-reloading or live-editing of VM state

## Decisions

### Decision 1: QuickJS over Node.js child_process
**Choice:** Use `quickjs-emscripten-core` (QuickJS WASM) for VM execution.
**Rationale:** QuickJS starts in milliseconds (vs. 100-500ms for Node.js child_process), uses minimal memory (~5MB baseline), and supports state persistence within a single JS context. The madz codebase already has familiarity with QuickJS in its sandbox layer. Node.js child_process is retained for the existing `process` tool where full Node.js capabilities are needed.
**Alternatives considered:**
- `vm2` — unmaintained, known security issues
- `isolated-vm` — native addon, harder to build cross-platform
- WebAssembly custom engine — overkill, no existing familiarity

### Decision 2: In-process VM, not separate service
**Choice:** Run QuickJS in-process within the Node.js process.
**Rationale:** No IPC overhead, no separate process management, no network security concerns. The sandbox primitives (memory limits, timeouts, URL filtering) are applied at the JS level within the VM context.
**Alternatives considered:**
- Separate QuickJS service via IPC — adds complexity, network security surface
- Docker container per eval — too heavy, slow startup

### Decision 3: HMAC-signed snapshots (not encrypted)
**Choice:** Sign snapshots with HMAC-SHA256 but do not encrypt.
**Rationale:** The VM state is already sandboxed — it runs in a restricted JS context with no filesystem access and filtered network. Encryption adds complexity without meaningful security benefit since the snapshot is in-memory and per-instance. HMAC prevents tampering by external actors or corrupted state.
**Alternatives considered:**
- Full encryption — unnecessary complexity for in-memory state
- No signing — vulnerable to tampering

### Decision 4: String-based tool results
**Choice:** All tool results exposed to the VM are strings.
**Rationale:** Consistent with the existing tool interface in madz. Avoids serialization complexity (JSON, binary, etc.). The orchestrator agent (LLM) naturally works with text.
**Alternatives considered:**
- Structured JSON results — would require the LLM to parse structured data, which is less reliable
- Mixed types (string, number, error) — complicates the VM API

### Decision 5: Opt-in PTC and subagent dispatch
**Choice:** Both PTC (`tools.<name>()`) and subagent dispatch (`task()`) are disabled by default and must be explicitly enabled via config.
**Rationale:** These are powerful capabilities with potential side effects (email, calendar, filesystem writes). The principle of least privilege applies — the orchestrator should only have access to what is explicitly configured.
**Alternatives considered:**
- Always enabled — too permissive, security risk
- Enabled by default with opt-out — follows madz's existing pattern but is less secure for this feature

### Decision 6: Middleware pattern via deepagents
**Choice:** Use the `createMiddleware` pattern from deepagents to integrate the eval tool and wrapModelCall.
**Rationale:** Consistent with how deepagents handles middleware composition. The middleware can inject the eval tool and modify model calls without touching the existing orchestrator code.
**Alternatives considered:**
- Wrapping the orchestrator after creation — more fragile, harder to maintain
- Inline tool registration — couples the eval tool directly to deepAgents.js

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| QuickJS WASM initialization slow on first call | Cache the initialized module; document cold-start latency |
| VM state grows unbounded in `thread` mode | Enforce `maxResultChars` truncation; add snapshot size limits |
| Recursive subagent calls (VM → subagent → VM) | Add depth limit (configurable, default 5); track depth in snapshot |
| Large tool results overwhelm the VM | Truncate results to `maxResultChars`; PTC proxy enforces per-tool limits |
| QuickJS security bypass | Sandboxed fetch with URL filtering; no filesystem access; memory limits; timeout enforcement |
| Breaking existing orchestrator when middleware is enabled | Middleware is opt-in; when disabled, behavior is identical to current |
| `quickjs-emscripten-core` dependency issues | Pin version; test on target platforms (Linux amd64, Linux arm64); provide graceful fallback |

## Migration Plan

1. **Phase 1 — Core VM:** Implement `src/sandbox/vm.js` with basic execution, timeout, and memory limits. No PTC or subagent dispatch.
2. **Phase 2 — Persistence:** Add snapshot/restore (`src/sandbox/vm/snapshot.js`) and `thread` mode support.
3. **Phase 3 — Tool Proxies:** Add PTC (`src/sandbox/vm/ptc.js`) and subagent dispatch (`src/sandbox/vm/task.js`).
4. **Phase 4 — Middleware Integration:** Wire everything together in `src/agent/codeInterpreter.js` and integrate into `deepAgents.js`.
5. **Phase 5 — Config & Tests:** Add Zod schema, update `config.yaml`, write unit and integration tests.

No rollback strategy needed — the feature is opt-in and disabled by default. If issues arise, users can set `codeInterpreter.enabled: false` in config.yaml.

## Open Questions

1. **Default PTC tool whitelist:** Which tools should be in the default whitelist when `ptcEnabled: true`? Suggestion: `readFile`, `writeFile`, `grep`, `ls`, `glob`, `json`, `yaml`, `data`, `process` — read-heavy tools that are safe for general use.
2. **Snapshot storage location:** Currently in-memory only. Should snapshots be persisted to disk for crash recovery? (Out of scope for v1 — in-memory is sufficient for the target use case.)
3. **Concurrent eval calls:** Should the VM support concurrent evaluations? (Out of scope — single-threaded QuickJS, sequential execution is the default.)
