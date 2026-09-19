## 1. Remove Legacy Skill Dispatch Path

- [ ] 1.1 Remove the `_executeSkill` handler from `src/tui/conversationArea.js` (lines 194-213)
- [ ] 1.2 Remove the `subAction === "load"` dispatch branch from `handleCommand` in `src/tui/conversationArea.js` (lines 236-377)
- [ ] 1.3 Remove the skill-execution fallback from `src/tui/commandParser.js` (lines 178-188)

## 2. Route /SKILL Through Deepagents Skill System

- [ ] 2.1 Add a skill-invoke result to `commandParser.js` that returns `{ action: "skill", subAction: "invoke", name, args }` when the command matches `_skillList`
- [ ] 2.2 In `conversationArea.js` `handleCommand`, synthesize the `Run the <skill> skill [args]` prompt and dispatch it through `handleChat()`
- [ ] 2.3 Remove the now-unused `_executeSkill` reference from the parser context wiring in `conversationArea.js`

## 3. Fix Status Bar

- [ ] 3.1 Render the `statusMessage` prop in `src/tui/statusBar.js` as a text element in the left group

## 4. Update Tests

- [ ] 4.1 Update `tests/unit/tui/commandParser.test.js` to remove the legacy skill-execution assertions (lines 299-317)
- [ ] 4.2 Add coverage for the new `/SKILL` shorthand behavior (skill-invoke result)

## 5. Verify

- [ ] 5.1 Run `npm run test`
- [ ] 5.2 Run `npm run lint`
- [ ] 5.3 Run `npm run coverage`
