# copilot-token-exchange Specification

## Purpose
TBD - created by archiving change copilot-oauth-token-exchange. Update Purpose after archive.
## Requirements
### Requirement: Exchange OAuth token for short-lived bearer
The system SHALL exchange the OAuth device-flow token for a short-lived API bearer by calling `GET https://api.githubcopilot.com/copilot_internal/v2/token` with `Authorization: token <oauthToken>`.

#### Scenario: Successful exchange
- **WHEN** `exchangeCopilotToken()` is called with a valid OAuth token
- **THEN** it requests `https://api.githubcopilot.com/copilot_internal/v2/token` with `Authorization: token <oauthToken>` and returns the short-lived bearer plus `expires_at`

#### Scenario: Exchange failure
- **WHEN** the exchange endpoint returns a non-ok response
- **THEN** `exchangeCopilotToken()` throws an error

### Requirement: Cache exchanged bearer
The system SHALL cache the exchanged bearer (and its expiry) in memory, keyed by the OAuth token, and re-exchange on expiry.

#### Scenario: Cached bearer reused
- **WHEN** `exchangeCopilotToken()` is called twice with the same OAuth token before expiry
- **THEN** the second call returns the cached bearer without re-requesting the exchange endpoint

#### Scenario: Re-exchange on expiry
- **WHEN** the cached bearer has expired
- **THEN** the next call re-requests the exchange endpoint

### Requirement: Inject exchanged bearer on model requests
The system SHALL inject `Authorization: Bearer <short-lived-token>` on every Copilot model request via the custom fetch interceptor, after exchanging the OAuth token.

#### Scenario: Fetch interceptor sends exchanged bearer
- **WHEN** `createCopilotFetch()` is used to make a request with a stored OAuth token
- **THEN** the request includes `Authorization: Bearer <short-lived-token>` (the exchanged bearer), not the raw OAuth token

#### Scenario: Re-exchange on 401
- **WHEN** a request returns 401
- **THEN** the interceptor clears the cached bearer and re-exchanges, or invokes the re-auth handler if the exchange fails

### Requirement: Honor endpoints.api base URL
The system SHALL use the `endpoints.api` value from the exchange response as the base URL for API requests, falling back to `base()` when absent.

#### Scenario: Use endpoints.api
- **WHEN** the exchange response provides `endpoints.api`
- **THEN** the interceptor uses it as the base URL for API requests

#### Scenario: Fall back to base()
- **WHEN** the exchange response does not provide `endpoints.api`
- **THEN** the interceptor falls back to `base()`

