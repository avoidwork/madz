## 1. Setup — Create subagent infrastructure

- [x] 1.1 Create prompts/TEXT_EDITOR.md — system prompt for text processing (summarize, rewrite, tone, grammar, shorten, expand)
- [x] 1.2 Create prompts/SEO_ANALYST.md — system prompt for SEO analysis (keyword-density, meta-description, serp-analysis, optimize)
- [x] 1.3 Create prompts/TRANSLATOR.md — system prompt for translation and language detection

## 2. Create agent definitions

- [x] 2.1 Create src/agent/definitions/text-editor.js — textEditor agent definition
- [x] 2.2 Create src/agent/definitions/seo-analyst.js — seoAnalyst agent definition
- [x] 2.3 Create src/agent/definitions/translator.js — translator agent definition
- [x] 2.4 Register all 3 agents in src/agent/definitions/index.js

## 3. Remove old tools

- [x] 3.1 Remove src/tools/text.js
- [x] 3.2 Remove src/tools/seo.js
- [x] 3.3 Remove src/tools/translate.js
- [x] 3.4 Remove tool registrations from src/tools/index.js (imports, TOOL_PERMISSIONS, TOOL_CLASSIFICATIONS, TOOLS map, buildToolConfig switch)
- [x] 3.5 Remove tests/unit/tools/text.test.js
- [x] 3.6 Remove tests/unit/tools/seo.test.js
- [x] 3.7 Remove tests/unit/tools/translate.test.js

## 4. Verify

- [ ] 4.1 Run npm run test to verify all tests pass
- [ ] 4.2 Run npm run lint to verify lint passes
- [ ] 4.3 Run npm run coverage to verify coverage is maintained
- [ ] 4.4 Verify application starts with npm start (timeout 10s)