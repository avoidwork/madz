## 1. Add ASCII stripping to zod schema

- [ ] 1.1 Add `.transform()` to `key` field in the zod schema to strip non-ASCII characters using `/[^\x00-\x7F]/g`
- [ ] 1.2 Add `.transform()` to `content` field in the zod schema to strip non-ASCII characters using `/[^\x00-\x7F]/g`
- [ ] 1.3 Apply the same transforms to the `createTodoTool` factory function schema
- [ ] 1.4 Verify the transforms are applied before `todoImpl` receives the input

## 2. Implement and verify stripping behavior

- [ ] 2.1 Test that accented characters in key are stripped (e.g., "café" → "cafe")
- [ ] 2.2 Test that emoji characters in key are stripped (e.g., "🐛" → "")
- [ ] 2.3 Test that CJK characters in key are stripped (e.g., "修复" → "")
- [ ] 2.4 Test that accented characters in content are stripped (e.g., "café" → "cafe")
- [ ] 2.5 Test that emoji characters in content are stripped (e.g., "🥑" → "")
- [ ] 2.6 Test that RTL characters in content are stripped (e.g., "مرحبا" → "")
- [ ] 2.7 Test that ASCII-only key and content pass through unchanged

## 3. Add tests

- [ ] 3.1 Add test: key with accented characters is stripped on create
- [ ] 3.2 Add test: key with emoji is stripped on create
- [ ] 3.3 Add test: key with CJK characters is stripped on create
- [ ] 3.4 Add test: content with accented characters is stripped on create
- [ ] 3.5 Add test: content with emoji is stripped on create
- [ ] 3.6 Add test: content with RTL characters is stripped on create
- [ ] 3.7 Add test: ASCII-only key and content pass through unchanged
- [ ] 3.8 Add test: update with non-ASCII content strips characters
- [ ] 3.9 Add test: ASCII-only key passes through unchanged on update

## 4. Final verification

- [ ] 4.1 Verify the todo tool file has no lint errors
- [ ] 4.2 Verify the test file has no lint errors
- [ ] 4.3 Run `npm test` for the full test suite and verify all pass
- [ ] 4.4 Verify no regressions in existing todo tests
