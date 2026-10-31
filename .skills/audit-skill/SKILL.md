---
name: audit-skill
description: Audits Agent Skills SKILL.md files against the protocol specification and best practices. Identifies issues across 10 categories: schema violations, naming, description quality, structure, progressive disclosure, file references, best practices, calibration, content quality, and optional directories. Produces a structured report with severity levels and actionable fixes.
license: BSD 3-Clause
compatibility: Requires Node.js 24+. Reads SKILL.md files from any directory. No network access needed.
metadata:
  version: 1.0.0
  category: quality-assurance
  agent: documentation
---

# Audit Skill

Audits Agent Skills `SKILL.md` files against the Agent Skills specification and best practices. Produces a structured report with severity levels and actionable fixes.

**Note:** This skill operates offline. Do not rely on external URLs for validation — use the spec constraints defined below.

## Usage

Pass the path to the skill directory as a chain instruction:

```
audit-skill /path/to/skill-directory
```

The skill path is the first argument after `audit-skill` in the instruction. The agent reads the SKILL.md from that directory and produces a structured audit report.

## Audit Categories

Each skill is checked against 10 categories. Every finding includes a severity level:

| Severity | Meaning |
|----------|---------|
| **ERROR** | Protocol violation — will fail validation |
| **WARN** | Best practice violation — likely to cause problems |
| **INFO** | Suggestion — optional improvement |

### 1. Schema Violations (ERROR)

Check frontmatter fields against spec constraints:

- **`name`**: Required. Max 64 characters. Non-empty.
- **`description`**: Required. Max 1024 characters. Non-empty.
- **`compatibility`**: Optional. Max 500 characters if provided.
- **`metadata`**: Optional. Must be a string-to-string map (no nested objects) per the standard spec. If the project uses an extended spec that allows nested metadata, skip this check.
- **`license`**: Optional. No length constraint, but keep it short.

**Note:** `allowed-tools` is NOT part of the standard agent skills spec. If present, log it as INFO (non-standard field) but do not flag as ERROR.

Parse the YAML frontmatter and validate each field. Report any constraint violations.

### 2. Naming Issues (ERROR)

Validate the `name` field against naming rules:

- Must be 1–64 characters
- Only lowercase alphanumeric (`a-z`, `0-9`) and hyphens (`-`)
- Must not start or end with a hyphen
- Must not contain consecutive hyphens (`--`)
- Must match the parent directory name

Check both the frontmatter `name` field and the actual directory name. Report mismatches.

### 3. Description Quality (WARN)

Evaluate the `description` field for quality:

- **Too short**: Less than 20 characters — likely insufficient
- **Too long (WARN)**: Over 800 characters — consider trimming for readability
- **Too long (ERROR)**: Over 1024 characters — exceeds spec maximum
- **Missing "when to use"**: Should describe both what the skill does AND when to use it. Look for phrases like "use when", "for", "handles", "processes". A description that only says what it does without triggering context is weak.
- **Vague language**: Contains generic phrases like "helps with", "deals with", "manages" without specific context
- **Missing keywords**: Should include specific domain keywords that help agents identify relevant tasks

Good description pattern: `[Action] [domain]. Use when [triggering context].`

### 4. Structure Issues (WARN)

Check the Markdown body organization:

- **No heading**: Body should start with a heading (`# Title`)
- **No sections**: Should have at least 2 subheadings (`## Section`) for navigability
- **No examples**: Should include at least one code example or usage example
- **No step-by-step**: Should have numbered steps or a clear workflow for non-trivial skills
- **No edge cases**: Should mention common edge cases or error conditions

A well-structured skill has: title, overview, steps/workflow, examples, edge cases/gotchas.

### 5. Progressive Disclosure (WARN)

Check for proper use of progressive disclosure:

- **Too large**: SKILL.md exceeds or equals 500 lines (>= 500) — should split into references
- **Token-heavy**: If body exceeds ~5000 tokens, recommend splitting
- **Missing references**: If the skill has detailed content (scripts, templates, schemas), check for `references/` or `assets/` directory usage
- **No conditional loading**: If using references, should tell the agent *when* to load them (e.g., "Read `references/api-errors.md` if the API returns a non-200 status")

A skill under 200 lines rarely needs progressive disclosure. Flag only when content is substantial but not properly split.

### 6. File Reference Issues (ERROR/WARN)

Check file references within the SKILL.md:

- **Broken references (ERROR)**: References to files in `references/`, `assets/`, or `scripts/` that don't exist
- **Deep nesting (WARN)**: References more than one level deep (e.g., `references/subdir/file.md`) — spec recommends one level deep
- **Relative paths**: All references should be relative to the skill root
- **Missing referenced files**: If the body mentions a script or reference, verify it exists

