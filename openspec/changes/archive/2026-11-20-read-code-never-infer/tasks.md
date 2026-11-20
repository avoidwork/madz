# Tasks

## 1. Update system prompt

- [x] 1.1 Add the "read the code; never infer it" rule as 4.3 immediately after rule 4.2 in `prompts/SYSTEM_PROMPT.md`, renumbering subsequent rules (4.4–4.15), and verify the rule text is present and numbered 4.3
- [x] 1.2 Append the carve-out "This does not apply to claims about code; see 4.3." to rule 3.2, and verify the carve-out text is present in rule 3.2
- [x] 1.3 Adjust rule 4.4 so unverified assumptions about code are not permitted (governed by 4.3), and verify the adjustment is present in rule 4.4

## 2. Verify

- [x] 2.1 Run `npm run lint` and verify it passes
- [x] 2.2 Run `npm run test` and verify it passes
