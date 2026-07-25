# Spec: async-file-system-hygiene

## Requirements

### REQ-1: No sync FS in async functions
- All file system operations in async functions MUST use promise-based APIs (`fs.promises.*`)
- `existsSync()` MUST NOT be used inside `async function` or `async =>` contexts
- `readFileSync()`, `writeFileSync()`, `mkdirSync()` are acceptable in synchronous utility functions

### REQ-2: Error observability in streaming callbacks
- Streaming callback error handlers MUST log errors at debug level
- Silent catch blocks in streaming contexts are prohibited
- Error logging MUST use the structured logger (`logger.debug()`)

### REQ-3: Backward compatibility
- No changes to public API signatures
- No changes to behavioral contracts
- All existing tests MUST pass without modification
