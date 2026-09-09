## Context

The local embedding pipeline in `src/vector/embedder.js` uses `@xenova/transformers` to run `Xenova/all-MiniLM-L6-v2` via ONNX Runtime. On Alpine Linux (musl libc), the native `onnxruntime-node` binding fails to load because it requires glibc (`ld-linux-aarch64.so.1`). The transformers.js WASM fallback also fails because it defaults to a threaded worker path that doesn't resolve in Node.js (`ERR_WORKER_PATH`).

The fix is a configuration-only change: explicitly set the ONNX Runtime WASM backend environment variables before pipeline initialization.

## Goals / Non-Goals

**Goals:**
- Enable local embeddings on Alpine/musl by configuring the ONNX Runtime WASM backend
- Keep the change minimal — single function addition in one file
- Preserve the existing OpenAI fallback path unchanged

**Non-Goals:**
- Making the local model configurable (separate enhancement)
- Adding `vector.dimensions` config (only needed if model is configurable)
- Performance optimization of the WASM backend

## Decisions

1. **Configure WASM backend before pipeline()** — The `env.backends.onnx.wasm` settings must be set before `pipeline()` is called because transformers.js initializes the ONNX Runtime backend during pipeline construction. Setting them after is a no-op.

2. **Use `import.meta.url` for path resolution** — Resolving `onnxruntime-web/dist` relative to the module file (`src/vector/embedder.js`) via `fileURLToPath` and `dirname` ensures the path works both in development (source tree) and in the Docker container (`/app/node_modules/...`).

3. **Single-threaded mode (`numThreads = 1`)** — The threaded WASM build spawns `ort-wasm-threaded.worker.js` via a worker, which throws `ERR_WORKER_PATH` in Node.js. Single-threaded mode sidesteps this entirely. Acceptable for incremental indexing workloads.

4. **No proxy (`proxy = false`)** — Cross-realm proxying is a browser feature; unnecessary in Node.js and can cause issues.

## Risks / Trade-offs

- **WASM slower than native** — Single-threaded WASM is slower than native `onnxruntime-node`. Acceptable for incremental indexing; initial full index (~8,500 chunks) may take minutes.
- **First-run network egress** — Model download from HuggingFace requires network access to `huggingface.co` (~25 MB). For air-gapped environments, pre-seed `~/.cache/transformers.js`.
- **`onnxruntime-web` version coupling** — The fix depends on `onnxruntime-web` being present (transitive dependency of `@xenova/transformers`). If the dependency structure changes, `wasmPaths` may need updating.
