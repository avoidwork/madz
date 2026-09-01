## 1. Install Dependencies

- [x] 1.1 Add `quickjs-emscripten-core` to package.json dependencies

## 2. VM Sandbox Layer

- [x] 2.1 Create `src/sandbox/vm.js` — QuickJS VM wrapper with evaluate(), memory limits, timeout enforcement, and sandboxed fetch
- [x] 2.2 Create `src/sandbox/vm/snapshot.js` — HMAC-signed snapshot serialization and restore
- [x] 2.3 Create `src/sandbox/vm/ptc.js` — PTC tool proxy exposing agent tools as JS functions
- [x] 2.4 Create `src/sandbox/vm/task.js` — Subagent dispatch proxy exposing task() from VM

## 3. CodeInterpreter Middleware

- [x] 3.1 Create `src/agent/codeInterpreter.js` — Main middleware with eval tool, wrapModelCall, and persistence mode management
- [x] 3.2 Implement thread, turn, and call persistence modes
- [x] 3.3 Implement system prompt injection for eval tool instructions

## 4. Config Schema

- [x] 4.1 Create `src/config/schemas/codeInterpreter.js` — Zod schema for codeInterpreter config
- [x] 4.2 Export schema from `src/config/schemas/index.js`
- [x] 4.3 Add codeInterpreter to root ConfigSchema in `src/config/config.js`
- [x] 4.4 Add default codeInterpreter section to `config.yaml`

## 5. Orchestrator Integration

- [x] 5.1 Modify `src/agent/deepAgents.js` — Import and conditionally create CodeInterpreterMiddleware
- [x] 5.2 Pass middleware to createDeepAgent when enabled
- [x] 5.3 Ensure backward compatibility when middleware is disabled

## 6. Tests

- [x] 6.1 Create `tests/unit/codeInterpreter.test.js` — Unit tests for VM, snapshot, PTC, task proxy, and middleware
- [x] 6.2 Create `tests/integration/codeInterpreter.test.js` — Integration tests for full middleware flow

## 7. Verification

- [x] 7.1 Run `npm run lint` and fix any issues
- [x] 7.2 Run `npm run test` and verify all tests pass
- [x] 7.3 Verify `npm start` does not crash
