# Tasks

## 1. Poppy Documentation Page

- [ ] 1.1 Create `docs/POPPY.md` with an overview of the Poppy (Personal Agent Protocol) integration and a link to the protocol spec (https://personalagentprotocol.org/docs/1.0/spec). Verify the file exists and opens with the overview and spec link.
- [ ] 1.2 Document the `discover` action (fetch and validate a company's `poppy.json` at `https://{domain}/.well-known/poppy.json`) and the `identity` action (agent client metadata document and signing keys). Verify each section describes the action's purpose and required fields.
- [ ] 1.3 Document the `session` action (Poppy-Session JWTs and delegations) and the `oauth` action (Direct Sign-In, Device Sign-In, refresh token rotation, revocation, DPoP). Verify each section describes the action's purpose and required fields.
- [ ] 1.4 Document the `verify` action (verify incoming Poppy-Session JWTs, delegations, access tokens) and the `api` action (match a task to an OpenAPI/MCP API). Verify each section describes the action's purpose and required fields.
- [ ] 1.5 Document the `conversation` action (conversation management) and the `browser` action (join a company's browser session). Verify each section describes the action's purpose and required fields.
- [ ] 1.6 Document the `tasks` action (excluded tasks, published agent skills, feedback endpoint), the `extensions` action (parse extensions, build Poppy-Extensions header, handle extension_required), and the `security` action (secrets vault, content trust, audience validation, delegated keys, sign-in risks). Verify each section describes the action's purpose and required fields.
- [ ] 1.7 Add a protocol spec reference for each documented capability. Verify every capability section links to the protocol spec.

## 2. Configuration Examples

- [ ] 2.1 Add a configuration example for the `poppy.json` discovery document. Verify the example shows the JSON shape the code validates.
- [ ] 2.2 Add a configuration example for the agent's client metadata document (client_id, client_name, jwks_uri, redirect_uris, logo_uri, alg, key_id). Verify the example shows the JSON shape the code validates.

## 3. Usage Examples

- [ ] 3.1 Add a usage example showing how to discover a company via the `poppy` tool's `discover` action. Verify the example uses the correct action enum and required fields.
- [ ] 3.2 Add a usage example showing how to sign in via the `oauth` action (Direct Sign-In or Device Sign-In). Verify the example uses the correct action enum and required fields.
- [ ] 3.3 Add a usage example showing how to complete a task via the `api`/`tasks` actions. Verify the example uses the correct action enum and required fields.

## 4. README and Docs Map Updates

- [ ] 4.1 Add a Poppy overview section to `README.md` with a link to the protocol spec and the new `docs/POPPY.md` page. Verify the README contains the overview and links.
- [ ] 4.2 Add the Poppy page to the `docs/README.md` document map. Verify the new page appears in the document map table.
- [ ] 4.3 Verify the documentation renders correctly (no broken relative links) by checking that all cross-references in `docs/POPPY.md` and `README.md` point to existing files.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
