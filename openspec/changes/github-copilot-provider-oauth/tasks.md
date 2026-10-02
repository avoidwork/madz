## 1. Config Schema

- [x] 1.1 Add `CopilotProviderConfigSchema` to `src/config/schemas/providers.js` with `type: "github-copilot"`, `base_url` defaulting to `https://api.githubcopilot.com`, required `model`, optional `enterpriseUrl`, and no `credentials.apiKey` requirement
- [x] 1.2 Export `CopilotProviderConfigSchema` from `src/config/schemas/index.js`

## 2. Auth Module

- [x] 2.1 Create `src/provider/copilotAuth.js` with `normalizeDomain`, `base`, `getUrls`, `getToken`, `persist`, `authorize`, and `createCopilotFetch`
- [x] 2.2 Implement the device-code request to `https://{domain}/login/device/code` with `client_id` and `scope: "read:user"`
- [x] 2.3 Implement the polling loop handling `authorization_pending`, `slow_down` (with server interval), and `access_token`
- [x] 2.4 Implement token persistence to `memory/auth.json` with mode `0o600`

## 3. Model Wiring

- [x] 3.1 In `src/provider/openai.js` `createChatModel`, detect `config.type === "github-copilot"` and pass `configuration.fetch: createCopilotFetch()` while omitting `apiKey`

## 4. CLI Commands

- [x] 4.1 Add `madz auth login` command in `index.js` that runs the device flow, prints the verification URL and code, polls, and persists the token
- [x] 4.2 Add `madz auth status` command that reads `memory/auth.json` and reports token presence
- [x] 4.3 Add `madz auth logout` command that deletes the token file

## 5. Tests

- [x] 5.1 Create `tests/unit/provider/copilotAuth.test.js` mocking `fetch` to cover the device request body, polling transitions, `slow_down` with server interval, `access_token` success, and `0o600` persistence
- [x] 5.2 Verify `npm run test`, `npm run lint`, and `npm run coverage` pass
