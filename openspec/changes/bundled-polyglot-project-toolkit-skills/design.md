## Context

The madz agent currently operates as a "blind shell operator" — it can execute commands but has no understanding of the project's language, build system, or test framework. All existing skills (audit-code, fix-issue, scan-issues, etc.) are Node.js-centric. When an IC points the agent at a Jira epic for a polyglot project, the agent lacks the context to make informed decisions about which commands to run, which security tools to use, or how to manage dependencies.

The `.skills/` directory already exists with the `reflection` skill. New skills should follow the same SKILL.md pattern with YAML frontmatter and progressive disclosure.

## Goals / Non-Goals

**Goals:**
- Create `project-context` skill (MVP) with full language detection, build system detection, test framework detection, and command extraction
- Scaffold four additional skills (security-audit, build-run, dependency-manager, test-env-setup) with proper structure and documented intent
- Update AGENTS.md Skills System section with all 5 new skills
- Document Dockerfile tool availability requirements

**Non-Goals:**
- Full implementation of security-audit, build-run, dependency-manager, and test-env-setup (scaffolded only)
- Docker image changes (documented but not implemented)
- Integration tests between skills (future work)
- Support for additional languages beyond the initial set

## Decisions

### Decision 1: SKILL.md Pattern (not code-based skills)
**Choice**: Implement skills as SKILL.md files following the reflection pattern, not as JavaScript modules.
**Rationale**: The existing `.skills/reflection/` skill uses this pattern. It's simpler, requires no build step, and follows the Agent Skills spec. Code-based skills would require changes to the skills discovery system in `src/skills/`.
**Alternatives considered**:
- JavaScript-based skills in `.skills/` — would require changes to the skills registry and sandbox execution
- Hybrid approach — SKILL.md that calls JS scripts — adds complexity without clear benefit for MVP

### Decision 2: MVP First (project-context only)
**Choice**: Fully implement only `project-context`. Scaffold the other four skills with documented intent but minimal logic.
**Rationale**: The issue explicitly recommends starting with project-context as the MVP. It has the least dependencies and provides immediate value. The other skills depend on project-context's output.
**Alternatives considered**:
- Implement all 5 skills at once — too much scope, higher risk
- Implement project-context + security-audit — security-audit has more external dependencies (trivy, grype, etc.)

### Decision 3: Language Detection Priority Order
**Choice**: Scan for language indicators in a fixed priority order (package.json → pom.xml → go.mod → pyproject.toml → Cargo.toml → build.gradle → Gemfile → package.yaml).
**Rationale**: Monorepos may have multiple indicators. A fixed priority order ensures deterministic behavior. The priority reflects the most common project types.
**Alternatives considered**:
- Report all detected languages — more complete but harder for the agent to act on
- Auto-detect primary language by file count — more complex, potentially unreliable

### Decision 4: Graceful Degradation for Missing Tools
**Choice**: Each skill checks for required tools at start and fails with clear error messages if missing.
**Rationale**: Tools like trivy, grype, semgrep may not be installed in all environments. Silent failures are worse than explicit errors.
**Alternatives considered**:
- Install tools on-demand — adds network dependency, slower first run
- Require all tools upfront — too restrictive, prevents use in minimal environments

## Risks / Trade-offs

### Risk: Multi-language monorepo ambiguity
→ **Mitigation**: Report all detected languages in project-context output, but pick the primary one based on priority order. The agent can then decide how to handle polyglot projects.

### Risk: Tool availability in sandbox
→ **Mitigation**: Document tool requirements in each skill. Skills fail gracefully with actionable error messages. Dockerfile changes are documented but not implemented in MVP.

### Risk: SKILL.md files are static
→ **Mitigation**: SKILL.md files are read by the LLM at runtime, so they can be updated without code changes. The pattern is proven by the existing reflection skill.

## Migration Plan

1. Create `.skills/` directory structure for all 5 skills
2. Implement `project-context/SKILL.md` with full language detection logic
3. Scaffold remaining 4 SKILL.md files with frontmatter and documented intent
4. Update AGENTS.md Skills System section
5. Verify with `npm run lint` and `npm run test`

No rollback needed — new files only, no modifications to existing code.

## Open Questions

1. Should the Dockerfile be updated in this change or deferred? → Deferred — documented in skills but not implemented.
2. How should the agent handle monorepos with conflicting build systems? → Report all detected languages; agent decides.
3. Should we add unit tests for the SKILL.md content? → Not applicable — SKILL.md files are instructions for the LLM, not code to test.
