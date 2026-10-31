# Scripts

Place executable scripts here. Supported languages depend on the agent implementation.

The harness detects interpreters via file extension:
- `.py` — Python 3
- `.sh`, `.bash` — Bash
- `.js`, `.mjs` — Node.js
- `.rb` — Ruby
- `.ts` — Node.js with tsx

Scripts can reference other files in the skill using relative paths from the skill root.
