## Why

A comprehensive audit of `./src/tools` identified 32 issues across all 21 files: 10 bugs, 9 security vulnerabilities, and 13 performance problems. The most critical issues include silent timeout failures in terminal execution, missing sandboxing on cron and terminal command execution, insecure input handling in session search, O(n²) memory growth patterns, and a spec-inconsistent metadata key in skills.js. These issues collectively undermine the reliability, security, and scalability of the tools layer — the execution core that every agent interaction depends on.

## What Changes

- **terminal.js**: Fix spawn() timeout handling using AbortController pattern; add command sandboxing with dangerous operation denylist
- **skills.js**: Fix metadata key from `permission` to `permissions` to match Agent Skills spec; add migration path for existing malformed skills
- **cron.js**: Replace synchronous existsSync with async fs.access(); standardize chunk array output accumulation
- **code.js**: Expand Python import hook to block dangerous modules (ctypes, importlib, pickle, urllib); fix setrlimit to apply to child process; replace string concatenation with chunk array accumulation
- **vision.js**: Replace String.fromCharCode.apply() with Buffer.from().toString('base64') to eliminate call stack limit for large images
- **memory.js**: Optimize list operation with batched file reads and caching; add path traversal guard to sanitizeKey
- **session_search.js**: Escape user queries before grep/sed interpolation to prevent injection; replace per-match sed spawns with single-pass processing
- **clarify.js**: Implement history rotation and chunked file reading to prevent unbounded memory growth
- **filesystem.js**: Fix content.length vs Buffer.byteLength mismatch; add size limits to nativeSearch; optimize fuzzyMatch intermediate strings
- **task-queue.js**: Remove silent error swallowing; implement accurate pending task count tracking
- **web.js**: Replace fragile HTML regex with DOM parser; add SSRF protection for outbound fetches
- **moa.js**: Make model configurable instead of hardcoded; reduce excessive per-API timeout
- **compact_context.js**: Improve token estimation accuracy beyond 1-token-per-4-chars heuristic
- **sampling.js**: Optimize ephemeral memory count with directory listing instead of file-by-file parsing
- **image.js**: Clean up malformed JSDoc with garbled text
- **common.js**: Add shared utilities — SSRF protection, output accumulator, input sanitizer

## Capabilities

### New Capabilities
- `tools-hardening`: Centralized security and correctness utilities for the tools execution layer (SSRF protection, output accumulation, input sanitization, command sandboxing)

### Modified Capabilities
<!-- No existing spec-level requirements are changing — this is an implementation remediation, not a behavior change -->

## Impact

**Affected code:** 16 files in `src/tools/` — terminal.js, skills.js, cron.js, code.js, vision.js, memory.js, session_search.js, clarify.js, filesystem.js, task-queue.js, web.js, moa.js, compact_context.js, sampling.js, image.js, common.js

**APIs:** No public API changes. Internal tool execution behavior is enhanced (timeouts actually work, commands are sandboxed) but existing interfaces are preserved.

**Dependencies:** Potential addition of `cheerio` or `htmlparser2` for DOM-based HTML parsing in web.js (replaces fragile regex). No new external dependencies for security/performance fixes.

**Systems:** The tools execution layer — every agent interaction that uses terminal, code execution, cron, memory, vision, web search, or skills will benefit from these fixes. No breaking changes to agent-to-agent or agent-to-user communication.

**Breaking changes:** The `skills.js` metadata key fix (`permission` → `permissions`) is technically breaking for existing malformed skills, but a migration path is included to handle both keys during a transition period.