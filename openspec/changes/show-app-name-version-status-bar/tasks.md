## 1. Pass version to App component

- [ ] 1.1 Read package.json version in `index.js` and pass `appInfo` prop to App
- [ ] 1.2 Update App component to accept and forward `appInfo` prop to InputPanel

## 2. Add app name and version to InputPanel

- [ ] 2.1 Render input text with grow to fill available space between prompt and right edge
- [ ] 2.2 Append name text in cyan color after the user input (right side)
- [ ] 2.3 Append version text in white color after the name (far right)
- [ ] 2.4 Format: `prompt + input + name + version` with single space separators

## 3. Tests

- [ ] 3.1 Test InputPanel renders app name in cyan
- [ ] 3.2 Test InputPanel renders version in white
- [ ] 3.3 Test InputPanel order: prompt, input, name (cyan), version (white) on right side
- [ ] 3.4 Test InputPanel with custom name from config
- [ ] 3.5 Test InputPanel with empty input still shows identity on the right
