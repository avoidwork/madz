## Why

The logger module has a TOCTOU (Time-of-Check-Time-of-Use) race condition in Alpine Linux detection that can crash the application at startup if `/etc/alpine-release` is deleted between the existence check and read. Additionally, when primary log directories are unwritable, the logger creates redundant `/dev/null` streams instead of reusing a single fallback stream, wasting file descriptors.

## What Changes

- Fix TOCTOU race condition in `getLogDirectory()` by wrapping `readFileSync` in a try/catch block to handle file deletion between check and read
- Fix redundant `/dev/null` stream creation by reusing the existing `devNull` reference when creating the error stream fallback
- Review and update pino multistream usage for forward compatibility with newer Pino versions
- Add unit tests to verify the race condition fix and stream reuse behavior

## Capabilities

### New Capabilities
<!-- None — this is a bug fix, not a new feature -->

### Modified Capabilities
- `system-logger`: Updated requirements for Alpine Linux detection to handle file deletion gracefully, and stream fallback to use a single `/dev/null` stream

## Impact

- **Files**: `src/logger.js` (primary), `tests/unit/logger.test.js` (new tests)
- **Dependencies**: pino (version review for multistream deprecation)
- **Systems**: Application startup, logging initialization
- **Breaking changes**: None — all changes maintain backward compatibility