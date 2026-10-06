## 1. Middleware Implementation

- [ ] 1.1 Track dispatched `readImage` `tool_call_id`s in a closure-level Set so the image is injected only on the turn immediately following the call
- [ ] 1.2 Record the triggering prompt (the HumanMessage preceding the AIMessage that made the `readImage` call) and pair the image with it, not the most recent user prompt
- [ ] 1.3 Strip the base64 payload from the `readImage` ToolMessage content by replacing it with a stub `ToolMessage` (content "Image read successfully.") in the request message list, without mutating persisted state

## 2. Tests

- [ ] 2.1 Add a regression test asserting the image is injected only once and not re-attached to a later unrelated prompt
- [ ] 2.2 Add a regression test asserting the image is paired with the triggering prompt, not the most recent one
- [ ] 2.3 Add a regression test asserting the base64 payload is stripped from the ToolMessage content

## 3. Verification

- [ ] 3.1 Run `npm run test` and confirm no regressions
- [ ] 3.2 Run `npm run lint` and confirm no lint errors
