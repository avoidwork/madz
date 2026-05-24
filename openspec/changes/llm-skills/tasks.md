## 1. Project Setup

- [ ] 1.1 Create `src/skills/` and `src/scheduler/` directories
- [ ] 1.2 Create `skills/` directory with example skill templates
- [ ] 1.3 Create `.madz-scheduler.json` template (empty scheduled jobs array)
- [ ] 1.4 Update `AGENTS.md` section 2.0 with `src/skills/` and `src/scheduler/` in the project layout

## 2. Skills Registry Implementation

- [ ] 2.1 Create skill schema validator in `src/skills/validate.js` using zod — validates YAML frontmatter fields: `name`, `description`, `scope`, `version`, `destructive`
- [ ] 2.2 Create YAML frontmatter parser and markdown body reader in `src/skills/parser.js`
- [ ] 2.3 Create skill file resolver in `src/skills/resolver.js` — resolves skills from project, workspace, and global directories; filters by scope; applies allowlist
- [ ] 2.4 Create resource path validator in `src/skills/resources.js` — validates resource paths are within permitted directories, resolves symlinks for security
- [ ] 2.5 Create skill registry in `src/skills/registry.js` — supports `loadAll()`, `get(name)`, `list()`, `reload()`, `add()`, `remove()`
- [ ] 2.6 Create skill context injector in `src/skills/context.js` — prepends skill instructions to system message on activation, strips on deactivation
- [ ] 2.7 Write unit tests for skill validation (`tests/unit/skills/validate.test.js`)
- [ ] 2.8 Write unit tests for skill resolver with scope filtering (`tests/unit/skills/resolver.test.js`)
- [ ] 2.9 Write unit tests for skill registry CRUD (`tests/unit/skills/registry.test.js`)

## 3. Skills Scheduler Implementation

- [ ] 3.1 Create cron expression parser and validator in `src/scheduler/parseCron.js` — validates 5-field cron expressions, supports `*`, literals, commas, ranges, steps
- [ ] 3.2 Create cron matcher in `src/scheduler/matchCron.js` — takes parsed tokens and current Date, returns boolean for matching
- [ ] 3.3 Create scheduler engine in `src/scheduler/engine.js` — implements `setInterval` tick loop, compares current time against all scheduled cron expressions, queues matching jobs
- [ ] 3.4 Create job executor in `src/scheduler/executor.js` — creates background sessions, resolves skills, runs skill execution to completion, handles timeout termination
- [ ] 3.5 Create concurrency manager in `src/scheduler/concurrency.js` — tracks active jobs, enforces `maxConcurrent`, queues or skips overflow jobs based on `overflowPolicy`
- [ ] 3.6 Create scheduler state persistence in `src/scheduler/persist.js` — reads/writes `.madz-scheduler.json`, loads on startup, saves on every change
- [ ] 3.7 Create scheduled execution logger in `src/scheduler/log.js` — produces structured log entries with `scheduler: true`, `skill_id`, `cron_expression`, timing fields, status
- [ ] 3.8 Write unit tests for cron parser (`tests/unit/scheduler/parseCron.test.js`)
- [ ] 3.9 Write unit tests for cron matcher (`tests/unit/scheduler/matchCron.test.js`)
- [ ] 3.10 Write unit tests for job executor with timeout (`tests/unit/scheduler/executor.test.js`)

## 4. Delta: Tool Registry Integration

- [ ] 4.1 Modify tool execution flow in `src/tools/dispatcher.js` to accept optional `skill_id` parameter
- [ ] 4.2 Add `skill_id` field to tool log entry format in `src/tools/logger.js`
- [ ] 4.3 Write tests for tool execution logging with skill_id (`tests/unit/tools/registry.test.js` — add skill_id scenarios)

## 5. Delta: File-Based Memory Integration

- [ ] 5.1 Add skill context entry type (`### Skill: <name> Context`) to memory writer in `src/memory/writer.js`
- [ ] 5.2 Add skill execution history section (`## Skill Executions`) to memory writer
- [ ] 5.3 Modify memory context reader in `src/memory/reader.js` to include skill context when a skill is active
- [ ] 5.4 Implement skill resource content resolver in `src/skills/resources.js` (referenced by memory system)
- [ ] 5.5 Write unit tests for skill context injection in memory (`tests/unit/memory/skillContext.test.js`)

## 6. Delta: Session Management Integration

- [ ] 6.1 Extend session state machine in `src/session/states.js` with `skill_active`, `skill_paused`, `skill_completed` states
- [ ] 6.2 Create skill state transition validators — validate allowed transitions from/to skill states
- [ ] 6.3 Create background session factory in `src/session/backgroundSession.js` — creates sessions without TUI connection
- [ ] 6.4 Integrate skill context injection into session manager's LLM request preparation in `src/session/manager.js`
- [ ] 6.5 Write unit tests for new skill states (`tests/unit/session/states.test.js` — add skill state scenarios)
- [ ] 6.6 Write unit tests for background session creation (`tests/unit/session/backgroundSession.test.js`)

## 7. Delta: TUI Integration

- [ ] 7.1 Create skill viewport component in `src/tui/SkillViewport.js` — shows which skill is active and its steps
- [ ] 7.2 Create skill approval prompt in `src/tui/SkillApproval.js` — shows when skill with `destructive: true` is activated
- [ ] 7.3 Update status bar component in `src/tui/StatusBar.js` to display skill status and scheduler status: `skill: <id>`, `scheduler: idle/X active`
- [ ] 7.4 Create scheduler status display in `src/tui/SchedulerStatus.js` — shows enabled/disabled state
- [ ] 7.5 Write integration tests for TUI skill/scheduler status (`tests/integration/tui/skillStatus.test.js`)

## 8. Delta: System Config Integration

- [ ] 8.1 Extend zod config schema in `src/config/schema.js` with `skills` object (`autoActivate`, `scope`, `allowlist`, `maxInstructions`, `maxContextInjection`)
- [ ] 8.2 Extend zod config schema with `scheduler` object (`enabled`, `checkInterval`, `maxConcurrent`, `overflowPolicy`, `maxDurationPerSkill`, `logLevel`)
- [ ] 8.3 Create default values for `skills` and `scheduler` in `src/config/defaults.js`
- [ ] 8.4 Write unit tests for new config schema fields (`tests/unit/config/schema.test.js` — add skills and scheduler scenarios)

## 9. Integration Tests & Polish

- [ ] 9.1 Write integration test: skill activation flow (user message → skill recommended → skill active → tool chain → skill completes)
- [ ] 9.2 Write integration test: scheduler job execution (register schedule → tick triggers → background session runs → memory log written)
- [ ] 9.3 Write integration test: scheduler concurrency limits (register more jobs than maxConcurrent → verify queuing or skipping)
- [ ] 9.4 Write integration test: scheduler persistence (register schedule → stop app → restart → verified schedule loaded)
- [ ] 9.5 Write integration test: skill resource path validation (skill references path outside permitted → rejected gracefully)
- [ ] 9.6 Run `npx oxfmt` and `npx oxlint` — fix any lint/format issues
- [ ] 9.7 Verify 100% test coverage on `src/skills/` and `src/scheduler/` modules
- [ ] 9.8 Create sample skill examples in `skills.example/` (e.g., `code-review.md`, `daily-report.md`, `cleanup.md`)
- [ ] 9.9 Final pass: ensure all public functions have JSDoc, all async operations have timeouts
