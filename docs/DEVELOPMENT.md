# Development

Setting up for local development, the directory layout, testing, and extending skills.


```
/
├── index.js                    # Application entry point
├── config.yaml                 # Centralized configuration
├── .husky/                     # Git hooks (lint, fmt, tests)
├── src/
│   ├── agent/                  # Deep Agents orchestrator (coding-agent)
│   ├── config/                 # YAML parsing & Zod schema validation
│   ├── memory/                 # Markdown file persistence
│   ├── provider/               # LLM model factory (OpenAI)
│   ├── shared/                 # Cross-cutting utilities (logger.js)
│   ├── skills/                 # Agent Skills spec discovery, validation & permissions
│   ├── sandbox/                # Process sandboxing & capability enforcement
│   ├── scheduler/              # Cron-based job runner
│   ├── session/                # Per-session state & context windows
│   ├── stream/                 # Stream transformers
│   ├── telemetry/              # OpenTelemetry tracing
│   ├── tools/                  # Built-in LangChain tools
│   │   ├── code/               # Semantic code search & indexing (searchCode, indexCode)
│   │   ├── config/             # getConfig tool
│   │   ├── pdf/                # PDF generation & manipulation (generatePdf)
│   │   ├── pptx/               # PPTX creation (generatePptx)
│   │   ├── session/            # Session search (searchSession)
│   │   └── ...                 # Other tool modules
│   ├── vector/                 # Vector search pipeline
│   │   ├── chunker.js          # Line-based file chunking
│   │   ├── embedder.js         # Embedding generation (local/OpenAI)
│   │   ├── store.js            # sqlite-vec vector store
│   │   └── indexer.js          # Scanning, embedding & storage orchestration
│   ├── workspace/              # Workspace rules discovery (AGENTS.md)
│   └── tui/                    # Ink React terminal UI
├── tests/
│   ├── unit/                   # Unit tests per module
│   └── integration/            # End-to-end flow tests
└── memory/                     # Persistent markdown storage
```


## Testing

```bash
# Run all tests
npm run test

# Generate coverage report
npm run coverage

# Auto-fix lint & formatting
npm run fix

# Check lint & formatting (no fix)
npm run lint
```

The pre-commit hook runs linting, formatting, and tests (targeting maintained code coverage). A commit will fail if any gate does not pass.

## Development

```bash
npm install
npm run fix          # Format and lint-fix all files
npm run test         # Verify changes
npm run coverage     # Generate and verify coverage
```

### Extending Skills

Skills follow the [Agent Skills spec](https://agentskills.io/specification). Each skill is a directory under `skills/` containing a `SKILL.md` file with YAML frontmatter.

**Programmatic creation:** Use the `createSkill` tool to create new skills from within agent conversations. The tool validates the name (lowercase alphanumeric + hyphens, 1-64 chars), description (1-1024 chars), and optional fields (`license`, `compatibility`, `metadata`) against spec constraints before writing `SKILL.md`. It can optionally scaffold a `scripts/` subdirectory with a `README.md` placeholder for executable scripts.

**Manual creation:**

1. Create a directory under `skills/your-skill/`.
2. Add a `SKILL.md` file with YAML frontmatter:
   ```yaml
   ---
   name: your-skill
   description: What this skill does and when to use it.
   license: Apache-2.0          # optional
    compatibility: Node.js 26+   # optional, max 500 chars
   metadata:
     author: me
     version: "1.0"             # optional string map
   ---
   Step-by-step instructions for the agent...
   ```
3. (Optional) Place executable scripts under `skills/your-skill/scripts/`. Supported extensions: `.py` (Python 3), `.sh` (Bash), `.js`/`.mjs` (Node.js), `.rb` (Ruby), `.ts` (Node.js + tsx).
4. Restart the harness — the skills registry auto-discovers new skills on boot.

### LangChain Reasoning Patch

vLLM sends reasoning tokens in a field called `reasoning` in the streaming delta and final message. LangChain's OpenAI converter only reads `reasoning_content` (OpenAI's field name), so vLLM's reasoning tokens are silently dropped without a patch.

A `postinstall` script at `scripts/patch-langchain-reasoning.mjs` applies two patches to `node_modules/@langchain/openai/dist/converters/completions.js`:

1. **`convertCompletionsMessageToBaseMessage`** — falls back `message.reasoning` → `reasoning_content` for non-streaming final messages
2. **`convertCompletionsDeltaToBaseMessageChunk`** — same for streaming deltas

The patch is idempotent — it checks if the patch is already applied before modifying. It runs automatically on `npm install` via the `postinstall` hook.

