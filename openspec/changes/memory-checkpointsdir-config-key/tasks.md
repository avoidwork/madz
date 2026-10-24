## 1. Schema Fix

- [ ] 1.1 Add `checkpointsDir: z.string().default("memory/checkpoints/")` to `MemorySchema` in `src/config/schemas/memory.js`

## 2. Regression Test

- [ ] 2.1 Create `tests/unit/config/schemas/memory.test.js` asserting `MemorySchema` preserves `checkpointsDir` and applies the default correctly

## 3. Verification

- [ ] 3.1 Run `npm run test` and confirm no regressions
- [ ] 3.2 Run `npm run lint` and confirm no lint errors
