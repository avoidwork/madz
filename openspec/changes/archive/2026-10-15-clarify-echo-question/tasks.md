## 1. Echo the question in the clarify tool

- [x] 1.1 Modify `clarifyImpl()` in `src/tools/clarify/index.js` to include the `question` field in the returned JSON object
- [x] 1.2 Include the `choices` field in the returned JSON object when a non-empty `choices` array is provided
- [x] 1.3 Update the `clarify` tool `description` to note the question is echoed back in the result

## 2. Add test coverage

- [x] 2.1 Add an assertion in `tests/unit/tools_clarify.test.js` that the parsed result includes the `question` field matching the input
- [x] 2.2 Add an assertion that the parsed result includes the `choices` field when choices are provided

## 3. Verify

- [x] 3.1 Run `npm run test` and confirm no regressions
- [x] 3.2 Run `npm run coverage` and confirm coverage is maintained
- [x] 3.3 Run `npm run lint` and confirm no lint errors
