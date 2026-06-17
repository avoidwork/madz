## 1. Shared Utilities in common.js

- [x] 1.1 Create SSRF protection utility `ssrfProtect(url)` in common.js with private/reserved IP blocking for IPv4 and IPv6
- [x] 1.2 Create redirect chain validator that blocks redirects to private IPs
- [x] 1.3 Create output accumulator utility `createOutputAccumulator()` using chunk array pattern
- [x] 1.4 Create input sanitizer `escapeShellInput(input)` for grep/sed injection prevention
- [x] 1.5 Create path traversal guard `sanitizePath(path)` with `../` blocking
- [x] 1.6 Add development mode SSRF bypass via environment variable
- [ ] 1.7 Write unit tests for all shared utilities

## 2. terminal.js — Timeout and Sandboxing

- [x] 2.1 Replace ignored `timeout` spawn option with AbortController + signal pattern
- [x] 2.2 Implement command denylist sandboxing (block rm -rf, format, dd, mkfs, nmap, etc.)
- [x] 2.3 Block dangerous command chaining (&&, ||, ;) for escalation prevention
- [x] 2.4 Block environment variable manipulation (LD_PRELOAD, LD_LIBRARY_PATH)
- [x] 2.5 Integrate output accumulator for terminal command output
- [ ] 2.6 Write unit tests for timeout behavior
- [ ] 2.7 Write unit tests for command sandboxing denylist

## 3. skills.js — Metadata Key Fix

- [ ] 3.1 Change `skillMetadata.permission` to `skillMetadata.permissions` on line 206
- [ ] 3.2 Add migration path: check for `permissions` first, fall back to `permission`
- [ ] 3.3 Log warning when legacy `permission` key is detected
- [ ] 3.4 Write unit tests for metadata key correctness

## 4. cron.js — Async Operations and Output

- [ ] 4.1 Replace `existsSync` with async `fs.access()` in `findSkillScript`
- [ ] 4.2 Replace string concatenation with chunk array output accumulation
- [ ] 4.3 Integrate command sandboxing for skill script execution
- [ ] 4.4 Write unit tests for async file existence check

## 5. code.js — Python Sandbox and Memory

- [ ] 5.1 Expand Python import hook to block ctypes, importlib, pickle, urllib
- [ ] 5.2 Fix setrlimit to apply to child process environment, not parent
- [ ] 5.3 Replace string concatenation with chunk array for stdout/stderr
- [ ] 5.4 Write unit tests for expanded Python import blocking

## 6. vision.js — Base64 Encoding

- [ ] 6.1 Replace `String.fromCharCode.apply(null, bytes)` with `Buffer.from(bytes).toString('base64')`
- [ ] 6.2 Remove chunking workaround (no longer needed)
- [ ] 6.3 Write unit tests for large image encoding (>64KB)

## 7. memory.js — List Optimization and Sanitization

- [ ] 7.1 Add path traversal guard to `sanitizeKey` function
- [ ] 7.2 Optimize `list` operation with batched file reads
- [ ] 7.3 Add caching layer for frequently accessed entries
- [ ] 7.4 Write unit tests for path traversal blocking
- [ ] 7.5 Write unit tests for list optimization

## 8. session_search.js — Injection and Spawn Optimization

- [ ] 8.1 Escape user queries before passing to grep/sed
- [ ] 8.2 Replace per-match sed spawns with single-pass processing
- [ ] 8.3 Remove redundant grep flags
- [ ] 8.4 Write unit tests for injection prevention

## 9. clarify.js — Memory Growth Prevention

- [ ] 9.1 Implement history rotation with configurable maximum entries
- [ ] 9.2 Add chunked file reading for large history files
- [ ] 9.3 Add file size limits before reading entire file into memory
- [ ] 9.4 Write unit tests for history rotation

## 10. filesystem.js — Output and Search Fixes

- [ ] 10.1 Fix `content.length` vs `Buffer.byteLength` mismatch in success message
- [ ] 10.2 Add size limits to `nativeSearch` file reads
- [ ] 10.3 Optimize `fuzzyMatch` to avoid large intermediate strings
- [ ] 10.4 Write unit tests for output message accuracy

## 11. task-queue.js — Error Propagation and Queue Depth

- [ ] 11.1 Remove `.catch(() => {})` that swallows chain-level errors
- [ ] 11.2 Add error logging for swallowed errors
- [ ] 11.3 Implement accurate pending task count tracking in `_getQueueDepth`
- [ ] 11.4 Write unit tests for error propagation
- [ ] 11.5 Write unit tests for queue depth tracking

## 12. web.js — HTML Parsing and SSRF

- [ ] 12.1 Add cheerio or htmlparser2 dependency to package.json
- [ ] 12.2 Replace DuckDuckGo HTML regex with DOM parser
- [ ] 12.3 Integrate SSRF protection for outbound fetches
- [ ] 12.4 Reduce sequential regex replacements to fewer targeted passes
- [ ] 12.5 Write unit tests for HTML parsing resilience

## 13. moa.js — Model Configurability and Timeout

- [ ] 13.1 Make model configurable instead of hardcoded `openai/gpt-4o`
- [ ] 13.2 Reduce excessive per-API timeout from 60s to reasonable default
- [ ] 13.3 Add timeout configurability via settings
- [ ] 13.4 Write unit tests for model configurability

## 14. compact_context.js — Token Estimation

- [ ] 14.1 Improve token estimation beyond 1-token-per-4-chars heuristic
- [ ] 14.2 Add code-aware and JSON-aware estimation heuristics
- [ ] 14.3 Optimize text concatenation for estimation
- [ ] 14.4 Write unit tests for estimation accuracy

## 15. sampling.js — Ephemeral Count Optimization

- [ ] 15.1 Replace file-by-file parsing with directory listing for ephemeral count
- [ ] 15.2 Add caching layer for count results
- [ ] 15.3 Write unit tests for count optimization

## 16. image.js — JSDoc Cleanup

- [ ] 16.1 Remove garbled text and tab characters from JSDoc
- [ ] 16.2 Ensure JSDoc follows standard format
- [ ] 16.3 Verify JSDoc is valid and parseable

## 17. Integration and Verification

- [ ] 17.1 Run full test suite and verify all tests pass
- [ ] 17.2 Run lint and verify no lint errors
- [ ] 17.3 Run coverage and verify coverage is maintained
- [ ] 17.4 Manual testing of terminal timeout behavior
- [ ] 17.5 Manual testing of command sandboxing
- [ ] 17.6 Manual testing of SSRF protection
- [ ] 17.7 Manual testing of skills.js metadata key
- [ ] 17.8 Manual testing of large image base64 encoding
- [ ] 17.9 Manual testing of session search injection prevention
- [ ] 17.10 Manual testing of memory list optimization