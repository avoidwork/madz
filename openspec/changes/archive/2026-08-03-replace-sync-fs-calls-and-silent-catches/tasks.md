## 1. Convert sync fs in memory module

- [ ] 1.1 Convert `src/memory/context.js` — replace `readdirSync`/`readFileSync` with `readdir`/`readFile` from `node:fs/promises`, make `loadContext()` async
- [ ] 1.2 Convert `src/memory/reader.js` — replace `readFileSync`/`existsSync` with `readFile`/`access` from `node:fs/promises`, make `readMemoryFile()` async
- [ ] 1.3 Convert `src/memory/writer.js` — replace `mkdirSync`/`writeFileSync` with `mkdir`/`writeFile` from `node:fs/promises`, make `writeMemoryFile()` async
- [ ] 1.4 Convert `src/memory/profile.js` — replace `readFileSync`/`writeFileSync`/`mkdirSync`/`existsSync`/`renameSync` with async equivalents, make `loadProfile()` and `saveProfile()` async
- [ ] 1.5 Convert `src/memory/prompts.js` — replace `readFileSync` with `readFile` from `node:fs/promises`, make `loadSystemPrompt()` async
- [ ] 1.6 Convert `src/memory/retention.js` — replace `readdirSync`/`statSync`/`unlinkSync` with async equivalents, make `cleanRetainedMemory()` and `enforceMaxEntries()` async

## 2. Convert sync fs in skills module

- [ ] 2.1 Convert `src/skills/discoverer.js` — replace `readdirSync`/`statSync`/`readFileSync`/`existsSync` with async equivalents, make `findSkillFiles()` and `discoverSkills()` async
- [ ] 2.2 Convert `src/skills/registry.js` — replace `readFileSync` with `readFile` from `node:fs/promises`, make `getSkillBody()` async

## 3. Convert sync fs in session module

- [ ] 3.1 Convert `src/session/loader.js` — replace `readdirSync`/`readFileSync`/`statSync` with async equivalents, make `loadSession()` and `loadFile()` async

## 4. Convert sync fs in sandbox module

- [ ] 4.1 Convert `src/sandbox/runner.js` — replace `existsSync`/`readFileSync` with `access`/`readFile` from `node:fs/promises`, make `detectShebang()` async

## 5. Convert sync fs in agent module

- [ ] 5.1 Convert `src/agent/agents/coding.js` — replace `readFileSync` with `readFile` from `node:fs/promises`, make `loadCodingPrompt()` async
- [ ] 5.2 Convert `src/agent/agents/debug.js` — replace `readFileSync` with `readFile` from `node:fs/promises`, make `loadDebugPrompt()` async
- [ ] 5.3 Convert `src/agent/agents/documentation.js` — replace `readFileSync` with `readFile` from `node:fs/promises`, make `loadDocumentationPrompt()` async
- [ ] 5.4 Convert `src/agent/agents/code-review.js` — replace `readFileSync` with `readFile` from `node:fs/promises`, make `loadCodeReviewPrompt()` async
- [ ] 5.5 Convert `src/agent/agents/search.js` — replace `readFileSync` with `readFile` from `node:fs/promises`, make `loadSearchPrompt()` async
- [ ] 5.6 Convert `src/agent/agents/security-audit.js` — replace `readFileSync` with `readFile` from `node:fs/promises`, make `loadSecurityAuditPrompt()` async
- [ ] 5.7 Convert `src/agent/agents/performance.js` — replace `readFileSync` with `readFile` from `node:fs/promises`, make `loadPerformancePrompt()` async
- [ ] 5.8 Convert `src/agent/agents/testing.js` — replace `readFileSync` with `readFile` from `node:fs/promises`, make `loadTestingPrompt()` async
- [ ] 5.9 Convert `src/agent/agents/research.js` — replace `readFileSync` with `readFile` from `node:fs/promises`, make `loadResearchPrompt()` async

## 6. Replace silent catch blocks

