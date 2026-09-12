## 1. Add Audience & Success Metrics to ROLE Section

- [ ] 1.1 Add an explicit `**Audience:**` line to the ROLE section of CODE_REVIEW.md
- [ ] 1.2 Add an explicit `**Audience:**` line to the ROLE section of CODING.md
- [ ] 1.3 Add an explicit `**Audience:**` line to the ROLE section of DEBUG.md
- [ ] 1.4 Add an explicit `**Audience:**` line to the ROLE section of DOCUMENTATION.md
- [ ] 1.5 Add an explicit `**Audience:**` line to the ROLE section of PERFORMANCE.md
- [ ] 1.6 Add an explicit `**Audience:**` line to the ROLE section of RESEARCH.md
- [ ] 1.7 Add an explicit `**Audience:**` line to the ROLE section of SEARCH.md
- [ ] 1.8 Add an explicit `**Audience:**` line to the ROLE section of SECURITY_AUDIT.md
- [ ] 1.9 Add an explicit `**Audience:**` line to the ROLE section of SEO_ANALYST.md
- [ ] 1.10 Add an explicit `**Audience:**` line to the ROLE section of TESTING.md
- [ ] 1.11 Add an explicit `**Audience:**` line to the ROLE section of TEXT_EDITOR.md
- [ ] 1.12 Add an explicit `**Audience:**` line to the ROLE section of TRANSLATOR.md
- [ ] 1.13 Add a `**Success:**` completion definition to the ROLE section of all 12 subagent prompts

## 2. Add Knowledge Cutoff & Degradation Rules

- [ ] 2.1 Add a knowledge-cutoff line and graceful-degradation rules to the RULES section of all 12 subagent prompts

## 3. Add Clarification & Error Fallback Rules

- [ ] 3.1 Add a "when ambiguous, ask" clarification rule to the RULES section of all 12 subagent prompts
- [ ] 3.2 Add an error-fallback behavior rule (report rather than loop on tool failures) to the RULES section of all 12 subagent prompts

## 4. Convert Prose Capabilities to Tool Names

- [ ] 4.1 Convert the prose CAPABILITIES in SEO_ANALYST.md to explicit tool-call syntax
- [ ] 4.2 Convert the prose CAPABILITIES in TEXT_EDITOR.md to explicit tool-call syntax
- [ ] 4.3 Convert the prose CAPABILITIES in TRANSLATOR.md to explicit tool-call syntax

## 5. Verify Audit Threshold

- [ ] 5.1 Re-run the audit-sys-prompt framework against all 12 subagent prompts and confirm each scores ≥ 4.2 with no criterion ≤ 3.0
- [ ] 5.2 Confirm no prompt regresses below its current score and the three prose-capability prompts now reference tool names
