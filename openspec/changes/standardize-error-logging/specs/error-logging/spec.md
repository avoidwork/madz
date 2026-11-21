# Spec Delta

## MODIFIED Requirements

### Requirement: All catch blocks log errors
The system SHALL log all caught errors using the structured `logger` singleton from `src/logger.js`. No bare `catch {}` blocks are permitted per AGENTS.md §1.1. This includes silent catch forms — `catch (_err) { return ...; }` and `.catch(() => {})` — which SHALL either log the error or carry an explicit comment documenting why the swallow is intentional.

#### Scenario: Expected failures use debug level
- **WHEN** a file not found error occurs during skill discovery
- **THEN** the catch block logs via `logger.debug()` with the error message

#### Scenario: Unexpected failures use error level
- **WHEN** a schedule execution fails unexpectedly
- **THEN** the catch block logs via `logger.error()` with the error message

#### Scenario: Silent catches are eliminated
- **WHEN** any file in the codebase has a `catch {}` block
- **THEN** it has been replaced with `catch (err) { logger.debug(...) }` or `catch (err) { logger.error(...) }`

#### Scenario: Silent catch forms are logged or documented
- **WHEN** a catch block uses `catch (_err) { return ...; }` or `.catch(() => {})`
- **THEN** it either logs the error via the structured logger or includes an explicit comment stating why swallowing the error is intentional

## ADDED Requirements

### Requirement: Intentional swallows are documented
The system SHALL document any intentional error swallow with an explicit comment explaining why the error is non-fatal by design, so that intentional swallows are distinguishable from accidental ones.

#### Scenario: Streaming check failure is documented
- **WHEN** a loop-detection check fails during streaming
- **THEN** the catch block includes a comment stating that a failed check must never break streaming, and the error is not logged as a failure

#### Scenario: Serialization queue failure is documented
- **WHEN** a queued background task in the vector indexer rejects
- **THEN** the rejection is handled with a comment stating it is a serialization queue guard, and the error is not logged as a failure
