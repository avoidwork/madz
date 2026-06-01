## Context

The memory system persists conversations, tool outputs, errors, and user-provided context notes in `memory/`. User context lives in `memory/context/` as free-form markdown files that are prepended to the LLM prompt. Currently, `memory/context/` starts empty and users must manually create context notes via `:context add <text>`. Without a user profile, the agent lacks foundational knowledge about preferences, personal context, and habits that would meaningfully inform responses.

The agent uses LangGraph for state machines, with skills/tools registered in a sandbox (per AGENTS.md §2.0). Tier 1 tools have no permission requirements. Tier 2 tools require `network:outbound`. The `customize` tool reads/writes local files only — no network calls — so it is a Tier 1 tool.

## Goals / Non-Goals

**Goals:**
- Provide a zero-touch onboarding path for user context when `memory/context/` is empty
- Gather a structured, canonical user profile covering identity, preferences, and personal details
- Write profile data as markdown memory files following existing memory conventions
- Update the memory index with entries for newly created files

**Non-Goals:**
- PII encryption or access control for memory files
- External profile sources (import from social media, contacts, etc.)
- Periodic profile updates or automatic profile refresh
- Deleting or overwriting existing context files
- Real-time profile synchronization across sessions (profile is read once at startup)

## Decisions

### Decision: Q&A is interactive prompt-based, not a form

The customize tool reads questions from the user via stdin and writes answers to files. It uses Node.js `readline` for the interactive session. Rationale: the agent framework operates in a terminal context (TUI); an interactive prompt is the natural interaction model. A web-based form or inline TUI component would require significantly more infrastructure.

### Decision: Canonical files split into three categories

Instead of a single monolithic file, the tool writes:
- `memory/context/user-profile.md` — identity: name, handle, DOB, location, relationship status
- `memory/context/preferences.md` — communication and operational preferences: timezone, language, dietary restrictions, tone
- `memory/context/personal.md` — personal life: pets, hobbies, interests, free-form insights

Rationale: splitting reduces cognitive load when the LLM reads these as context. The user can edit individual files without touching unrelated sections.

### Decision: Tool skips existing files — never overwrites

If a context file already exists (even partially), the tool skips only the fields covered by that file. It never deletes or overwrites. Rationale: user effort should be preserved. If the user typed "Name: Alex" before, the tool remembers that and only asks for missing fields.

### Decision: Memory index is updated atomically

The tool reads `memory/_index.md`, appends entries for new files, and writes back. Uses file lock (via `flock`-style atomic write: `writeFileSync` to a temp path then `renameSync`) to prevent race conditions.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| User skips sensitive questions (DOB, relationship) | Tool marks skipped fields as "not provided" in files; LLM sees placeholder instead of hallucinating |
| User profile is outdated over time | No auto-update; user can re-run the tool or manually edit files. Non-goal by design. |
| PII stored in plaintext files in `memory/` | Memory files are already local on disk. If encryption is desired, it is a future enhancement, not in scope. AGENTS.md does not mandate encryption for memory files. |
| Tool hangs if readline encounters an error | Error handling wraps the readline session; graceful fallback writes whatever was collected so far |
