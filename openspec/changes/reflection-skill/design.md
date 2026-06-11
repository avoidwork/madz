## Context

The agent already reads context files from `memory/context/` via `src/memory/context.js`, which loads `profile.md` and recent user-provided `.md` files sorted by `timestamp` frontmatter, limited to 10 entries. Session files live in `memory/sessions/*.md` with frontmatter (`startedAt`, `endedAt`, `threadId`, `messageCount`) and a JSON array of messages. No skill currently derives qualitative insights about the user-agent relationship from session history.

## Goals / Non-Goals

**Goals:**
- Create a reusable skill that generates a reflection summary from the last 7 days of sessions
- Output a narratively meaningful summary capturing energy, mood, and interaction quality
- Write the summary to `memory/context/reflection.md` so it is loaded automatically with other context
- Keep the skill lightweight — no external APIs, no state beyond the filesystem

**Non-Goals:**
- Session content summarization (no extraction of factual content, decisions, or tasks)
- Persistent state storage or database; pure filesystem-based
- Real-time or incremental updates; the reflection is computed on-demand
- User-facing UI; this is an agent-readable context artifact

## Decisions

1. **Skill-based implementation rather than a core module.** A skill keeps this optional and discoverable through the skill registry. The user activates it when they want reflection. Core memory logic stays focused on persistence.

2. **Read session files directly, not through the session loader.** The existing `src/memory/session/loader.js` is tied to the session lifecycle (create, save, load). Reading raw files from `memory/sessions/` is simpler and avoids coupling the skill to lifecycle internals.

3. **Write to `memory/context/reflection.md` (not a separate location).** The `context.js` loader picks up all `.md` files in `memory/context/` sorted by `timestamp` frontmatter (limit 10). User-facing memory files like `halo.md` use `createdDate`/`updatedDate`. The `memory` tool writes key-value entries to `memory/context/` but uses only `createdDate`/`updatedDate` without `timestamp` — making it unsuitable for ensuring the reflection gets sorted prominently. `reflection.md` will use `updatedDate` (aligning with user-facing memory format) plus a `timestamp` field (so the context loader picks it up and sorts it correctly).

4. **Narrative summary, not structured JSON.** The reflection is meant to be read by the agent as "my current opinion of how our work relationship has been." A prose narrative fits this purpose far better than machine-readable tags.

## Risks / Trade-offs

- **Privacy**: Reading session content means the reflection may include sensitive user statements. Mitigation: reflection only runs when explicitly invited as a skill; it is not automatic. The output is a high-level summary, not a verbatim recap.
- **Staleness**: Without periodic regeneration, `reflection.md` could become stale. Mitigation: the skill is designed to be re-invoked whenever the user wants a fresh look, and the 7-day window ensures only recent sessions are considered.
- **Context window bloat**: `reflection.md` adds to the context loaded on every turn. Mitigation: the skill itself controls output length, targeting ~200-400 words. The context loader's 10-file limit naturally bounds it. The skill also enforces a hard cap of 5 kB total file size.
