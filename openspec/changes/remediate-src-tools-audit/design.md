## Context

The `./src/tools` directory contains 21 files that form the execution layer of the madz system — every agent interaction that uses terminal, code execution, cron, memory, vision, web search, or skills passes through these tools. A comprehensive audit (issue #290) identified 32 issues: 10 bugs, 9 security vulnerabilities, and 13 performance problems. The issues are systemic — they span nearly every file and represent consistent patterns of incorrect assumptions (spawn() timeout), missing security controls (no sandboxing, no SSRF protection), and performance anti-patterns (O(n²) string concatenation).

Current state: `common.js` is the cleanest file with good path validation and URL filtering, but security and correctness patterns are not centralized. Each tool implements its own (often incomplete) safeguards. The permission model in `index.js` gates tool availability but not tool execution.

## Goals / Non-Goals

**Goals:**
- Fix all 32 identified issues across 21 files
- Centralize shared utilities (SSRF protection, output accumulation, input sanitization) in `common.js`
- Make timeouts actually work for foreground terminal commands
- Add command sandboxing to terminal and cron execution
- Eliminate O(n²) memory growth patterns
- Fix spec-inconsistent metadata key in skills.js
- Add path traversal and injection guards
- Standardize patterns across tools

**Non-Goals:**
- Refactoring the permission model architecture (out of scope)
- Adding new tools or capabilities
- Changing agent-to-agent or agent-to-user communication
- Migrating existing skills with malformed metadata (migration path only)
- Adding new external dependencies except for DOM parser in web.js

## Decisions

### Decision 1: AbortController for timeout handling (terminal.js)
**Choice:** Use `AbortController` with `signal` passed to `spawn()` rather than `setTimeout` + `child.kill()`.
**Rationale:** AbortController is the modern Node.js pattern for cancellable operations. It integrates cleanly with the existing abort-based interrupt system (already established for streaming escape). It provides cleaner cleanup semantics — the abort signal propagates through the event loop naturally.
**Alternatives considered:**
- `setTimeout` + `child.kill()`: Works but requires manual cleanup tracking and doesn't integrate with the existing abort system.
- `timeout` option on spawn(): Already broken — Node.js silently ignores it.

### Decision 2: Chunk array for output accumulation (code.js, terminal.js, cron.js)
**Choice:** Replace `+=` string concatenation with array push + `join('')` pattern.
**Rationale:** String concatenation in JavaScript creates a new string on each append, leading to O(n²) memory and time complexity for large outputs. Array push is O(1) and `join('')` at the end is O(n). This pattern is already correctly implemented in `cron.js` `runScript` — we're standardizing it.
**Alternatives considered:**
- Streaming to a temp file: Overly complex for this use case, adds I/O overhead.
- Buffer concatenation: More complex than array + join, no meaningful performance benefit.

### Decision 3: Buffer for base64 encoding (vision.js)
**Choice:** Use `Buffer.from(bytes).toString('base64')` rather than chunked `String.fromCharCode.apply()`.
**Rationale:** `Buffer.from().toString('base64')` is the idiomatic Node.js solution. It has no call stack limit (unlike `apply` which spreads all elements). It produces identical output. The chunking workaround was a hack for the `apply` limit — no longer needed.
**Alternatives considered:**
- `Buffer.toJSON().data`: Adds unnecessary serialization overhead.
- Manual byte-by-byte base64 encoding: Slower and more complex than Buffer.

### Decision 4: Centralized SSRF protection in common.js
**Choice:** Create a shared `ssrfProtect(url)` utility in `common.js` that validates against private/reserved IP ranges and controls redirect chains.
**Rationale:** Five tools (`image.js`, `vision.js`, `web.js`, `moa.js`, `tts.js`) make outbound fetches without SSRF protection. Duplicating this logic across five files is error-prone. Centralizing it in `common.js` (already the location for URL filtering) ensures consistency.
**Alternatives considered:**
- Per-tool SSRF checks: Error-prone, inconsistent implementation, harder to maintain.
- Global fetch wrapper: Would require intercepting all fetch calls, more invasive.

### Decision 5: Command sandboxing via denylist (terminal.js)
**Choice:** Start with a denylist of known-dangerous commands (rm -rf, format, dd, mkfs, etc.) rather than a allowlist.
**Rationale:** An allowlist would be extremely restrictive and break many legitimate use cases (e.g., `git commit`, `npm install`, `docker build`). A denylist blocks the most dangerous operations while allowing flexibility. The denylist can be iteratively expanded as new dangerous patterns are discovered.
**Alternatives considered:**
- Allowlist of permitted commands: Too restrictive for a general-purpose tool.
- Full sandbox (seccomp, namespaces): Overly complex for this use case, adds significant overhead.
- Permission-based sandboxing: Requires a more complex permission model than currently exists.

### Decision 6: DOM parser for HTML (web.js)
**Choice:** Replace fragile DuckDuckGo HTML regex with `cheerio` (jQuery-like DOM parser).
**Rationale:** HTML regex is inherently fragile — any change to DDG's HTML structure breaks parsing. A DOM parser is resilient to structural changes. `cheerio` is lightweight, well-maintained, and has a familiar API.
**Alternatives considered:**
- `htmlparser2`: Lighter weight but requires more boilerplate for extraction.
- Continue with regex: Proven fragile, breaks silently.
- Puppeteer/Playwright: Overly heavy for simple HTML parsing.

### Decision 7: Async existsSync replacement (cron.js)
**Choice:** Replace `existsSync` with `fs.access()` promise-based check.
**Rationale:** `existsSync` blocks the event loop, which is problematic in an async function. `fs.access()` is the async equivalent that returns a promise. The swap is straightforward and maintains the same error handling behavior.
**Alternatives considered:**
- `fs.stat()`: More information than needed, slightly more overhead.
- Keep existsSync: Blocks event loop, degrades responsiveness.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Command sandboxing denylist may be incomplete | Start with comprehensive denylist, iterate based on user feedback and discovered dangerous patterns |
| SSRF protection may block legitimate redirects to private IPs in dev environments | Add development-mode bypass via environment variable |
| skills.js metadata key fix breaks existing malformed skills | Handle both `permission` and `permissions` keys during migration period |
| Adding cheerio increases bundle size | Minimal impact (~100KB), justified by improved reliability |
| Token estimation improvement may require external dependency | Use lightweight token counting library or heuristic; avoid API calls |
| History rotation in clarify.js may lose conversation context | Keep last N entries configurable, default to reasonable value (e.g., 50) |
| Per-tool incremental adoption of security fixes | Document which tools have which protections, track adoption in PR |

## Migration Plan

1. **Phase 1 (this PR):** Implement all fixes. Handle both `permission` and `permissions` keys in skills.js during migration period.
2. **Phase 2 (follow-up):** Remove legacy `permission` key handling after a reasonable transition period (e.g., 30 days).
3. **Phase 3 (follow-up):** Add automated tests for security fixes (SSRF, command sandboxing, injection prevention).

## Open Questions

1. **Token estimation:** Should we use a token counting library (e.g., `gpt-tokenizer`) or improve the heuristic? Library adds dependency but provides accuracy.
2. **History rotation default:** What's the right default for `clarify.js` history rotation? 50 entries? 100? Configurable?
3. **SSRF dev bypass:** Should the development-mode bypass be enabled by default, or require explicit opt-in?
4. **cheerio version:** Which version to use? Latest stable or LTS?