## 1. Schema

- [x] 1.1 Add `mouseScrollLines: z.number().int().min(1).default(1)` to `TuiSchema` in `src/config/schemas/tui.js`.

## 2. Config

- [x] 2.1 Add `mouseScrollLines: 1` under the `tui:` section in `config.yaml`.

## 3. Implementation

- [x] 3.1 In `src/tui/app.js`, change the `useMouseScroll` onScroll callback to multiply the delta by the configured value: `conversationAreaRef.current?.scrollBy(delta * (config?.tui?.mouseScrollLines || 1))`.

## 4. Tests

- [x] 4.1 Add a unit test verifying `TuiSchema` defaults `mouseScrollLines` to `1` when omitted.
- [x] 4.2 Add a unit test verifying `TuiSchema` rejects non-positive/non-integer `mouseScrollLines` values.
- [x] 4.3 Add a unit test verifying the delta multiplication logic (that a wheel delta is scaled by the configured `mouseScrollLines`).

## 5. Verification

- [x] 5.1 Run `npm run test`, `npm run lint`, and `npm run coverage` to confirm everything passes.
