## 1. Remove shell from public registries (src/tools/index.js)

- [x] 1.1 Remove `shell` from import statement: `import { processTool } from "./shell.js"` (drop `shell` export)
- [x] 1.2 Remove `shell: ["filesystem:exec", "process:spawn"]` from `TOOL_PERMISSIONS`
- [x] 1.3 Remove `shell: ["debug", "code-review", "testing", "security-audit", "performance", "coding"]` from `TOOL_CLASSIFICATIONS`
- [x] 1.4 Remove `"shell"` from `ORCHESTRATOR_TOOLS` array
- [x] 1.5 Remove `shell` (value) from `TOOLS` object

## 2. Remove shell from deep agent classifications (src/agent/deepAgents.js)

- [x] 2.1 Remove `"shell"` from `debug` agent tool list in `getAgentClassifications`
- [x] 2.2 Remove `"shell"` from `testing` agent tool list
- [x] 2.3 Remove `"shell"` from `"security-audit"` agent tool list
- [x] 2.4 Remove `"shell"` from `performance` agent tool list

## 3. Make shell tool private in shell.js

- [x] 3.1 Remove the `shell` export from the LangChain tool declaration (change `export const shell = tool(...)` to `const shell = tool(...)`)
- [x] 3.2 Update JSDoc comment: change "Shell tool for executing shell commands" to "Internal shell tool (kept for executeCode shell language support)"
- [x] 3.3 Clean up JSDoc for `executeShellImpl`: remove mention of loadConfig/sandbox parameters that were removed
- [x] 3.4 Remove `config` loading and sandbox parameter from `executeShellImpl` and `executeBackground`/`executeForeground` calls (they now use hardcoded/internal paths)
- [x] 3.5 Update JSDoc for `executeBackground`: remove `allowedPaths` param reference

## 4. Update tests (tests/unit/shell.test.js)

- [x] 4.1 Remove import of `executeShellImpl` from shell.js
- [x] 4.2 Remove entire `describe("tools - shell", ...)` block with foreground execution tests (`echo command`, `ls command`, `command length enforcement`)
- [x] 4.3 Move the background mode test from `describe("background execution")` into the `describe("tools - process management")` suite as a standalone `it`
- [x] 4.4 Remove `{ allowedPaths, maxReadSize }` second arguments from all `manageProcessImpl` calls in process management tests

## 5. Update tool index tests (tests/unit/tool_index.test.js)

- [x] 5.1 Remove `"shell"` from expected tools array in `TOOL_PERMISSIONS` test
- [x] 5.2 Change test name and assertion: `shell` → `process`, adjust expected permission to `["process:spawn"]` (verify process only needs process:spawn, not filesystem:exec)
- [x] 5.3 All tools have permission arrays test: remove shell assertion
- [x] 5.4 `buildToolConfig` default mode test: remove shell comment and assertion that shell should not register without process:spawn
- [x] 5.5 `buildToolConfig` with all permissions: remove `assert.ok(toolNames.includes("shell"))`
- [x] 5.6 `buildToolConfig` with filesystem:read permission: update count comment (9 total) and remove shell from the tool list comment

## 6. Verify

- [x] 6.1 Run `npm run test` to confirm all 1038 tests pass
- [x] 6.2 Run `npm run lint` to confirm no lint errors
- [x] 6.3 Verify shell tool no longer appears in agent tool lists
- [x] 6.4 Verify process tool still works correctly
- [x] 6.5 Verify executeCode shell language still functions (shell.js exports remain)
