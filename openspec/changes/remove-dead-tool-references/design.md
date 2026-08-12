## Context

The CODING.md and CODE_REVIEW.md prompt files in `prompts/` reference two tools (`skillView` and `skillsList`) in their CAPABILITIES sections that do not exist in the codebase. These are dead references that mislead agents about available capabilities.

## Goals / Non-Goals

**Goals:**
- Remove `skillView` and `skillsList` from the CAPABILITIES section of `prompts/CODING.md`
- Remove `skillView` and `skillsList` from the CAPABILITIES section of `prompts/CODE_REVIEW.md`
- Preserve all other tool references and file formatting

**Non-Goals:**
- No changes to actual tool implementations
- No changes to other prompt files
- No changes to skill definitions or registry

## Decisions

- **Direct edit over rewrite:** The fix is a targeted string removal. No need to regenerate entire files.
- **No spec delta needed:** This is a documentation cleanup with no behavioral changes. The proposal alone suffices.

## Risks / Trade-offs

- **Risk:** None. These tools never existed, so no regression surface.
- **Trade-off:** Minimal — pure documentation improvement with zero risk.
