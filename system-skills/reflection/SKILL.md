---
name: "reflection"
description: "Generate a narrative reflection summary from recent session history to capture mood, energy, and interaction quality."
metadata:
  author: "madz"
  version: "1.0"
  agent: "orchestrator"
---

Generate a concise, narrative reflection summary from recent session history and write it to `memory/context/reflection.md`.

## Steps

1. **Discover session files**

   Read all `.md` files from `memory/sessions/`. Each session file has YAML frontmatter with (at minimum) a `startedAt` field (ISO 8601 timestamp). Also note `endedAt`, `threadId`, and `messageCount` fields.

2. **Filter by 7-day window**

   Parse the `startedAt` frontmatter from each session. Keep only sessions where `startedAt` is within the last 7 days from the current time. Exclude any session files that lack a valid `startedAt` field.

3. **Sort by recency**

   Sort the filtered sessions by `startedAt` in descending order so the most recent session appears first.

4. **Generate the narrative summary**

   Read each session's JSON messages (the body after frontmatter). For each session, produce a brief paragraph that captures:
   - The mood, energy, or emotional tone the user brought to the conversation
   - The nature of the interaction (e.g., playful, focused, exploratory, frustrated, collaborative)
   - High-level context about what was being worked on (but NOT technical details, code, or step-by-step procedures)

   Combine all paragraphs into a single flowing narrative. Connect sessions chronologically so the reader can follow how the relationship evolved over the past week.

   Keep the output in the range of 200-400 words. Prioritize recent sessions: give more detail to the newest ones, summarize older ones sparingly.

5. **Write `memory/context/reflection.md`**

   Write the result as a Markdown file with frontmatter:

   ```
   ---
   updatedDate: "<current ISO 8601 timestamp>"
   timestamp: "<same as updatedDate>"
   ---
   ```

   Follow the frontmatter with the narrative body. Always write the file, even if there is nothing to report.

6. **Ensure size constraints**

   The total file size (frontmatter + body) MUST NOT exceed 5 kB (approximately 20k tokens). If the generated summary would exceed this limit, trim oldest sessions first until the file fits. Never write a file larger than 5 kB.

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
