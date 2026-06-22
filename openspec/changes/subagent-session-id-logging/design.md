## Context

The subAgent tool spawns child processes to execute delegated prompts. Currently, log files are named using the child process PID (`/tmp/sub-agent-${child.pid}.log`). PIDs are ephemeral OS resources that can be reused, making it impossible to reliably correlate logs between the main process and sub-agents across process lifecycles. This is particularly problematic in parallel/sequential fan-out scenarios where multiple sub-agents run concurrently.

## Goals / Non-Goals

**Goals:**
- Generate a unique session ID at subAgent invocation time
- Pass session ID to sub-agents via environment variable
- Use session ID for consistent log file naming
- Update subAgentLog tool to support session ID filtering

**Non-Goals:**
- Migration of existing PID-based log files
- Changes to TUI session management
- Changes to other logging systems in the codebase
- Real-time log streaming or aggregation

## Decisions

### Session ID Generation: `crypto.randomUUID()` over custom hex generator
**Decision:** Use Node.js built-in `crypto.randomUUID()` (UUID v4) for session ID generation.
**Rationale:** UUID v4 provides 122 bits of randomness, making collisions astronomically unlikely. It's a standard library function, well-tested, and produces a clean 36-character string. A custom hex generator would require additional code and testing for the same guarantee.
**Alternatives considered:**
- `crypto.randomInt()` with custom hex formatting — more code, same outcome
- Timestamp-based IDs — risk of collision in parallel execution
- UUIDs with shorter formatting — adds complexity for marginal benefit

### Session ID Propagation: Environment Variable
**Decision:** Pass session ID via `MADZ_SESSION_ID` environment variable to child process.
**Rationale:** Cleanest mechanism with minimal code changes. The `spawn()` call already accepts an `env` option, and the child process immediately has access via `process.env.MADZ_SESSION_ID`. No parameter signature changes needed.
**Alternatives considered:**
- Command-line argument — requires parsing changes in child process
- Shared file — adds I/O overhead and cleanup complexity
- Named pipe — over-engineered for this use case

### Log Pattern: Alphanumeric Support
**Decision:** Update regex from `/^sub-agent-(\d+)\.log$/` to `/^sub-agent-[a-zA-Z0-9]+\.log$/`.
**Rationale:** UUIDs contain hyphens and alphanumeric characters. The new pattern supports both the old PID-based logs (for backward compatibility) and new session ID-based logs.
**Alternatives considered:**
- Strict UUID-only pattern — would break if format changes in future
- Separate PID and session ID modes — adds unnecessary complexity

## Risks / Trade-offs

[Risk] Session ID collision in high-concurrency scenarios → [Mitigation] UUID v4 provides 122 bits of randomness; collision probability is negligible even with millions of concurrent invocations
[Risk] Backward compatibility with existing PID-based logs → [Mitigation] Updated regex supports both patterns; subAgentLog accepts both `pid` and `sessionId` parameters
[Risk] Memory leak from orphaned log files → [Mitigation] No change to existing cleanup behavior; session IDs don't affect log file lifecycle management

## Migration Plan

No migration needed. The change is additive:
1. New subAgent invocations will use session IDs immediately
2. Existing PID-based log files remain accessible via the updated regex
3. `subAgentLog` tool supports both `pid` and `sessionId` parameters

## Open Questions

None — the design is clear and implementation details are specified in the tasks.