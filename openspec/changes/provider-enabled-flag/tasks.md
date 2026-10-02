## 1. Schema Changes

- [ ] 1.1 Add `enabled: z.boolean().default(true)` to `OpenaiProviderConfigSchema` in `src/config/schemas/providers.js`
- [ ] 1.2 Add `enabled: z.boolean().default(true)` to `CopilotProviderConfigSchema` in `src/config/schemas/providers.js`

## 2. Active Provider Selection

- [ ] 2.1 Update `getActiveProviderConfig` in `src/provider/openai.js` to select the first provider with `enabled !== false`, falling back to `openai` when none are enabled
- [ ] 2.2 Update `createChatModel` in `src/provider/openai.js` to detect Copilot from the resolved provider's `type`
- [ ] 2.3 Update `src/agent/deepAgents.js` to derive the provider via `getActiveProviderConfig` instead of `Object.keys(config.providers)[0]`

## 3. TUI Alignment

- [ ] 3.1 Update the Copilot auth guard in `src/tui/app.js` to key off the resolved active provider's `type === "github-copilot"` instead of `activeProviderName`

## 4. Config

- [ ] 4.1 Add a `copilot` provider block to `config.yaml` mirroring the openai block's expected values (model, base_url, enterpriseUrl, temperature, maxTokens, reasoning, rateLimit), with `enabled` toggling it and no `credentials.apiKey`

## 5. Tests

- [ ] 5.1 Add tests for `getActiveProviderConfig` covering no providers, all disabled (fallback to openai), and multiple providers with one enabled
- [ ] 5.2 Add schema validation tests for the new `enabled` field on `OpenaiProviderConfigSchema` and `CopilotProviderConfigSchema`

## 6. Verification

- [ ] 6.1 Run `npm run test`, `npm run lint`, and `npm run coverage` to confirm everything passes
