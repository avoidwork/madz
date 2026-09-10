## 1. Store Layer — FTS5 Table & Methods

- [x] 1.1 Add FTS5 virtual table creation to `init()` in `src/vector/store.js`
- [x] 1.2 Add `insertFtsChunks()` method for batch FTS insert
- [x] 1.3 Add `searchFts()` method for FTS5 MATCH queries
- [x] 1.4 Add `hybridSearch()` method with RRF fusion
- [x] 1.5 Extend `removeFile()` to delete from FTS table in same transaction

## 2. Indexer — FTS Population

- [x] 2.1 Accept `fulltext` option in `reindex()` in `src/vector/indexer.js`
- [x] 2.2 Populate FTS table during chunk insert loop when `fulltext: true`

## 3. codeIndex Tool — Config Wiring

- [x] 3.1 Read `proj.fulltext` from config in `src/tools/codeIndex/index.js`
- [x] 3.2 Pass `fulltext` to `reindex()` call

## 4. codeSearch Tool — Mode Parameter

- [x] 4.1 Add `mode` parameter to Zod schema (`"vector" | "fulltext" | "hybrid"`)
- [x] 4.2 Branch search logic on mode in `codeSearchImpl()`
- [x] 4.3 Update result formatting for FTS rank and hybrid source annotation

## 5. Config — Fulltext Flags

- [x] 5.1 Add `fulltext: true` and `ftsTokenize` to `config.yaml` under `vector.projects.madz`

## 6. Tests

- [x] 6.1 Add unit tests for FTS5 table creation, insert, and search
- [x] 6.2 Add unit tests for `hybridSearch()` with RRF scoring
- [x] 6.3 Add unit tests for `codeSearchImpl()` with `mode: "fulltext"` and `mode: "hybrid"`
- [x] 6.4 Update existing tests for expanded store interface

## 7. Verification

- [x] 7.1 Run `npm run test` — all tests passing
- [x] 7.2 Run `npm run lint` — no lint errors
- [x] 7.3 Run `npm run coverage` — coverage maintained
