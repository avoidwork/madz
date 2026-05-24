## Why

The existing spec covers discrete tools and session management, but lacks a mechanism for the assistant to invoke **composable, domain-specific skill modules** — self-contained behavioral units that guide multi-step operations. Skills enable the assistant to handle complex workflows (code review, documentation generation, dependency updates) without hardcoding behavior into tool definitions. Users need a way to author, discover, and compose these skills just as they compose tools.

## What Changes

- A skills registry that stores, validates, and loads skill definitions from markdown files
- Each skill includes a name, schema, instructions, resource references, and capability scope
- Skills are discoverable by the assistant based on conversation context (auto-recommendation)
- Skills invoke tools under the hood but package multi-step workflows as single units
- A skill invocation system in the TUI that shows skill status, approval, and execution progress
- A cron-like scheduler that runs skills on configurable intervals or fixed schedules without a manual session
- Configuration to control skill behavior (auto-activate, allowlist, scope) and scheduler (enabled, interval, max parallel jobs)
- Skill authoring template and validation

## Capabilities

### New Capabilities

- `skills-registry`: Markdown-driven skill definitions with schema validation, resource tracking, and lifecycle management
- `skills-scheduler`: Cron-like scheduling for skills with fixed times, intervals, and parallel execution controls

### Modified Capabilities

- `tui-interface`: Add skill execution viewport, skill approval prompt, skill status indicator, and scheduler status to status bar
- `tool-registry`: Tools gain a `skill_id` reference so the tool-registry can track which skills invoked them
- `file-based-memory`: Memory system gains skill execution history tracking and skill resource path resolution
- `session-management`: Session adds skill state (`idle_skill`, `active_skill`, `paused_skill`) and skill-level context injection; scheduler runs background sessions with their own metadata
- `system-config`: Settings gain `skills.autoActivate` (boolean), `skills.allowlist` (array of skill file paths or wildcards), `skills.scope` (enum: `project`, `workspace`, `global`)

## Impact

- **New directories**: `src/skills/`, `src/scheduler/`, `skills/` (default skills directory)
- **New files**: `skills/` templates, `skills.example/` sample skills, `settings/scheduler.json` (default scheduler config)
- **Modified specs**: `tui-interface`, `tool-registry`, `file-based-memory`, `session-management`, `system-config` — all receive delta requirements
- **Config changes**: New `skills` section in settings schema; new `scheduler` section (`enabled`, `checkInterval`, `maxConcurrent`, `logLevel`)
