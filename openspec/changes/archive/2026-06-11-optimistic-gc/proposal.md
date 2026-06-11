## Why

The memory system accumulates context entries over time — ephemeral memories, tool outputs, conversation snapshots, and scheduled job definitions. While the retention policy (`src/memory/retention.js`) handles file-level cleanup based on age and count, the Node.js process itself retains V8 heap objects that reference these files in memory: file handles, parsed YAML/JSON, string buffers, and the accumulated memory entries loaded into the prompt context.

For long-running instances (especially in containerized environments where memory limits are tight), this V8 heap pressure compounds. The process may hold onto 50–200MB+ of heap that is no longer needed because:
- Old memory entries were deleted from disk but their parsed content lingers in the `loadMemories()` result arrays
- File reads from `readdirSync`/`readFile` create buffers that are never explicitly freed
- The conversation state accumulates message objects across sessions
- Tool results and streaming buffers persist in memory

V8's GC is generational and generally efficient, but without explicit intervention, the old generation can grow unboundedly. An explicit `gc()` call forces V8 to collect all generations, reclaiming the dead objects that the retention policy has already marked for deletion.

## What Changes

- Add a `gc()` function exposed on the global object (only when `--expose-gc` is enabled)
- The function triggers V8's garbage collector via `global.gc()`
- GC is triggered automatically when the system is idle (no active tool calls, no streaming, no user input)
- Add a `:gc` TUI command for manual invocation
- Document the `--expose-gc` requirement in `README.md` and `config.yaml`
- Graceful degradation: if `--expose-gc` is not available, the system logs a one-time warning and continues normally

### New Capabilities
- `memory-gc`: Explicit V8 garbage collection triggered on idle and via TUI command

### Modified Capabilities
- `memory-system`: Adds a new requirement for proactive V8 heap management via explicit GC

## Impact

- **Code**: New `src/memory/gc.js` module. Integration in `index.js` for idle detection. TUI command registration in `commandParser.js`.
- **Config**: `config.yaml` — add `memory.gc.enabled` (default `true`) and `memory.gc.idleTimeoutMs` (default `300000` = 5 minutes)
- **Documentation**: `README.md` — document `--expose-gc` requirement for production/containerized use
- **Tests**: New tests for the GC module covering idle detection, manual invocation, and graceful degradation
