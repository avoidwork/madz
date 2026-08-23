# namecom-api Specification

## Purpose
TBD - created by archiving change add-namecom-api-tool. Update Purpose after archive.
## Requirements
### Requirement: Tool authentication
The system MUST authenticate all name.com API requests using Basic Auth with credentials from `NAMECOM_USERNAME` and `NAMECOM_TOKEN` environment variables. The system MUST reject requests when credentials are not configured.

#### Scenario: Authentication configured
- **WHEN** `NAMECOM_USERNAME` and `NAMECOM_TOKEN` are set in the environment
- **THEN** the tool includes `Authorization: Basic <base64(username:token)>` header on all API requests

#### Scenario: Authentication not configured
- **WHEN** `NAMECOM_USERNAME` or `NAMECOM_TOKEN` is not set
- **THEN** the tool returns `{ ok: false, error: "name.com credentials not configured" }` for all actions

### Requirement: URL allowlist validation
The system MUST restrict all outbound requests to `api.name.com` and `api.dev.name.com` only.

#### Scenario: Valid host
- **WHEN** the request target is `api.name.com` or `api.dev.name.com`
- **THEN** the request proceeds normally

#### Scenario: Invalid host
- **WHEN** the request target is not in the allowlist
- **THEN** the tool returns `{ ok: false, error: "Host not allowed" }`

### Requirement: Action dispatch
The system MUST route each `action` value to the correct API endpoint using a switch statement.

#### Scenario: Valid action
- **WHEN** the `action` field matches a known action (e.g., `listDomains`, `createRecord`)
- **THEN** the tool dispatches to the corresponding handler and makes the appropriate API request

#### Scenario: Unknown action
- **WHEN** the `action` field does not match any known action
- **THEN** the tool returns `{ ok: false, error: "Unknown action: ..." }`

### Requirement: Domain management actions
The system MUST support all 19 domain operations: listDomains, createDomain, getDomain, updateDomain, enableAutorenew, disableAutorenew, enableWhoisPrivacy, disableWhoisPrivacy, lockDomain, unlockDomain, renewDomain, setContacts, setNameservers, getAuthCode, getPricing, checkAvailability, searchDomains, zoneCheck, purchasePrivacy.

#### Scenario: List domains
- **WHEN** action is `listDomains` with optional `perPage` and `page` parameters
- **THEN** the tool calls `GET /core/v1/domains` and returns the domain list

#### Scenario: Create domain
- **WHEN** action is `createDomain` with domain registration parameters
- **THEN** the tool calls `POST /core/v1/domains` and returns the registration result

#### Scenario: Enable autorenew
- **WHEN** action is `enableAutorenew` with `domainName` parameter
- **THEN** the tool calls `POST /core/v1/domains/{domainName}:enableAutorenew` and returns success

### Requirement: DNS record management
The system MUST support all 5 DNS operations: listRecords, createRecord, getRecord, updateRecord, deleteRecord.

#### Scenario: List DNS records
- **WHEN** action is `listRecords` with `domainName` parameter
- **THEN** the tool calls `GET /core/v1/domains/{domainName}/records` and returns the record list

#### Scenario: Create DNS record
- **WHEN** action is `createRecord` with `domainName`, `type`, `name`, `value`, and `ttl` parameters
- **THEN** the tool calls `POST /core/v1/domains/{domainName}/records` and returns the created record

#### Scenario: Delete DNS record
- **WHEN** action is `deleteRecord` with `domainName` and `id` parameters
- **THEN** the tool calls `DELETE /core/v1/domains/{domainName}/records/{id}` and returns success

### Requirement: URL forwarding management
The system MUST support all 9 URL forwarding operations: listUrlForwardings, createUrlForwarding, getUrlForwarding, updateUrlForwarding, deleteUrlForwarding, listUrlForwardingsByDomain, getUrlForwardingById, updateUrlForwardingById, deleteUrlForwardingById.

#### Scenario: List URL forwardings
- **WHEN** action is `listUrlForwardings` with `domainName` parameter
- **THEN** the tool calls `GET /core/v1/domains/{domainName}/url/forwarding` and returns the forwarding list

### Requirement: Email forwarding management
The system MUST support all 5 email forwarding operations: listEmailForwardings, createEmailForwarding, getEmailForwarding, updateEmailForwarding, deleteEmailForwarding.

#### Scenario: Create email forwarding
- **WHEN** action is `createEmailForwarding` with `domainName` and forwarding parameters
- **THEN** the tool calls `POST /core/v1/domains/{domainName}/email/forwarding` and returns the created forwarding

### Requirement: Vanity nameserver management
The system MUST support all 5 vanity nameserver operations: listVanityNameservers, createVanityNameserver, getVanityNameserver, updateVanityNameserver, deleteVanityNameserver.

#### Scenario: List vanity nameservers
- **WHEN** action is `listVanityNameservers` with `domainName` parameter
- **THEN** the tool calls `GET /core/v1/domains/{domainName}/vanity_nameservers` and returns the list

### Requirement: DNSSEC management
The system MUST support all 4 DNSSEC operations: listDnssecs, createDnssec, getDnssec, deleteDnssec.

#### Scenario: List DNSSEC records
- **WHEN** action is `listDnssecs` with `domainName` parameter
- **THEN** the tool calls `GET /core/v1/domains/{domainName}/dnssec` and returns the DNSSEC list

