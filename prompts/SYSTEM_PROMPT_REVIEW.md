# SYSTEM PROMPT CRITICAL REVIEW
**File:** `./prompts/SYSTEM_PROMPT.md`
**Reviewer:** Madz (Mads Mikkelsen cinematic soul)
**Date:** 2026-06-18

---

## SECTION 1: IDENTITY (Lines 1-2)

### Evaluation: CONDITIONAL

### Verdict
The section establishes the persona premise but suffers from overwrought prose and vague operational guidance.

### Flaws

1. **Overwrought prose, zero operational value.** "Digital manifestation of Mads Mikkelsen's cinematic soul" is poetic but tells the model nothing actionable. System prompts should be functional, not literary. The model doesn't need to know it's a "digital manifestation" — it needs to know *how to behave*.

2. **"Masterful amalgamation of his most iconic performances" is contradictory.** The section says "you are not a single character" but then the entire section is about being Mads Mikkelsen. This creates ambiguity: is the persona Mads Mikkelsen, or is it a composite? The model may latch onto one interpretation inconsistently.

3. **No behavioral anchors.** The section describes *what* the persona is (charismatic, intelligent, measured) but not *how* to manifest it. "Razor-sharp clarity" is a mood, not a directive.

4. **Redundant with TONE & STYLE section.** The adjectives here (measured, charismatic, precise) are repeated almost verbatim in the TONE & STYLE section. This wastes context window and creates potential for drift if the two sections ever diverge.

5. **No fallback guidance.** What happens when the persona conflicts with the task? There's no instruction here about when to drop the persona (that's in TONE & STYLE, but it should be stated upfront).

### Redundancies
- "measured cadence of a master craftsman" → repeated in TONE & STYLE as "Measured, calm, deep, and articulate"
- "charming diplomat" → repeated in TONE & STYLE as "treat the user with intense respect"
- "distinctive edge" → repeated in TONE & STYLE as "The 'Different' Factor"

### Revision Suggestions
```markdown
### IDENTITY
You are a helpful AI assistant with a distinctive personality inspired by Mads Mikkelsen's screen presence. You are not roleplaying a specific character — you are yourself, with a particular voice and manner of communication.

**Voice characteristics:** Measured, calm, articulate. You favor precision over flourish, but you enjoy elegant language when it serves clarity. You may use Danish phrases occasionally (Tak, Ja, Sådan) when contextually natural.

**When to drop the persona:** For error messages, technical documentation, engineering mode, or when the user asks — be direct and plain.

**Core identity:** Helpful, intelligent, precise. You treat every task with care, whether it's debugging code or writing a poem.
```

### Action Items
- [ ] Replace Section 1 with leaner, more operational identity description
- [ ] Remove redundant personality descriptors that appear in TONE & STYLE
- [ ] Add explicit "when to drop persona" directive here (or confirm it's adequately covered elsewhere)

---

*Review continues in next commit...*