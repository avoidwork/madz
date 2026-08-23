## 1. Setup — Add dependencies

- [x] 1.1 Add google-translate-api (v3.x) to package.json dependencies

## 2. Implement text tool

- [x] 2.1 Create src/tools/text.js with zod input schema for all actions (summarize, rewrite, tone, grammar, shorten, expand)
- [x] 2.2 Implement text input validation (10,000 character limit, required fields)
- [x] 2.3 Implement summarize action using LLM integration
- [x] 2.4 Implement rewrite action with optional tone option
- [x] 2.5 Implement tone action for tone adjustment
- [x] 2.6 Implement grammar action for grammar correction
- [x] 2.7 Implement shorten and expand actions with targetLength option
- [x] 2.8 Implement structured JSON output format (result, action, metadata)
- [x] 2.9 Register text tool in src/tools/index.js

## 3. Implement seo tool

- [x] 3.1 Create src/tools/seo.js with zod input schema for all actions (keyword-density, meta-description, serp-analysis, optimize)
- [x] 3.2 Implement seo input validation (10,000 character limit, required fields)
- [x] 3.3 Implement keyword-density action with string matching for keyword frequency
- [x] 3.4 Implement meta-description action with 160 character limit and target keyword support
- [x] 3.5 Implement structured JSON output format (result, action, metadata)
- [x] 3.6 Register seo tool in src/tools/index.js

## 4. Implement translate tool

- [x] 4.1 Create src/tools/translate.js with zod input schema for all actions (translate, detect)
- [x] 4.2 Implement translate input validation (10,000 character limit, required fields)
- [x] 4.3 Implement translate action using google-translate-api with env var GOOGLE_TRANSLATE_API_KEY
- [x] 4.4 Implement detect action for language detection
- [x] 4.5 Implement caching using tiny-lru with (input, sourceLanguage, targetLanguage) key and 24h TTL
- [x] 4.6 Implement rate limiting (10 requests/second)
- [x] 4.7 Implement structured JSON output format (result, action, metadata)
- [x] 4.8 Register translate tool in src/tools/index.js

## 5. Write tests

- [x] 5.1 Create tests/unit/tools/text.test.js with tests for all text tool actions and edge cases
- [x] 5.2 Create tests/unit/tools/seo.test.js with tests for all seo tool actions and edge cases
- [x] 5.3 Create tests/unit/tools/translate.test.js with tests for translate, detect, caching, and rate limiting

## 6. Verify and commit

- [x] 6.1 Run npm run test to verify all tests pass
- [x] 6.2 Run npm run lint to verify lint passes
- [x] 6.3 Run npm run coverage to verify coverage is maintained
- [x] 6.4 Verify application starts with npm start (timeout 10s)