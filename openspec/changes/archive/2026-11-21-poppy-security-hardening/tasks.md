# Tasks

## 1. Security module scaffolding

- [x] 1.1 Create `src/tools/poppy/security.js` with the `Vault` class (set/get/delete/rotate/has) and verify the unit test for vault operations passes
- [x] 1.2 Implement the `redact`/`sanitize` helper and verify it strips known secret values from a payload in the unit test

## 2. Content trust and audience validation

- [x] 2.1 Implement `markAsData`/`isData`/`sanitizeContent` content-trust helpers and verify the unit test for content-as-data passes
- [x] 2.2 Implement `validateAudience` and verify the unit test for audience validation passes

## 3. Delegated-key management

- [x] 3.1 Implement the `DelegatedKeyRegistry` (one key per user, rotation) and verify the unit test for key isolation and rotation passes
- [x] 3.2 Implement optional blind signing (RFC 9474) for client assertions and delegations and verify the unit test for blind signing passes

## 4. Sign-in risk handling

- [x] 4.1 Implement `enforcePromptConsent` and `detectConsentPhishing` and verify the unit test for sign-in risk handling passes

## 5. Wire the security action into the poppy tool

- [x] 5.1 Register the `security` action in `src/tools/poppy/index.js` ACTIONS registry and `poppySchema` enum, and verify the poppy tool accepts `action: "security"` in the unit test
- [x] 5.2 Add the `security` action's input fields to `poppySchema` with `superRefine` field restrictions and verify the schema rejects invalid field/action combinations

## 6. Tests

- [x] 6.1 Add `tests/unit/tools/poppy/security.test.js` covering secrets-out-of-context, content-as-data, audience validation, delegated-key isolation, rotation, and blind signing, and verify `npm run test` passes
- [x] 6.2 Add `tests/integration/tools/poppy/security.test.js` verifying a full flow keeps secrets out of the model, and verify `npm run test` passes

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
