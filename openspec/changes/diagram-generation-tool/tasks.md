# Tasks

## 1. Dependencies

- [ ] 1.1 Add `@viz-js/viz`, `mermaid`, `jsdom`, and `sharp` to package.json dependencies and verify `npm install` succeeds

## 2. Tool Implementation

- [ ] 2.1 Create `src/tools/diagram/index.js` with `diagramImpl` supporting mermaid/graphviz rendering to svg/png, using `validatePath()` for output path enforcement, and verify the module exports `diagram` as a LangChain tool
- [ ] 2.2 Add JSDoc comments to all public functions with `@param` and `@returns` and verify lint passes

## 3. Registry Wiring

- [ ] 3.1 Register `diagram` in `src/tools/index.js`: import, `TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, `TOOLS` map, and a `case "diagram"` in `buildToolConfig()`, and verify the tool registers when filesystem:write permission is enabled

## 4. Unit Tests

- [ ] 4.1 Add `tests/unit/tools/diagram.test.js` covering Zod schema validation for format and output, and verify `npm run test` passes for the new test

## 5. Integration Test

- [ ] 5.1 Add `tests/integration/tools/diagram.test.js` rendering known mermaid and graphviz diagrams to SVG/PNG, verifying output structure, and covering invalid-syntax and unsupported-format edge cases, and verify `npm run test` passes for the new test

## 6. Verification

- [ ] 6.1 Run `npm run lint` and verify it passes
- [ ] 6.2 Run `npm run coverage` and verify coverage is maintained

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
