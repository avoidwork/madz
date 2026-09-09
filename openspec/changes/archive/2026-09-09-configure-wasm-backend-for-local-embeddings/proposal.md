## Why

Local embeddings with `vector.model: local` are non-functional on Alpine Linux (musl libc) because the native `onnxruntime-node` binding requires glibc. The `@xenova/transformers` WASM fallback also fails with `ERR_WORKER_PATH` in Node.js. This blocks `codeIndex` and `codeSearch` for users running the madz Docker container (Alpine-based). The fix explicitly configures the ONNX Runtime WASM backend before pipeline initialization.

## What Changes

- Add a `configureWasmBackend()` function inside `createEmbedder()` in `src/vector/embedder.js` that sets `env.backends.onnx.wasm.wasmPaths`, `numThreads = 1`, and `proxy = false`
- Call `await configureWasmBackend()` at the top of `getLocalPipeline()` before `pipeline(...)` is invoked
- No new dependencies — `onnxruntime-web` is already a transitive dependency of `@xenova/transformers`

## Capabilities

### New Capabilities
- `local-embeddings`: Local embedding pipeline using transformers.js with ONNX Runtime WASM backend on Alpine/musl

### Modified Capabilities
*(None — no existing spec-level behavior changes)*

## Impact

- **File changed**: `src/vector/embedder.js` — single function addition (~15 lines)
- **Dependencies**: None new — `onnxruntime-web` already present as transitive dependency
- **Performance**: WASM single-threaded is slower than native, but acceptable for incremental indexing
- **First run**: Requires network egress to huggingface.co to download the quantized model (~25 MB)
