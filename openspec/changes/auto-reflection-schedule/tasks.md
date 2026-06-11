## 1. Auto-schedule module

- [ ] 1.1 Create `src/scheduler/autoSchedule.js` with `setupAutoSchedule()` function
- [ ] 1.2 Implement first-write detection using `hasProfile()` check
- [ ] 1.3 Implement cron job JSON writing to `memory/schedules/reflection-daily.json`
- [ ] 1.4 Embed `process.cwd()` into the command string
- [ ] 1.5 Add idempotency guard (skip if `reflection-daily.json` already exists)
- [ ] 1.6 Add error handling with graceful degradation

## 2. Onboarding integration

- [ ] 2.1 Add `onSave` callback parameter to `Onboarding` constructor
- [ ] 2.2 Invoke `onSave` callback after `saveProfile()` succeeds in `Onboarding.save()`
- [ ] 2.3 Pass the auto-schedule callback from `index.js` to `Onboarding`

## 3. Startup wiring

- [ ] 3.1 Import `setupAutoSchedule` in `index.js`
- [ ] 3.2 Call `setupAutoSchedule()` when onboarding is active
- [ ] 3.3 Wire the returned callback into the `Onboarding` instance

## 4. Tests

- [ ] 4.1 Test `setupAutoSchedule()` returns a callback function
- [ ] 4.2 Test callback creates job file on first profile write
- [ ] 4.3 Test callback skips if profile already exists
- [ ] 4.4 Test callback skips if job file already exists
- [ ] 4.5 Test callback handles `hasProfile()` error gracefully
- [ ] 4.6 Test job JSON has correct name, cron, command, and enabled fields
- [ ] 4.7 Test command embeds correct `process.cwd()` value

## 5. Verification

- [ ] 5.1 Run full test suite and confirm all tests pass
- [ ] 5.2 Verify existing onboarding tests still pass
- [ ] 5.3 Verify existing cron-scheduler tests still pass
