## 1. Implementation

- [x] 1.1 Add `configureWasmBackend()` function inside `createEmbedder()` in `src/vector/embedder.js` that sets `env.backends.onnx.wasm.wasmPaths`, `numThreads = 1`, and `proxy = false`
- [x] 1.2 Call `await configureWasmBackend()` at the top of `getLocalPipeline()` before `pipeline(...)` is invoked
- [x] 1.3 Add JSDoc comments to the new function with `@returns` annotation

## 2. Testing

- [x] 2.1 Add test to `tests/unit/vector/embedder.test.js` that verifies `configureWasmBackend()` sets the expected env properties
- [x] 2.2 Run `npm run test` and `npm run coverage` to confirm no regressions

## 3. Verification

- [x] 3.1 Run the smoke test snippet to confirm `WASM OK, dim = 384`
- [x] 3.2 Run `codeIndex` for a small project and confirm `N indexed, 0 errors`