### Requirement: Transfer management
The system MUST support all 7 transfer operations: listTransfers, createTransfer, getTransfer, cancelTransfer, cancelExternalTransferOut, createInternalTransferIn, getTransferEligibility.

#### Scenario: List transfers
- **WHEN** action is `listTransfers` with optional pagination parameters
- **THEN** the tool calls `GET /core/v1/transfers` and returns the transfer list

#### Scenario: Create transfer
- **WHEN** action is `createTransfer` with domain and auth code parameters
- **THEN** the tool calls `POST /core/v1/transfers` and returns the transfer result

### Requirement: Webhook notification management
The system MUST support all 4 webhook notification operations: listNotifications, subscribeNotification, getNotification, modifyNotification, deleteNotification.

#### Scenario: List notifications
- **WHEN** action is `listNotifications`
- **THEN** the tool calls `GET /core/v1/notifications` and returns the subscription list

### Requirement: Domain info operations
The system MUST support all 3 domain info operations: getTldRequirements, checkDomainClaims, getTldRequirementsV2.

#### Scenario: Check domain claims
- **WHEN** action is `checkDomainClaims` with `domain` parameter
- **THEN** the tool calls `POST /core/v1/domaininfo/claims/{domain}` and returns the claims result

### Requirement: Contact verification operations
The system MUST support all 3 contact verification operations: listUnverifiedContacts, verifyContact, resendContactVerification.

#### Scenario: List unverified contacts
- **WHEN** action is `listUnverifiedContacts`
- **THEN** the tool calls `GET /core/v1/contacts/unverified` and returns the unverified list

### Requirement: Orders operations
The system MUST support all 2 order operations: listOrders, getOrder.

#### Scenario: List orders
- **WHEN** action is `listOrders` with optional pagination parameters
- **THEN** the tool calls `GET /core/v1/orders` and returns the order list

### Requirement: Account info operations
The system MUST support the account balance operation: getAccountBalance.

#### Scenario: Get account balance
- **WHEN** action is `getAccountBalance`
- **THEN** the tool calls `GET /core/v1/accountinfo/balance` and returns the balance

### Requirement: Hello endpoint
The system MUST support the hello operation for health checking.

#### Scenario: Hello
- **WHEN** action is `hello`
- **THEN** the tool calls `GET /core/v1/hello` and returns the server time and version info

### Requirement: Refund operations
The system MUST support the refund operation: processRefund.

#### Scenario: Process refund
- **WHEN** action is `processRefund` with order item parameters
- **THEN** the tool calls `POST /core/v1/refund` and returns the refund result

### Requirement: TLD pricing operations
The system MUST support the TLD pricing operation: getTldPricing.

#### Scenario: Get TLD pricing
- **WHEN** action is `getTldPricing`
- **THEN** the tool calls `GET /core/v1/tldpricing` and returns the pricing list

### Requirement: Premium domains operations
The system MUST support the premium domains operation: getPremiumDomainsList.

#### Scenario: Get premium domains list
- **WHEN** action is `getPremiumDomainsList`
- **THEN** the tool calls `GET /core/v1/premiumdomainslist` and returns the premium list

### Requirement: Accounts operations
The system MUST support the account creation operation: createAccount.

#### Scenario: Create account
- **WHEN** action is `createAccount` with account parameters
- **THEN** the tool calls `POST /core/v1/accounts` and returns the created account details

### Requirement: Error handling
The system MUST handle API error responses consistently, returning `{ ok: false, error: string }` for all error cases.

#### Scenario: 401 Unauthorized
- **WHEN** the API returns 401
- **THEN** the tool returns `{ ok: false, error: "Authentication failed" }`

#### Scenario: 429 Rate Limit
- **WHEN** the API returns 429
- **THEN** the tool returns `{ ok: false, error: "Rate limit exceeded. Retry after <timestamp>" }`

#### Scenario: 503 Service Unavailable
- **WHEN** the API returns 503
- **THEN** the tool returns `{ ok: false, error: "Service unavailable. See https://status.name.com" }`

#### Scenario: Network error
- **WHEN** the HTTP request fails (timeout, connection refused)
- **THEN** the tool returns `{ ok: false, error: "Request failed: <message>" }`

### Requirement: Rate limit awareness
The system MUST parse the `X-RateLimit-Reset` header from 429 responses and include the retry timestamp in the error message.

#### Scenario: Rate limit with reset header
- **WHEN** the API returns 429 with `X-RateLimit-Reset` header
- **THEN** the error message includes the Unix timestamp for when the rate limit resets

### Requirement: Tool registration
The system MUST register the `namecom` tool in `src/tools/index.js` with `network:outbound` permission and appropriate agent classifications.

#### Scenario: Tool is registered
- **WHEN** the system starts
- **THEN** the `namecom` tool is available to agents with `network:outbound` permission

### Requirement: Zod schema validation
The system MUST validate all tool input against a Zod schema before dispatching to handlers.

#### Scenario: Missing required parameter
- **WHEN** a required parameter (e.g., `domainName` for domain actions) is missing
- **THEN** Zod validation rejects the input before the handler is called

### Requirement: HTTP client with timeout
The system MUST attach a timeout to all HTTP requests to prevent hanging.

#### Scenario: Request timeout
- **WHEN** an HTTP request exceeds the timeout (30 seconds)
- **THEN** the tool returns `{ ok: false, error: "Request timed out" }`

