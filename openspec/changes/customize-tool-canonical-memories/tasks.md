## 1. Setup

- [x] 1.1 Create `src/tools/customize.js` file and define the `customize` tool schema (JSDoc with @param and @returns)
- [x] 1.2 Define the YAML frontmatter schema for the three canonical profile files (user-profile, preferences, personal)
- [x] 1.3 Define the questionnaire data structure with all questions grouped by category

## 2. Implement Context Detection

- [x] 2.1 Implement `isEmptyContextDir(dirPath)` — checks if `memory/context/` has zero `.md` files
- [x] 2.2 Implement `ensureContextDir(dirPath)` — creates directory if it does not exist
- [x] 2.3 Implement `loadExistingFrontmatter(filePath)` — reads YAML frontmatter from an existing file, returns empty object if file does not exist or has no frontmatter

## 3. Implement Interactive Q&A

- [x] 3.1 Implement `runQuestionnaire(category, questions, existingData)` using Node.js `readline` for stdin/stdout interaction
- [x] 3.2 Implement question flow for identity group: name (required), handle, dob, location, relationshipStatus (all optional)
- [x] 3.3 Implement question flow for preferences group: timezone, language, dietaryRestrictions, tone, responseLength (all optional)
- [x] 3.4 Implement question flow for personal group: pets, hobbies, milestones, insights (all optional)
- [x] 3.5 Handle empty input: reject empty for required fields, record `"not provided"` for optional fields
- [x] 3.6 Handle readline errors gracefully with try/catch and log to structured logger

## 4. Implement Canonical File Writing

- [x] 4.1 Implement `writeProfileFile(filePath, data)` — merges with existing frontmatter if file exists, never overwrites
- [x] 4.2 Implement `writePreferencesFile(filePath, data)` — same merge-and-respect pattern
- [x] 4.3 Implement `writePersonalFile(filePath, data)` — same merge-and-respect pattern
- [x] 4.4 Generate human-readable markdown body from collected data for each file
- [x] 4.5 Test merge behavior: existing filled fields preserved, only missing fields re-prompted

## 5. Implement Memory Index Update

- [x] 5.1 Implement `readMemoryIndex(indexPath)` — parses `memory/_index.md` frontmatter entries
- [x] 5.2 Implement `appendIndexEntries(indexPath, newEntries)` — appends entries as new frontmatter entries
- [x] 5.3 Atomic write: use `writeFileSync` to temp path then `renameSync` for index updates
- [x] 5.4 Create index file from scratch if `memory/_index.md` does not exist

## 6. Integrate Tool into Agent

- [x] 6.1 Define the `customize` tool as a LangGraph tool with zod validation schema
- [x] 6.2 Register `customize` as a Tier 1 tool (no permission requirement)
- [x] 6.3 Wire tool invocation: agent calls it on startup or via manual command
- [x] 6.4 Ensure the tool returns structured result: success message, list of files written, or skip message

## 7. Tests

- [x] 7.1 Create `tests/unit/tools/customize.test.js` mirroring source structure
- [x] 7.2 Test `isEmptyContextDir` — empty dir, non-empty dir, missing dir
- [x] 7.3 Test load/merge frontmatter — empty file, no frontmatter, existing data
- [x] 7.4 Test file writing — new file creation, merge with existing, markdown body generation
- [x] 7.5 Test index update — append to existing, create from scratch, atomic write
- [x] 7.6 Test Q&A empty input handling — required field rejection, optional skip
- [x] 7.7 Test skip path — when context dir is non-empty, tool returns without prompting
- [x] 7.8 Mock filesystem for all tests (no real file system access in tests)

## 8. Verification

- [x] 8.1 Run `npm run test` — all tests pass
- [x] 8.2 Run `npm run coverage` — 100% coverage maintained
- [x] 8.3 Run `npm run lint` — no lint or formatting issues
- [x] 8.4 Verify `coverage.txt` generated correctly (pre-commit hook compatibility)
