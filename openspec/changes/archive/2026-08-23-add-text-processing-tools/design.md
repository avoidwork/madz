## Context

The madz project has tools for file extraction, web search, and image generation, but lacks dedicated text processing capabilities. Marketing and content workflows require structured tooling for copywriting, SEO analysis, and translation. Currently the agent relies on chain-of-thought LLM calls without structured tooling, producing inconsistent output and losing context across turns.

## Goals / Non-Goals

**Goals:**
- Add three MVP tools: text (copywriting/editing), seo (SEO analysis), translate (translation with language detection)
- Each tool follows the existing pattern: zod schema, impl function, registration in index.js
- Structured JSON output from all tools for reliable agent parsing
- Input validation with 10,000 character limit across all tools
- Translation tool includes caching (24h TTL) and rate limiting (10 req/s)

**Non-Goals:**
- Social media content generation (deferred)
- Structured data extraction (deferred)
- Text comparison (deferred)
- Fallback to LLM-based translation (deferred)

## Decisions

1. **Three separate tools, not one monolithic tool.** Each tool has a distinct purpose and may have different dependencies (translate needs google-translate-api). This keeps each tool focused and testable.

2. **LLM calls via existing agent framework for text and seo tools.** No additional npm dependencies needed. Each action maps to a specific system prompt. This is consistent with how other tools in the codebase work.

3. **google-translate-api (v3.x) for translate tool.** Lightweight wrapper around Google Translate API. Requires API key via env var. Alternative (LibreTranslate) deferred — requires server setup.

4. **tiny-lru for caching.** The project already uses tiny-lru for caching elsewhere. Reuse this pattern for translation result caching.

5. **Structured JSON output, not free-text.** All tools return JSON with result, action, and metadata fields. This allows the agent to parse results reliably and use them in subsequent turns.

6. **Input size limit of 10,000 characters.** Prevents excessive LLM token usage. Larger inputs are rejected with a clear error message.

## Risks / Trade-offs

- **Translation API dependency:** google-translate-api requires an API key. Users without one cannot use the translate tool. Mitigation: clear error message, document the requirement.
- **LLM latency:** Text and seo tools depend on LLM calls which can be slow. Mitigation: document expected latency, consider adding timeouts.
- **Rate limiting:** Translation API has rate limits. Client-side rate limiting (10 req/s) prevents triggering provider blocks but may cause queuing under heavy use.
- **No NLP libraries:** Keyword density uses string matching, not proper NLP. This is intentional for simplicity but may produce less accurate results for complex text.

## Migration Plan

No migration needed — these are new tools. Existing tools are unaffected.

## Open Questions

- Should the text tool support chunking for inputs > 10,000 characters, or reject them outright?
- Should SEO tool include a "content score" metric based on keyword usage, readability, and length?