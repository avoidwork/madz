## 1. Auto-schedule module

- [x] 1.1 Create `src/scheduler/autoSchedule.js` with `setupAutoSchedule()` function
- [x] 1.2 Implement first-write detection using `hasProfile()` check
- [x] 1.3 Implement cron job JSON writing to `memory/schedules/reflection-daily.json`
- [x] 1.4 Embed `process.cwd()` into the command string
- [x] 1.5 Add idempotency guard (skip if `reflection-daily.json` already exists)
- [x] 1.6 Add error handling with graceful degradation

## 2. Onboarding integration

- [x] 2.1 Add `onSave` callback parameter to `Onboarding` constructor
- [x] 2.2 Invoke `onSave` callback after `saveProfile()` succeeds in `Onboarding.save()`
- [x] 2.3 Pass the auto-schedule callback from `index.js` to `Onboarding`

## 3. Startup wiring

- [x] 3.1 Import `setupAutoSchedule` in `index.js`
- [x] 3.2 Call `setupAutoSchedule()` when onboarding is active
- [x] 3.3 Wire the returned callback into the `Onboarding` instance

## 4. Tests

- [x] 4.1 Test `setupAutoSchedule()` returns a callback function
- [x] 4.2 Test callback creates job file on first profile write
- [x] 4.3 Test callback skips if profile already exists
- [x] 4.4 Test callback skips if job file already exists
- [x] 4.5 Test callback handles `hasProfile()` error gracefully
- [x] 4.6 Test job JSON has correct name, cron, command, and enabled fields
- [x] 4.7 Test command embeds correct `process.cwd()` value

## 5. Verification

- [x] 5.1 Run full test suite and confirm all tests pass (1044/1044 pass)
- [x] 5.2 Verify existing onboarding tests still pass
- [x] 5.3 Verify existing cron-scheduler tests still pass
