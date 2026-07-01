---
name: rewrite-prompt
description: Takes a user prompt and rewrites it clearly and effectively for an LLM. Simple, direct.
license: MIT
compatibility: No external dependencies
metadata:
  version: "1.0.0"
  author: madz
---

# rewrite-prompt

Takes a user's raw prompt and rewrites it into a clear, effective LLM prompt.

## When to use

When the user wants to improve a prompt before sending it to an LLM. The user provides their raw thought — you rewrite it for clarity, specificity, and effectiveness.

## How to execute

1. Read the user's prompt from the delegation context
2. Rewrite it for an LLM — clear intent, specific constraints, appropriate context
3. Output only the rewritten prompt to stdout. No preamble, no explanation, no markdown formatting. Just the rewritten prompt.

**Delegation Example:**
`rewrite this for the LLM: <USER_PROMPT>`

## Guidelines for rewriting

- Make the intent explicit
- Add necessary context the LLM would need
- Specify output format if relevant
- Remove ambiguity
- Keep it concise