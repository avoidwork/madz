## 1. Echo the question in the clarify tool

- [ ] 1.1 Modify `clarifyImpl()` in `src/tools/clarify/index.js` to include the `question` field in the returned JSON object
- [ ] 1.2 Include the `choices` field in the returned JSON object when a non-empty `choices` array is provided
- [ ] 1.3 Update the `clarify` tool `description` to note the question is echoed back in the result

## 2. Add test coverage

- [ ] 2.1 Add an assertion in `tests/unit/tools_clarify.test.js` that the parsed result includes the `question` field matching the input
- [ ] 2.2 Add an assertion that the parsed result includes the `choices` field when choices are provided

## 3. Verify

- [ ] 3.1 Run `npm run test` and confirm no regressions
- [ ] 3.2 Run `npm run coverage` and confirm coverage is maintained
- [ ] 3.3 Run `npm run lint` and confirm no lint errors
