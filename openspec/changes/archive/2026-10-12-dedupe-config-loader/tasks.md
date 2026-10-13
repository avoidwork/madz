## 1. Extract shared parseValue helper

- [x] 1.1 Create src/config/parse.js with the shared parseValue function (JSDoc @param/@returns)
- [x] 1.2 Update src/config/loader.js to import parseValue from ./parse.js and remove the private _parseValue function
- [x] 1.3 Update src/config/patch.js to import parseValue from ./parse.js and re-export it as a named export

## 2. Verify behavior preserved

- [x] 2.1 Run npm run test to confirm all tests pass
- [x] 2.2 Run npm run lint to confirm no lint errors
- [x] 2.3 Run npm run coverage to confirm coverage is maintained
- [x] 2.4 Run timeout 10 npm start to verify application starts without crashing