- [ ] 6.1 Replace bare `catch {}` in `src/memory/retention.js` (lines 29, 63) with `catch (err) { logger.debug(...) }`
- [ ] 6.2 Replace bare `catch {}` in `src/memory/expireEphemeral.js` (lines 23, 52, 64) with `catch (err) { logger.debug(...) }`
- [ ] 6.3 Replace bare `catch {}` in `src/scheduler/scheduler.js` (lines 65, 69, 197, 200) with `catch (err) { logger.error(...) }`
- [ ] 6.4 Replace bare `catch {}` in `src/scheduler/cron.js` (lines 429, 432, 439, 475, 479) with `catch (err) { logger.debug(...) }`
- [ ] 6.5 Replace bare `catch {}` in `src/skills/discoverer.js` (lines 42, 57, 81, 94, 172) with `catch (err) { logger.debug(...) }`
- [ ] 6.6 Replace bare `catch {}` in `src/agent/agents/coding.js` (line 17) with `catch (err) { logger.debug(...) }`
- [ ] 6.7 Replace bare `catch {}` in `src/agent/agents/debug.js` (line 17) with `catch (err) { logger.debug(...) }`
- [ ] 6.8 Replace bare `catch {}` in `src/agent/agents/documentation.js` (line 17) with `catch (err) { logger.debug(...) }`
- [ ] 6.9 Replace bare `catch {}` in `src/agent/agents/code-review.js` (line 17) with `catch (err) { logger.debug(...) }`
- [ ] 6.10 Replace bare `catch {}` in `src/agent/agents/search.js` (line 17) with `catch (err) { logger.debug(...) }`
- [ ] 6.11 Replace bare `catch {}` in `src/agent/agents/security-audit.js` (line 17) with `catch (err) { logger.debug(...) }`
- [ ] 6.12 Replace bare `catch {}` in `src/agent/agents/performance.js` (line 17) with `catch (err) { logger.debug(...) }`
- [ ] 6.13 Replace bare `catch {}` in `src/agent/agents/testing.js` (line 17) with `catch (err) { logger.debug(...) }`
- [ ] 6.14 Replace bare `catch {}` in `src/agent/agents/research.js` (line 17) with `catch (err) { logger.debug(...) }`
- [ ] 6.15 Replace bare `catch {}` in `src/tui/contextTokens.js` (lines 21, 40) with `catch (err) { logger.debug(...) }`
- [ ] 6.16 Replace bare `catch {}` in `src/tui/statusBar.js` (line 35) with `catch (err) { logger.debug(...) }`
- [ ] 6.17 Replace bare `catch {}` in `src/workspace/loadAgents.js` (line 16) with `catch (err) { logger.debug(...) }`

## 7. Update callers of converted functions

- [ ] 7.1 Update `src/agent/deepAgents.js` — await `loadSystemPrompt()` and `skillRegistry.discover()`
- [ ] 7.2 Update `src/scheduler/scheduler.js` — await `loadContext()`
- [ ] 7.3 Update `src/tui/app.js` — await `loadSystemPrompt()` calls
- [ ] 7.4 Update `src/tools/skills.js` — await `skillRegistry.getSkillBody()` and `skillRegistry.discover()`
- [ ] 7.5 Update `src/tools/session_search.js` — await `parseFrontmatter` calls (if needed)
- [ ] 7.6 Update `src/session/factory.js` — await `loadSession()`
- [ ] 7.7 Update `src/session/onboarding.js` — await `saveProfile()`
- [ ] 7.8 Update `src/skills/registry.js` — await `discoverSkills()` in `discover()` method

## 8. Update tests

- [ ] 8.1 Update `tests/unit/memory/context.test.js` — mock async fs calls
- [ ] 8.2 Update `tests/unit/memory/reader.test.js` — mock async fs calls
- [ ] 8.3 Update `tests/unit/memory/writer.test.js` — mock async fs calls
- [ ] 8.4 Update `tests/unit/memory/profile.test.js` — mock async fs calls
- [ ] 8.5 Update `tests/unit/memory/prompts.test.js` — mock async fs calls
- [ ] 8.6 Update `tests/unit/memory/retention.test.js` — mock async fs calls
- [ ] 8.7 Update `tests/unit/skills/discoverer.test.js` — mock async fs calls
- [ ] 8.8 Update `tests/unit/skills/registry.test.js` — mock async fs calls
- [ ] 8.9 Update `tests/unit/session/loader.test.js` — mock async fs calls
- [ ] 8.10 Update `tests/unit/sandbox/runner.test.js` — mock async fs calls
- [ ] 8.11 Update `tests/unit/agent/agents/*.test.js` — mock async fs calls

## 9. Verification

- [ ] 9.1 Run `npm run test` — all tests pass
- [ ] 9.2 Run `npm run lint` — no lint errors
- [ ] 9.3 Run `npm run coverage` — coverage maintained
- [ ] 9.4 Verify no sync fs calls remain in async contexts: `grep -rn 'readFileSync\|writeFileSync\|readdirSync\|statSync\|existsSync\|mkdirSync\|unlinkSync' src/ --include='*.js' | grep -v 'config/loader.js' | grep -v 'logger.js'`
- [ ] 9.5 Verify no bare catch blocks remain: `grep -rn 'catch {' src/ --include='*.js' | grep -v '.test.'`
