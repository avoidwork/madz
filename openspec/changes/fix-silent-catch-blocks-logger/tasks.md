## 1. Implement error-bound catch blocks in logger

- [x] 1.1 Add a module-level `logError` helper in `src/shared/logger.js` that safely logs an error via the `logger` singleton when available, otherwise via a guarded `console.error` fallback (never throws)
- [x] 1.2 Convert the bare `catch {}` in `getLogDirectory()` (Alpine release read) to `catch (err) { logError(err) }` binding the error and logging at debug level
- [x] 1.3 Convert the bare `catch {}` in `tryCreateDirectory()` to `catch (err) { logError(err) }` binding the error and logging at debug level
- [x] 1.4 Convert the bare `catch {}` blocks around `createWriteStream` for the info stream and `/dev/null` fallback to `catch (err) { logError(err) }` binding the error and logging at debug level
- [x] 1.5 Convert the bare `catch {}` block around `createWriteStream` for the error stream to `catch (err) { logError(err) }` binding the error and logging at debug level
- [x] 1.6 Convert the bare `catch {}` block in `flush()` to `catch (err) { logError(err) }` binding the error and logging at debug level
- [x] 1.7 Convert the bare `catch {}` blocks in the `logger` object methods (`info`, `warn`, `error`, `debug`, `fatal`) to `catch (err) { logError(err) }` binding the error and logging via the non-recursive fallback

## 2. Add tests for error-bound catch blocks

- [x] 2.1 Add a test to `tests/unit/logger.test.js` verifying that a pino failure inside a logger method is caught, logged, and does not throw or recurse
- [x] 2.2 Add a test verifying no bare `catch {` blocks remain in `src/shared/logger.js`

## 3. Verification

- [x] 3.1 Run `npm run test` — all tests pass
- [x] 3.2 Run `npm run lint` — no lint errors
- [x] 3.3 Run `npm run coverage` — coverage maintained
- [x] 3.4 Verify no bare catch blocks remain in `src/shared/logger.js`: `grep -n 'catch {' src/shared/logger.js`
