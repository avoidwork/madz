## 1. Create the model context length resolver

- [ ] 1.1 Create `src/provider/modelInfo.js` exporting `getModelContextLength(providerConfig)`
- [ ] 1.2 Implement the `/v1/models` probe: `GET {base_url}/v1/models`, find the entry whose `id` matches the configured model, return `max_model_len` if present
- [ ] 1.3 Implement the `/api/show` probe: `POST {base_url}/api/show` with `{ model }`, return `model_info.<family>.context_length` if present, else parse `num_ctx` from the `parameters` string
- [ ] 1.4 Make the resolver defensive: on any failure (unreachable, model not found, field absent, non-200), move on to the next candidate or return `undefined`; never throw

## 2. Wire the trigger derivation into the orchestrator

- [ ] 2.1 Import `getModelContextLength` in `src/agent/deepAgents.js`
- [ ] 2.2 In `createDeepAgentsOrchestrator`, after the model is created and before `createSummarizationMiddlewareFromConfig` is called, resolve the context length and compute `triggerTokens = Math.floor(contextLength * 0.8)`
- [ ] 2.3 Pass the resolved `{ type: "tokens", value: triggerTokens }` trigger to the middleware, overriding the configured token value; fall back to the configured value when context length is `undefined`

## 3. Write tests

- [ ] 3.1 Create `tests/unit/provider/modelInfo.test.js` testing the vLLM `/v1/models` path (with and without `max_model_len`)
- [ ] 3.2 Create `tests/unit/provider/modelInfo.test.js` testing the Ollama `/api/show` path (with `context_length`, with `num_ctx` in `parameters`, and with neither)
- [ ] 3.3 Create `tests/unit/provider/modelInfo.test.js` testing the fallback path (provider unreachable, model not found, non-200)
- [ ] 3.4 Add an integration test in `tests/unit/deepAgents.test.js` asserting the middleware receives `{ type: "tokens", value: <computed int> }` when context length resolves, and the configured value when it does not

## 4. Verify the change

- [ ] 4.1 `npm run lint` passes — no errors
- [ ] 4.2 `npm run test` — all tests pass
- [ ] 4.3 `npm run coverage` — generated `coverage.txt`