Check for markdown link syntax `[text](path)` and code block references. Use `ls` to verify file existence.

### 7. Best Practices (WARN/INFO)

Check against best practices from the spec:

- **Missing gotchas**: Non-trivial skills should have a "Gotchas" or "Common pitfalls" section
- **Missing templates**: If the skill produces structured output, should include a format template
- **Missing checklists**: Multi-step workflows should have a checklist
- **Missing validation**: Complex skills should include a validation step
- **No scripts for repeated logic**: If the skill describes the same logic repeatedly, consider bundling a script in `scripts/`
- **No defaults**: When multiple approaches exist, should pick a default and mention alternatives briefly

### 8. Calibration Issues (WARN)

Check instruction specificity:

- **Too vague**: Instructions like "handle errors appropriately", "follow best practices", "use good judgment" without specifics. Flag if > 10% of instructions are vague.
- **Too prescriptive**: Overly rigid instructions for tasks that tolerate variation (e.g., "always use X" when Y is equally valid)
- **No why explanations**: Flexible instructions should explain *why*, not just *what*. Flag if > 20% of instructions lack rationale.
- **Menus instead of defaults**: Lists multiple tools/approaches as equal options without a recommended default
- **Procedure vs declaration**: Skill teaches *what to produce* for a specific instance instead of *how to approach* a class of problems

Concrete example of vague instruction: "Make sure the code is good" → Should specify: "Follow AGENTS.md §3.3 error handling rules and §3.5 testing conventions."

**Structured decision:** If the harness provides a structured-decision tool (e.g., `decision`), use it to judge whether an instruction is too vague to be actionable. Issue one `noul` question per instruction, passing the instruction as state.

```
Question: "Is this instruction too vague to be actionable?"
Type: noul
Criteria:
  false = references a concrete file, rule, or pattern
  true  = no specific action or rule referenced
Example answer: true
```

**Important:** The `noul` type returns a *single float in [0,1]*, not a label — it is the probability of `true`. Interpret it as: `≥ 0.6` → true (vague), `≤ 0.4` → false (actionable), between → unknown. Fall back to the calibration criteria above if no decision tool is available.

### 9. Content Quality (WARN)

Check for domain-specific expertise:

- **Generic instructions**: Relies on general knowledge instead of project-specific or domain-specific context. Flag if > 30% of content is generic.
- **Missing domain context**: Doesn't include API patterns, edge cases, or project conventions
- **Explains the obvious**: Describes basic concepts the agent already knows (e.g., "PDF files are a common file format"). Flag if > 15% of content explains obvious concepts.
- **No real-world examples**: Lacks concrete examples from actual usage

A good skill adds what the agent lacks and omits what it already knows. Concrete example: Instead of "Handle errors", say "Catch `ENOENT` when reading config files and fall back to defaults."

### 10. Optional Directories (INFO)

Check usage of optional directories:

- **`scripts/` present**: Verify scripts are self-contained, executable, and documented. Flag if scripts reference files outside the skill directory.
- **`references/` present**: Verify reference files are focused (under 200 lines each) and not too large. Flag if any reference exceeds 500 lines.
- **`assets/` present**: Verify assets are templates, images, or data files (not code). Flag if assets contain executable code.
- **Missing opportunities**: If the skill has large templates or repeated logic, suggest `scripts/` or `assets/`
- **Empty directories**: Flag if `scripts/`, `references/`, or `assets/` exist but are empty — remove them or populate them.

## Execution

1. **Read the SKILL.md** from the provided skill directory:
   ```bash
   cat "$SKILL_PATH/SKILL.md"
   ```
2. **Parse the YAML frontmatter** — extract all fields using a YAML parser:
   ```bash
   # Extract frontmatter (between first and second ---)
   sed -n '1,/^---$/p' "$SKILL_PATH/SKILL.md" | tail -n +2 | head -n -1
   ```
   Parse the YAML frontmatter to extract fields. If no YAML parser is available, parse manually with `grep`/`sed`.
