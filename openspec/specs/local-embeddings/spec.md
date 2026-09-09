# local-embeddings Specification

## Purpose
Enable local embedding inference via transformers.js with ONNX Runtime WASM backend on Alpine Linux (musl libc), where the native `onnxruntime-node` binding is unavailable.

## Requirements
### Requirement: Local embedding pipeline with WASM backend on Alpine/musl
The system SHALL redirect the native ONNX Runtime binding to the WASM build and configure the WASM backend before initializing the local embedding pipeline, enabling local embeddings on Alpine Linux (musl libc).

#### Scenario: Native binding redirected to WASM before transformers import
- **WHEN** `getLocalPipeline()` is called in `src/vector/embedder.js`
- **THEN** the CJS require cache SHALL redirect `require("onnxruntime-node")` to `onnxruntime-web` BEFORE the `@xenova/transformers` module is imported

#### Scenario: WASM backend configured before pipeline initialization
- **WHEN** `getLocalPipeline()` is called in `src/vector/embedder.js`
- **THEN** the ONNX Runtime WASM backend SHALL be configured with `wasmPaths` (pointing to `onnxruntime-web/dist/` with trailing slash), `numThreads = 1`, and `proxy = false` before `pipeline()` is invoked

#### Scenario: WASM backend configuration succeeds
- **WHEN** the WASM backend is configured and `pipeline()` is called
- **THEN** the pipeline SHALL initialize successfully and return a valid pipeline function

#### Scenario: Existing OpenAI fallback is preserved
- **WHEN** the local pipeline fails to initialize
- **THEN** the system SHALL fall back to the OpenAI embeddings API if an API key is configured

#### Scenario: Incremental indexing works after fix
- **WHEN** `codeIndex` is run a second time on the same project
- **THEN** unchanged files SHALL be skipped (mtime cache) and no re-embedding SHALL occur

