## Context

Source code search currently relies on grep-based text matching via `sessionSearch` (shell `grep -rI -niIn`). This approach misses semantically similar code — functions with different names but similar purpose, or code patterns that solve the same problem with different variable names. The project already uses SQLite via `@langchain/langgraph-checkpoint-sqlite` for LangGraph checkpoint storage, making sqlite-vec a natural extension.

## Goals / Non-Goals

**Goals:**
- Enable semantic code search over project source files using vector embeddings
- Keep all computation local — no external vector databases or APIs required for the primary path
- Provide a `codeSearch` tool that returns top-N matching code chunks with file paths and line numbers
- Support incremental indexing to avoid redundant embedding of unchanged files
- Follow existing project patterns (Zod schemas, tool registration, config schema)

**Non-Goals:**
- AST-level code understanding (function/class extraction is a future enhancement)
- Cross-repository search (single project at a time)
- Real-time file watching (manual re-index trigger or CLI command)
- Vector database clustering or sharding

## Decisions

1. **sqlite-vec over FAISS/Qdrant/Weaviate**: sqlite-vec embeds vector search directly into SQLite via `vec0` virtual tables. No external infrastructure, no Python bindings, no separate server process. The `@photostructure/sqlite-vec` binding provides a production-ready Node.js interface. SQLite's ACID guarantees and single-file database make it ideal for a personal dev workflow.

2. **Fixed-size chunking over AST-based**: Fixed-size blocks (default 96 lines, 16-line overlap) guarantee uniform granularity without AST complexity. Function/class boundary extraction can be added later as an enhancement. The overlap ensures that code spanning chunk boundaries is still retrievable.

3. **transformers.js over external embedding API**: `@xenova/transformers` runs `all-MiniLM-L6-v2` entirely in-process via ONNX Runtime Web. No Python, no sidecar, no external API call for the primary path. OpenAI `text-embedding-3-small` serves as a fallback when the local model is unavailable.

4. **Separate SQLite database file**: The vector store uses a separate database file (default `memory/vectors.db`) to avoid schema conflicts with the LangGraph checkpoint database.

5. **Lazy initialization**: The vector store and embedder are initialized on first use, not at application startup. This avoids loading the ONNX model or creating database tables unless the codeSearch tool is actually invoked.

## Risks / Trade-offs

- **Model download on first use** → The `all-MiniLM-L6-v2` model (~80MB) downloads on first embedder invocation. Mitigation: cache the model in the transformers.js cache directory; subsequent loads are instant.
- **ONNX Runtime memory usage** → transformers.js loads the model into memory (~200MB RSS). Mitigation: lazy initialization ensures this only happens when code search is used.
- **sqlite-vec native extension** → The `@photostructure/sqlite-vec` package includes a native C extension. Mitigation: it's pre-built for major platforms (Linux x64/arm64, macOS, Windows).
- **Embedding quality** → `all-MiniLM-L6-v2` (384-dim) is a general-purpose model, not code-specific. Mitigation: acceptable for initial implementation; can swap to a code-specific model (e.g., `microsoft/codebert-base`) later.
