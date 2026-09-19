## 1. Remove Legacy Skill Dispatch Path

- [x] 1.1 Remove the `_executeSkill` handler from `src/tui/conversationArea.js` (lines 194-213)
- [x] 1.2 Remove the `subAction === "load"` dispatch branch from `handleCommand` in `src/tui/conversationArea.js` (lines 236-377)
- [x] 1.3 Remove the skill-execution fallback from `src/tui/commandParser.js` (lines 178-188)

## 2. Route /SKILL Through Deepagents Skill System

- [x] 2.1 Add a skill-invoke result to `commandParser.js` that returns `{ action: "skill", subAction: "invoke", name, args }` when the command matches `_skillList`
- [x] 2.2 In `conversationArea.js` `handleCommand`, synthesize the `Run the <skill> skill [args]` prompt and dispatch it through `handleChat()`
- [x] 2.3 Remove the now-unused `_executeSkill` reference from the parser context wiring in `conversationArea.js`

## 3. Update Tests

- [x] 3.1 Update `tests/unit/tui/commandParser.test.js` to remove the legacy skill-execution assertions (lines 299-317)
- [x] 3.2 Add coverage for the new `/SKILL` shorthand behavior (skill-invoke result)
- [x] 3.3 Update `tests/unit/tui.test.js` skill-execution assertions to reflect the new `invoke` behavior

## 4. Verify

- [x] 4.1 Run `npm run test`
- [x] 4.2 Run `npm run lint`
- [x] 4.3 Run `npm run coverage`
