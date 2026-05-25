## 1. Pass version to App component

- [x] 1.1 Read package.json version in `index.js` and pass `appInfo` prop to App
- [x] 1.2 Update App component to accept and forward `appInfo` prop to InputPanel

## 2. Add app name and version to InputPanel

- [x] 2.1 Add `flex: { grow: 1 }` to input Text so it fills available space between prompt and identity
- [x] 2.2 Append name Text with `color: "cyan"` after input, pinned to the right edge of terminal
- [x] 2.3 Append version Text with `color: "white"` after name
- [x] 2.4 Ensure identity label stays pinned right on both short and long input

## 3. Tests

- [x] 3.1 Test InputPanel renders app name in cyan
- [x] 3.2 Test InputPanel renders version in white
- [x] 3.3 Test InputPanel input Text has flex grow enabled
- [x] 3.4 Test InputPanel order: prompt, input, name (cyan), version (white) on right side
- [x] 3.5 Test InputPanel identity pinned right with short input (not 1 space offset)
- [x] 3.6 Test InputPanel with custom name from config
- [x] 3.7 Test InputPanel with empty input still shows identity on the right
