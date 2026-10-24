## 1. Schema Fix

- [x] 1.1 Add `checkpointsDir: z.string().default("memory/checkpoints/")` to `MemorySchema` in `src/config/schemas/memory.js`

## 2. Regression Test

- [x] 2.1 Create `tests/unit/config/schemas/memory.test.js` asserting `MemorySchema` preserves `checkpointsDir` and applies the default correctly

## 3. Verification

- [x] 3.1 Run `npm run test` and confirm no regressions
- [x] 3.2 Run `npm run lint` and confirm no lint errors
