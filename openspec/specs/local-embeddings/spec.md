# local-embeddings Specification

## Purpose
TBD - created by archiving change configure-wasm-backend-for-local-embeddings. Update Purpose after archive.
## Requirements
### Requirement: Local embedding pipeline with WASM backend on Alpine/musl
The system SHALL configure the ONNX Runtime WASM backend before initializing the local embedding pipeline, enabling local embeddings on Alpine Linux (musl libc) where the native `onnxruntime-node` binding is unavailable.

#### Scenario: WASM backend configured before pipeline initialization
- **WHEN** `getLocalPipeline()` is called in `src/vector/embedder.js`
- **THEN** the ONNX Runtime WASM backend SHALL be configured with `wasmPaths`, `numThreads = 1`, and `proxy = false` before `pipeline()` is invoked

#### Scenario: WASM backend configuration succeeds
- **WHEN** the WASM backend is configured and `pipeline()` is called
- **THEN** the pipeline SHALL initialize successfully and return a valid pipeline function

#### Scenario: Existing OpenAI fallback is preserved
- **WHEN** the local pipeline fails to initialize
- **THEN** the system SHALL fall back to the OpenAI embeddings API if an API key is configured

#### Scenario: Incremental indexing works after fix
- **WHEN** `codeIndex` is run a second time on the same project
- **THEN** unchanged files SHALL be skipped (mtime cache) and no re-embedding SHALL occur

