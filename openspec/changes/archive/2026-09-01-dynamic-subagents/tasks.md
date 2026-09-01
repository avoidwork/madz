## 1. Install dependency
- [x] `npm install @langchain/quickjs`
- [x] Verify package.json updated

## 2. Update deepAgents.js
- [x] Add import for `CodeInterpreterMiddleware` from `@langchain/quickjs`
- [x] Add `middleware: [CodeInterpreterMiddleware]` to `createDeepAgent()` call

## 3. Test
- [x] Run `npm run test` — all tests pass
- [x] Run `npm run coverage` — coverage maintained

## 4. Commit and push
- [x] Commit on `feat/dynamic-subagents`
- [x] Push to origin
- [x] Open PR targeting `main`

## 5. Archive
- [x] Archive the change
