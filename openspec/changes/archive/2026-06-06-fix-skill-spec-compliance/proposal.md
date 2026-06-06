## Why

The skill registry implementation uses a custom `skill.yaml`/`skill.json` metadata format that is incompatible with the Agent Skills specification defined at agentskills.io. This prevents discovery of skills from the broader ecosystem (Claude Code, VS Code, Cursor, Gemini CLI, etc.) and eliminates progressive disclosure — the agent must call explicit `skills_list`/`skill_view` tools instead of naturally loading skills based on user intent.

## What Changes

- **Rewrite skill discovery** to parse `SKILL.md` YAML frontmatter (the standard format) instead of `skill.yaml`/`skill.json`
- **Drop `inputSchema`/`outputSchema`** — these are not part of the Agent Skills spec and add unneeded complexity
- **Enforce spec frontmatter constraints**: `name` (1-64 chars, lowercase alphanumeric + hyphens, must match parent directory), `description` (1-1024 chars), `license`, `compatibility` (max 500 chars), `metadata` (string→string map), `allowed-tools` (space-separated pre-approved tool list)
- **Implement progressive disclosure**: catalog of `name`+`description` at startup, full `SKILL.md` body loaded by model's file-read tool only when activated
- **Replace model-driven skill tools** (`skills_list`, `skill_view` LangChain tools) with system-prompt skill catalog injection — the model decides relevance and reads SKILL.md via its built-in file-read capability
- **Replace `fork`** with generic `spawn` in sandbox runner to support `.py`, `.sh`, `.rb`, `.ts` and other non-Node.js scripts
- **Add cross-client directory scanning**: scan `.agents/skills/` alongside `skills/`, support project- and user-level scopes, handle name collisions (project overrides user), add trust gating for project-level skills
- **Add lenient YAML parsing fallback** for malformed YAML with unquoted colons
- **Remove `memoryLimit` hardcoding** — respect `ExecutionContextSchema` value for Node.js scripts
- **Update `openspec/specs/skills-registry/spec.md`** to reference `SKILL.md` format instead of `skill.yaml`/`skill.json`

## Capabilities

### Modified Capabilities
- `skills-registry`: Major change — switches from `skill.yaml` format to `SKILL.md` frontmatter, replaces tool-based activation with progressive disclosure, replaces `fork` with `spawn`, adds cross-client scanning

### New Capabilities
- `skill-discovery`: (replaces the discovery portion of skills-registry; this is the actual spec we modify at `specs/skills-registry/spec.md`)

### Capabilities with Delta Spec Files
- `skills-registry` — the existing spec file at `openspec/specs/skills-registry/spec.md` is modified with a delta spec

## Impact

**Modified files:**
- `src/registry/discoverer.js` — complete rewrite of frontmatter parsing
- `src/registry/validator.js` — new constraint enforcement + lenient YAML fallback
- `src/registry/types.js` — remove `inputSchema`/`outputSchema`, add standard fields
- `src/registry/registry.js` — minimal changes (new discoverer output shape)
- `src/sandbox/runner.js` — replace `fork` with `spawn`
- `src/tools/skills.js` — drop schema references from skill view output
- `src/tools/index.js` — remove `skills_list`/`skill_view` from tool permissions map
- `openspec/specs/skills-registry/spec.md` — update to SKILL.md format

**Removed capabilities:**
- `skills_list` and `skill_view` LangChain tools (replaced by progressive disclosure)

**Affected subsystems:**
- Agent activation flow (system prompt catalog → model-driven file read)
- Scheduled skill execution (sandbox runner must handle non-Node scripts)
- TUI skills panel (may still use skill_view or display catalog)
- config/sandbox.paths default scope (expands to include `.agents/skills/`)