3. **Read the Markdown body** — analyze structure and content:
   ```bash
   # Count lines in body (after frontmatter)
   sed '1,/^---$/d' "$SKILL_PATH/SKILL.md" | wc -l
   # Count subheadings
   grep -c '^## ' "$SKILL_PATH/SKILL.md" || true
   # Count code blocks (opening ``` lines, divide by 2 for block count)
   BLOCK_COUNT=$(grep -c '^```' "$SKILL_PATH/SKILL.md" 2>/dev/null || echo 0)
   echo "Code blocks: $((BLOCK_COUNT / 2))"
   ```
4. **Check for optional directories** — list `scripts/`, `references/`, `assets/` if they exist:
   ```bash
   for dir in scripts references assets; do
     if [ -d "$SKILL_PATH/$dir" ]; then
       echo "$dir/ exists ($(ls -1 "$SKILL_PATH/$dir" 2>/dev/null | wc -l) files)"
     else
       echo "$dir/ — not present"
     fi
   done
   ```
5. **Validate file references** — check that referenced files exist:
   ```bash
   # Extract file paths from markdown links and code references
   grep -oE '\[[^]]*\]\([^)]*\)' "$SKILL_PATH/SKILL.md" | sed 's/.*(\([^)]*\))/\1/' | while read ref; do
     if [ ! -f "$SKILL_PATH/$ref" ]; then
       echo "BROKEN: $ref"
     fi
   done
   ```
6. **Apply all 10 category checks** — collect findings
7. **Produce a structured report** — grouped by category, sorted by severity. Skip categories with no findings.

## Output Format

Produce a structured report in this format:

```
## Skill Audit: <skill-name>
- **Path:** <path-to-skill>
- **Status:** <pass | warnings | errors>
- **Findings:** <N> total (<E> errors, <W> warnings, <I> info)

### Schema Violations
- [ERROR] description exceeds 1024 characters (found: 1203)

### Naming Issues
- [WARN] name contains consecutive hyphens: "my--skill"

### Description Quality
- [WARN] description is only 12 characters — consider expanding
- [INFO] missing "when to use" context

### Structure Issues
- [WARN] no examples found — add at least one usage example

### Progressive Disclosure
- [INFO] skill is 45 lines — no splitting needed

### File References
- [ERROR] references `scripts/extract.py` but file does not exist

### Best Practices
- [WARN] no gotchas section — consider adding common pitfalls

### Calibration
- [WARN] vague instruction: "handle errors appropriately"

### Content Quality
- [INFO] explains basic concepts the agent likely already knows

### Optional Directories
- [INFO] no scripts/ directory — consider bundling repeated logic

### Summary
- **Severity breakdown:** 2 errors, 4 warnings, 3 info
- **Top priority fixes:** [list top 3 actionable items]
```

**Note:** Skip categories with no findings. Only include sections that have at least one finding.

## Heuristics Reference

Use these concrete thresholds:

| Check | Threshold | Severity |
|-------|-----------|----------|
| Name length | > 64 chars | ERROR |
| Description length | < 20 chars | WARN |
| Description length | > 800 chars | WARN |
| Description length | > 1024 chars | ERROR |
| Compatibility length | > 500 chars | ERROR |
| SKILL.md lines | > 500 lines | WARN |
| Subheadings | < 2 | WARN |
| Examples | 0 found | WARN |
| File references | Broken | ERROR |
| Reference depth | > 1 level | WARN |

## Error Handling

- **SKILL.md not found:** Report the error and stop. No audit possible.
- **Invalid YAML frontmatter:** Report the parse error and stop.
- **Directory not found:** Report the error and stop.
- **Permission denied:** Report the specific file/directory and stop. Do not attempt to bypass permissions.
- **Partial audit:** If some checks fail but others succeed, report what was accomplished. Never leave the audit half-done.

## Example

```
User: audit-skill /home/jason/Projects/madz/skills/my-skill

Agent: Auditing skill "my-skill"...

## Skill Audit: my-skill
- **Path:** /home/jason/Projects/madz/skills/my-skill
- **Status:** warnings
- **Findings:** 5 total (0 errors, 4 warnings, 1 info)

### Description Quality
- [WARN] description is only 15 characters — consider expanding
- [INFO] missing "when to use" context

### Structure Issues
- [WARN] no examples found — add at least one usage example
- [WARN] only 1 subheading — add more sections for navigability

### Best Practices
- [WARN] no gotchas section — consider adding common pitfalls

### Progressive Disclosure
- [INFO] skill is 30 lines — no splitting needed

### Summary
- **Severity breakdown:** 0 errors, 4 warnings, 1 info
- **Top priority fixes:**
  1. Expand description to at least 20 characters with "when to use" context
  2. Add at least one usage example
  3. Add a gotchas section for common pitfalls
```

### Error Case Example

```
User: audit-skill /home/jason/Projects/madz/skills/nonexistent-skill

Agent: Auditing skill "nonexistent-skill"...

## Skill Audit: nonexistent-skill
- **Path:** /home/jason/Projects/madz/skills/nonexistent-skill
- **Status:** error
- **Findings:** 1 total (1 errors, 0 warnings, 0 info)

### Schema Violations
- [ERROR] SKILL.md not found at /home/jason/Projects/madz/skills/nonexistent-skill/SKILL.md

### Summary
- **Severity breakdown:** 1 errors, 0 warnings, 0 info
- **Top priority fixes:**
  1. Verify the skill path is correct and the SKILL.md file exists
```