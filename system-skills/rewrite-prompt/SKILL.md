---
name: rewrite-prompt
description: Rewrites raw user prompts to be clearer, more structured, and more actionable for LLM consumption. Improves clarity, adds relevant context, structures the request, and preserves the user's original intent.
license: MIT
compatibility: Requires Node.js 24+. No system packages or network access needed.
permissions:
  - filesystem:read
  - process:spawn
---

# Rewrite Prompt

Accepts a raw user prompt and rewrites it to be more effective for LLM consumption.

## Purpose

Users often write prompts that are vague, unstructured, or lack the context an LLM needs to provide the best response. This skill intercepts raw input and transforms it into a clearer, more structured, and more actionable prompt — without changing the user's original intent.

## How It Works

1. **Analyze intent** — Identify the user's core request and desired outcome
2. **Detect gaps** — Find missing context the LLM would need (environment, constraints, format expectations)
3. **Restructure** — Organize into a clear format: context → task → constraints → output format
4. **Preserve intent** — Ensure the rewritten prompt maintains semantic equivalence with the original

## Input

The skill accepts a raw prompt via stdin or a file argument:

```bash
echo "write code for a list" | rewrite-prompt
rewrite-prompt prompt.txt
```

## Output

The rewritten prompt is printed to stdout. If the input is empty or invalid, an error message is printed to stderr and the script exits with code 1.

## Edge Cases

- **Empty input**: Returns an error message indicating no input was provided
- **Already-structured prompts**: Produces minimal changes — only minor improvements
- **Very long prompts**: Processes the full prompt without truncation
- **Multi-part requests**: Preserves all parts while improving clarity of each
- **Non-English input**: Rewrites while preserving the original language

## Constraints

- Never change the user's original intent
- Never invent context or assumptions about what the user wants
- Never remove information the user provided
- Keep the rewritten prompt concise — avoid unnecessary verbosity