# Spec Delta

## MODIFIED Requirements

### Requirement: Client metadata document is served at client_id URL
The system SHALL serve a client metadata document (CIMD) at the configured `client_id` URL. The document's `client_id` field SHALL equal the URL it was fetched from. The document SHALL expose `client_name`, `logo_uri`, `jwks_uri`, `redirect_uris`, and `token_endpoint_auth_method`. The CIMD field values SHALL be sourceable from the `poppy` config section and its `POPPY_*` environment variables as a fallback when not provided as tool input parameters. The system SHALL validate that `client_id` equals the fetch URL.

#### Scenario: Document client_id equals fetch URL
- **WHEN** the metadata document is generated for a configured `client_id` URL
- **THEN** the document's `client_id` field equals that URL

#### Scenario: Document exposes required fields
- **WHEN** the metadata document is generated
- **THEN** it includes `client_name`, `logo_uri`, `jwks_uri`, `redirect_uris`, and `token_endpoint_auth_method`

#### Scenario: token_endpoint_auth_method is private_key_jwt
- **WHEN** the metadata document is generated
- **THEN** `token_endpoint_auth_method` is `private_key_jwt`

#### Scenario: CIMD values sourced from config when input omitted
- **WHEN** the `build_metadata` operation is invoked without `clientId`, `clientName`, `jwksUri`, or `redirectUris` input parameters
- **THEN** the values are sourced from the `poppy` config section / `POPPY_*` environment variables

#### Scenario: CIMD values error when neither input nor config present
- **WHEN** the `build_metadata` operation is invoked without input parameters and no `poppy` config / `POPPY_*` env vars are present
- **THEN** the operation returns an error indicating the required fields are missing

#### Scenario: client_id mismatch with fetch URL is rejected
- **WHEN** the metadata document's `client_id` does not equal the URL it was fetched from
- **THEN** the system rejects the document
