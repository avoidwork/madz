# Tasks

## 1. Poppy Reference Document

- [ ] 1.1 Create `docs/POPPY.md` with an overview of the Poppy (Personal Agent Protocol) integration, the `poppy` tool, and a link to the protocol spec at https://personalagentprotocol.org/docs/1.0/spec. Verify the file exists and contains the overview and spec link.
- [ ] 1.2 Document the `discover` action (fetch and validate a company's `poppy.json` at `/.well-known/poppy.json`), including the `domain` field and validation rules. Verify the section describes the action and its fields.
- [ ] 1.3 Document the `identity` action (client metadata document, JWKS, redirect URIs, RFC 7523 client assertions, ES256/PS384). Verify the section describes the action and its fields.
- [ ] 1.4 Document the `session` action (Poppy-Session JWT generation, delegated keys, delegations, Poppy headers). Verify the section describes the action and its fields.
- [ ] 1.5 Document the `oauth` action (Direct Sign-In with PKCE, Device Sign-In, refresh rotation, revocation, DPoP). Verify the section describes the action and its fields.
- [ ] 1.6 Document the `verify` action (verify incoming Poppy-Session JWTs, delegations, and access tokens). Verify the section describes the action and its fields.
- [ ] 1.7 Document the `api` action (OpenAPI and MCP API calls with Poppy headers, scope enforcement, error mapping). Verify the section describes the action and its fields.
- [ ] 1.8 Document the `conversation` action (start, send, read, stream messages, handoff, direct conversations). Verify the section describes the action and its fields.
- [ ] 1.9 Document the `browser` action (join a company's browser session, one-time code, session cookie). Verify the section describes the action and its fields.
- [ ] 1.10 Document the `tasks` action (fetch excluded tasks, skill index, feedback endpoint). Verify the section describes the action and its fields.
- [ ] 1.11 Document the `extensions` action (parse extensions, Poppy-Extensions header, extension_required handling, core extensions). Verify the section describes the action and its fields.
- [ ] 1.12 Document the `security` action (secrets vault, content trust, audience validation, delegated keys, blind signing, sign-in risks). Verify the section describes the action and its fields.

## 2. Configuration Examples

- [ ] 2.1 Add a `poppy.json` configuration example with `protocol_version`, `organization`, and `agent`/`apis`/`web` sections, with field explanations. Verify the example is present and fields are explained.
- [ ] 2.2 Add a client metadata document (CIMD) example with `client_id`, `client_name`, `logo_uri`, `jwks_uri`, `redirect_uris`, and `token_endpoint_auth_method`, with field explanations. Verify the example is present and fields are explained.

## 3. Usage Examples

- [ ] 3.1 Add a usage example showing how to discover a company (`action: "discover"` with a `domain`). Verify the example shows the invocation and expected result.
- [ ] 3.2 Add a usage example showing how to sign in via OAuth Direct Sign-In (`action: "oauth"`). Verify the example shows the invocation and expected result.
- [ ] 3.3 Add a usage example showing how to complete a task (call an API / start a conversation). Verify the example shows the invocation and expected result.

## 4. README Updates

- [ ] 4.1 Add a Poppy overview section to `README.md` with links to the protocol spec and `docs/POPPY.md`. Verify the section and links are present.
- [ ] 4.2 Update `docs/README.md` document map to include `docs/POPPY.md`. Verify the entry is present.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
