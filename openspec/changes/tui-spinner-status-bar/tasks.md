## 1. Create Spinner Module

- [ ] 1.1 Create `src/tui/spinner.js` with `getSpinnerFrame(frame)` pure function
- [ ] 1.2 Create `src/tui/spinner.js` with `Spinner` component (`useState` +
  `useEffect` + `setInterval`, mirrors `Blink` pattern, exposes `_testFrame`
  prop for testing)

## 2. Integrate Spinner into StatusBar

- [ ] 2.1 Add `import { Spinner } from './spinner.js'` to `src/tui/statusBar.js`
- [ ] 2.2 Replace static indicator character in JSX with
  `<Spinner active={isStreamingStatus(statusMessage)} />`
- [ ] 2.3 Add `isStreamingStatus(status)` helper (returns true when status
  starts with "Sending" or "Streaming")
- [ ] 2.4 Keep existing status text display and color logic unchanged

## 3. Add Tests

- [ ] 3.1 Add tests for `getSpinnerFrame` — frames 0-9 return correct characters,
  frame 10 wraps to frame 0
- [ ] 3.2 Add tests for `Spinner` component — inactive renders space, active with
  `_testFrame` renders expected character, unmount clears interval

## 4. Verification

- [ ] 4.1 Run `npm run test` — all tests pass
- [ ] 4.2 Run `npm run coverage` — 100% coverage on `spinner.js` + modified `statusBar.js`
- [ ] 4.3 Run `npm run lint` — no lint errors
