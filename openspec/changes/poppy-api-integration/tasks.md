# Tasks

## 1. Scaffolding

- [ ] 1.1 Create `src/tools/poppy/api.js` exporting an `execute` function and verify the module imports without error
- [ ] 1.2 Register the `api` action in `ACTIONS` and add `"api"` to the action enum plus api fields in `poppySchema` in `src/tools/poppy/index.js`, and verify `npm run lint` passes

## 2. API Selection

- [ ] 2.1 Implement API selection from `poppy.json` (openapi/mcp) by task and verify unit tests cover selection and unknown-type errors

## 3. OpenAPI Calls

- [ ] 3.1 Implement OpenAPI endpoint calls with Poppy-Session, Poppy-Version, Poppy-Extensions, and access token headers and verify unit tests cover header injection and non-HTTPS rejection

## 4. MCP Calls

- [ ] 4.1 Implement remote MCP server calls over Streamable HTTP transport with session header and token request with `resource` set to the MCP server URL, and verify unit tests cover the call

## 5. Error Mapping and Scope Enforcement

- [ ] 5.1 Implement section 7 access token error mapping (invalid_token 401, insufficient_scope 403, invalid_session 400, session_ended 400, version_unsupported 400, extension_required 403) and verify unit tests cover each mapping
- [ ] 5.2 Implement scope enforcement on company-side endpoints returning `insufficient_scope` (403) and verify unit tests cover granted and denied scopes

## 6. Idempotency

- [ ] 6.1 Implement idempotency key support and verify unit tests cover key present and absent cases

## 7. Integration Tests

- [ ] 7.1 Add `tests/integration/tools/poppy/api.test.js` calling a mock OpenAPI and MCP server and verify the integration test passes

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
