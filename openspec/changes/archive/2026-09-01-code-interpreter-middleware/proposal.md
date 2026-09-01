## Why

The current orchestrator can only call tools one at a time. When it needs to process multiple files in a loop, run parallel tool calls with conditional branching, or compose results from multiple subagent calls, it must emit one tool call per step — exhausting context and increasing latency. An `eval` tool that executes JavaScript in a sandboxed QuickJS VM would let the orchestrator write orchestration scripts in one shot, with the VM handling loops, branches, and parallelism internally.

## What Changes

- Add a new `CodeInterpreterMiddleware` that exposes an `eval` tool to the orchestrator agent
- Create a QuickJS VM wrapper (`src/sandbox/vm.js`) for sandboxed JavaScript execution
- Implement snapshot/restore with HMAC signing (`src/sandbox/vm/snapshot.js`) for state persistence across turns
- Implement PTC tool proxy (`src/sandbox/vm/ptc.js`) to expose agent tools as JS functions in the VM
- Implement subagent dispatch proxy (`src/sandbox/vm/task.js`) to expose `task()` from within the VM
- Add Zod config schema for `codeInterpreter` settings (`src/config/schemas/codeInterpreter.js`)
- Integrate middleware into the orchestrator creation flow in `src/agent/deepAgents.js`
- Add unit and integration tests for all new components

## Capabilities

### New Capabilities

- `code-interpreter`: Sandbox JavaScript execution via QuickJS VM with configurable persistence modes (thread, turn, call), PTC tool proxy, and subagent dispatch
- `vm-sandbox`: QuickJS VM wrapper with memory limits, timeout enforcement, URL-filtered fetch, and HMAC-signed snapshot/restore

### Modified Capabilities

- None — existing capabilities remain unchanged; this is a new capability that integrates alongside existing tools and middleware

## Impact

- **New files**: `src/agent/codeInterpreter.js`, `src/sandbox/vm.js`, `src/sandbox/vm/snapshot.js`, `src/sandbox/vm/ptc.js`, `src/sandbox/vm/task.js`, `src/config/schemas/codeInterpreter.js`, `tests/unit/codeInterpreter.test.js`, `tests/integration/codeInterpreter.test.js`
- **Modified files**: `src/agent/deepAgents.js` (middleware integration), `src/config/config.js` (Zod schema), `src/config/schemas/index.js` (schema export), `config.yaml` (default config section)
- **New dependency**: `quickjs-emscripten-core` (QuickJS WASM bindings)
- **API changes**: None — the middleware is internal to the orchestrator; no external API surface changes

## Non-goals

- Replacing the existing `process` tool for general-purpose shell execution
- Building a full workflow engine or DAG-based orchestration system
- Supporting languages other than JavaScript in the VM
- Persisting VM state to disk (in-memory only)
- Multi-tenant VM isolation (single-tenant per instance)
