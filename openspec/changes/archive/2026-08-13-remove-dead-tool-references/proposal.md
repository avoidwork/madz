## Why

The CODING.md and CODE_REVIEW.md prompt files list `skillView` and `skillsList` as available tools in their CAPABILITIES sections. These tools do not exist in the codebase, creating misleading documentation that could cause agents to attempt invoking non-existent capabilities.

## What Changes

- Remove `skillView` and `skillsList` from the CAPABILITIES section of `prompts/CODING.md`
- Remove `skillView` and `skillsList` from the CAPABILITIES section of `prompts/CODE_REVIEW.md`
- No code changes required — these are prompt/template files only

## Capabilities

### New Capabilities
<!-- None — this is a documentation cleanup, not a feature -->

### Modified Capabilities
<!-- None — no spec-level behavior changes -->

## Impact

- `prompts/CODING.md` — agent prompt file
- `prompts/CODE_REVIEW.md` — agent prompt file

## Non-goals

- No changes to actual tool implementations
- No changes to other prompt files
- No changes to skill definitions or registry
