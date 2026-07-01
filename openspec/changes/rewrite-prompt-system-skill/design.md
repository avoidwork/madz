## Context

The madz project uses a skill-based architecture where skills are auto-discovered from the `system-skills/` directory. Each skill follows the Agent Skills spec with a SKILL.md file containing YAML frontmatter and executable scripts. Currently, there is no system skill for prompt rewriting — users must craft effective prompts manually, leading to inconsistent LLM outputs.

## Goals / Non-Goals

**Goals:**
- Create a `rewrite-prompt` system skill that rewrites raw user prompts for better LLM consumption
- Improve prompt clarity, structure, and actionability without changing user intent
- Follow existing skill patterns (SKILL.md + scripts/) for auto-discovery
- Handle edge cases: empty input, already-structured prompts, very long prompts

**Non-Goals:**
- Modifying the core harness to intercept prompts before skill invocation
- Adding configuration options for rewriting behavior
- Creating a UI for the rewrite-prompt skill
- Supporting multiple rewriting strategies or models

## Decisions

1. **Script-based implementation over SKILL.md-only**
   - Rationale: Complex prompt rewriting requires programmatic logic (parsing, restructuring, context injection) that's difficult to express purely in natural language instructions
   - Alternative considered: SKILL.md-only approach — rejected because prompt transformation requires structured processing

2. **No core harness changes**
   - Rationale: Keeping the core lean; skills are self-describing and auto-discovered
   - Alternative considered: Built-in prompt preprocessing in the harness — rejected because it reduces flexibility and adds core complexity

3. **Intent preservation as primary constraint**
   - Rationale: Rewriting should enhance, not transform — the user's original intent must be preserved
   - Implementation: Script analyzes intent signals before restructuring, ensuring semantic equivalence

4. **Node.js script in scripts/ directory**
   - Rationale: Follows existing pattern used by other system skills; Node.js is the project's runtime
   - Alternative considered: Python script — rejected because it would require additional dependencies

## Risks / Trade-offs

- **Risk**: Rewritten prompt may inadvertently change user intent → **Mitigation**: Script includes intent analysis step and preserves original phrasing where possible
- **Risk**: Very long prompts may exceed context limits after rewriting → **Mitigation**: Script includes length-aware processing and truncation safeguards
- **Risk**: Edge cases in prompt parsing → **Mitigation**: Comprehensive test coverage for edge cases (empty input, already-structured, multi-part prompts)

## Open Questions

- Should the skill support configurable rewriting depth (light vs. heavy restructuring)?
- Should the skill output both the rewritten prompt and a diff/explanation of changes?