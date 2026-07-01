## Why

Users often write prompts that are vague, unstructured, or lack the context an LLM needs to provide the best response. A system-level prompt rewriting skill would intercept or transform user input before it reaches the LLM, resulting in better outputs without requiring users to craft perfect prompts. This keeps the core harness lean while providing a flexible, skill-based approach to prompt enhancement.

## What Changes

- Add a new system skill `rewrite-prompt` in `system-skills/rewrite-prompt/`
- Skill accepts a raw user prompt and rewrites it to improve clarity, add context, structure the request, and make it more actionable
- Skill follows the Agent Skills spec with SKILL.md frontmatter and executable script
- No changes to core harness, skill registry, or config schemas — skill is auto-discovered via existing `system-skills/` directory scanning

## Capabilities

### New Capabilities
- `rewrite-prompt`: Rewrites raw user prompts to be clearer, more structured, and more actionable for LLM consumption

### Modified Capabilities
<!-- None — this is a new skill, no existing capability requirements are changing -->

## Impact

- New directory: `system-skills/rewrite-prompt/`
- New files: `system-skills/rewrite-prompt/SKILL.md`, `system-skills/rewrite-prompt/scripts/rewrite-prompt.js`
- No changes to existing source code, configs, or dependencies
- Skill auto-discovered by existing `src/skills/discoverer.js` — no code changes required