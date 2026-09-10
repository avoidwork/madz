## 1. Store Layer — FTS5 Table & Methods

- [ ] 1.1 Add FTS5 virtual table creation to `init()` in `src/vector/store.js`
- [ ] 1.2 Add `insertFtsChunks()` method for batch FTS insert
- [ ] 1.3 Add `searchFts()` method for FTS5 MATCH queries
- [ ] 1.4 Add `hybridSearch()` method with RRF fusion
- [ ] 1.5 Extend `removeFile()` to delete from FTS table in same transaction

## 2. Indexer — FTS Population

- [ ] 2.1 Accept `fulltext` option in `reindex()` in `src/vector/indexer.js`
- [ ] 2.2 Populate FTS table during chunk insert loop when `fulltext: true`

## 3. codeIndex Tool — Config Wiring

- [ ] 3.1 Read `proj.fulltext` from config in `src/tools/codeIndex/index.js`
- [ ] 3.2 Pass `fulltext` to `reindex()` call

## 4. codeSearch Tool — Mode Parameter

- [ ] 4.1 Add `mode` parameter to Zod schema (`"vector" | "fulltext" | "hybrid"`)
- [ ] 4.2 Branch search logic on mode in `codeSearchImpl()`
- [ ] 4.3 Update result formatting for FTS rank and hybrid source annotation

## 5. Config — Fulltext Flags

- [ ] 5.1 Add `fulltext: true` and `ftsTokenize` to `config.yaml` under `vector.projects.madz`

## 6. Tests

- [ ] 6.1 Add unit tests for FTS5 table creation, insert, and search
- [ ] 6.2 Add unit tests for `hybridSearch()` with RRF scoring
- [ ] 6.3 Add unit tests for `codeSearchImpl()` with `mode: "fulltext"` and `mode: "hybrid"`
- [ ] 6.4 Update existing tests for expanded store interface

## 7. Verification

- [ ] 7.1 Run `npm run test` — all tests passing
- [ ] 7.2 Run `npm run lint` — no lint errors
- [ ] 7.3 Run `npm run coverage` — coverage maintained
