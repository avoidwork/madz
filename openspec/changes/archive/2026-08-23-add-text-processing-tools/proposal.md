## Why

The existing tools handle file extraction, web search, and image generation — but there is no dedicated capability for text processing and content generation. Marketing workflows need structured tooling for tone adjustment, summarization, rewriting, SEO analysis, social media content generation, translation, and text-to-structured-data. Currently the agent must rely on the LLM chain-of-thought without structured tooling, which is inconsistent and loses context.

## What Changes

- Add `text` tool: copywriting, editing, summarization, rewriting, grammar correction, length adjustment (shorten/expand)
- Add `seo` tool: keyword density analysis, meta description generation, SERP analysis, content optimization suggestions
- Add `translate` tool: multi-language translation with language detection, using google-translate-api
- Register all three tools in `src/tools/index.js`
- Add `google-translate-api` dependency to package.json
- Add unit tests for each tool

## Capabilities

### New Capabilities
- `text-processing`: Copywriting and editing operations — summarize, rewrite, tone adjustment, grammar correction, length adjustment
- `seo-analysis`: SEO analysis operations — keyword density, meta description generation, SERP analysis, content optimization
- `translation`: Multi-language translation and language detection with caching and rate limiting

### Modified Capabilities
<!-- None — all new capabilities -->

## Impact

- **Affected code**: `src/tools/index.js` (registration), `src/tools/text.js` (new), `src/tools/seo.js` (new), `src/tools/translate.js` (new)
- **Dependencies**: `google-translate-api` (v3.x) added to package.json
- **Tests**: New test files in `tests/unit/tools/text.test.js`, `tests/unit/tools/seo.test.js`, `tests/unit/tools/translate.test.js`
- **Security**: Translation API key via `process.env.GOOGLE_TRANSLATE_API_KEY` — never stored in config files

## Non-goals

- Social media content generation (post scheduling, platform-specific formatting) — deferred to follow-up PR
- Structured data extraction (entity extraction, sentiment analysis, topic classification) — deferred
- Text comparison (diff, similarity scoring, plagiarism detection) — deferred
- Fallback to LLM-based translation when API is unavailable — deferred