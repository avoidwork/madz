---
name: "reflection"
description: "Generate a narrative reflection summary from recent session history to capture mood, energy, and interaction quality."
metadata:
  author: "madz"
  version: "1.1"
  agent: "orchestrator"
---

Generate a concise, narrative reflection summary from recent session history and write it to `memory/context/reflection.md`.

## Steps

1. **Discover session files**

   Run:
   ```bash
   find . -maxdepth 1 -type f -mtime -8 -printf "%T+\t%p\n" | grep -v "scan-issues" | grep -v "reflection skill" | sort -r | head -50
   ```
   Read only the files returned. Each session file has YAML frontmatter with (at minimum) a `startedAt` field (ISO 8601 timestamp).

2. **Generate the narrative summary**

   Read each session's JSON messages (the body after frontmatter). For each session, produce a brief paragraph that captures:
   - The mood, energy, or emotional tone the user brought to the conversation
   - The nature of the interaction (e.g., playful, focused, exploratory, frustrated, collaborative)
   - High-level context about what was being worked on (but NOT technical details, code, or step-by-step procedures)

   Combine all paragraphs into a single flowing narrative. Connect sessions in reverse-chronological order (newest first) so the reader can follow how the relationship evolved over the past week.

   Keep the output in the range of 200-400 words. Prioritize recent sessions: give more detail to the newest ones, summarize older ones sparingly.

3. **Write `memory/context/reflection.md`**

   Write the result as a Markdown file with frontmatter:

   ```
   ---
   updatedDate: "<current ISO 8601 timestamp>"
   timestamp: "<same as updatedDate>"
   ---
   ```

   Follow the frontmatter with the narrative body. Always write the file, even if there is nothing to report.

4. **Ensure size constraints**

   The total file size (frontmatter + body) MUST NOT exceed 5 kB (~1.2k tokens). If the generated summary would exceed this limit, trim oldest sessions first until the file fits. Never write a file larger than 5 kB.

## Edge Cases

- **No sessions in the 7-day window**: Write `reflection.md` with only frontmatter. No body content. No placeholder text.
- **Empty sessions directory**: Same as above — write frontmatter only.
- **Session with no valid `startedAt`**: Skip that file entirely. Do not error.
- **Only one valid session**: Write a single-paragraph summary.

## Guardrails

- Do NOT reproduce factual content: no code snippets, no technical decisions, no step-by-step procedures.
- Do NOT extract action items, tasks, or deliverables.
- Focus on the qualitative experience: energy, mood, rhythm, trust, collaboration quality.
- Always write `reflection.md`. Never skip or leave it unwritten.
- Keep the tone neutral and observational — it is your opinion of how the work relationship has been, not a judgment of the user.

---
