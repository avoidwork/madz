## 1. HTTP client and auth layer

- [ ] 1.1 Create `src/tools/namecom/index.js` with the `makeRequest()` helper — handles Basic Auth, URL allowlist validation, timeout, and error normalization
- [ ] 1.2 Implement credential validation — check `NAMECOM_USERNAME` and `NAMECOM_TOKEN` env vars, return early with error if missing
- [ ] 1.3 Implement URL allowlist — only allow `api.name.com` and `api.dev.name.com`

## 2. Zod schema definition

- [ ] 2.1 Define the `NamecomToolSchema` with `action` as an enum of all 40+ action names
- [ ] 2.2 Add common optional fields: `domainName`, `perPage`, `page`, `sort`, `dir`, `type`, `name`, `value`, `ttl`, `id`
- [ ] 2.3 Add action-specific optional fields: `to`, `subject`, `body`, `startDate`, `endDate`, `title`, `start`, `end`, `eventId`, `domain`, `tld`, `verificationId`, `authCode`, `contact`, `nameserver`, `hostname`, `emailBox`, `host`, `url`, `orderId`, `productType`, `idempotencyKey`
- [ ] 2.4 Add `params` as an optional record for action-specific parameters not covered by named fields

## 3. Action handlers — Domains (19 ops)

- [ ] 3.1 Implement `listDomains` — GET /core/v1/domains with pagination and filter params
- [ ] 3.2 Implement `createDomain` — POST /core/v1/domains with registration details
- [ ] 3.3 Implement `getDomain` — GET /core/v1/domains/{domainName}
- [ ] 3.4 Implement `updateDomain` — PATCH /core/v1/domains/{domainName}
- [ ] 3.5 Implement `enableAutorenew` — POST /core/v1/domains/{domainName}:enableAutorenew
- [ ] 3.6 Implement `disableAutorenew` — POST /core/v1/domains/{domainName}:disableAutorenew
- [ ] 3.7 Implement `enableWhoisPrivacy` — POST /core/v1/domains/{domainName}:enableWhoisPrivacy
- [ ] 3.8 Implement `disableWhoisPrivacy` — POST /core/v1/domains/{domainName}:disableWhoisPrivacy
- [ ] 3.9 Implement `lockDomain` — POST /core/v1/domains/{domainName}:lock
- [ ] 3.10 Implement `unlockDomain` — POST /core/v1/domains/{domainName}:unlock
- [ ] 3.11 Implement `renewDomain` — POST /core/v1/domains/{domainName}:renew
- [ ] 3.12 Implement `setContacts` — POST /core/v1/domains/{domainName}:setContacts
- [ ] 3.13 Implement `setNameservers` — POST /core/v1/domains/{domainName}:setNameservers
- [ ] 3.14 Implement `getAuthCode` — GET /core/v1/domains/{domainName}:getAuthCode
- [ ] 3.15 Implement `getPricing` — GET /core/v1/domains/{domainName}:getPricing
- [ ] 3.16 Implement `checkAvailability` — POST /core/v1/domains:checkAvailability
- [ ] 3.17 Implement `searchDomains` — POST /core/v1/domains:search
- [ ] 3.18 Implement `zoneCheck` — POST /core/v1/zonecheck
- [ ] 3.19 Implement `purchasePrivacy` — POST /core/v1/domains/{domainName}:purchasePrivacy

## 4. Action handlers — DNS (5 ops)

- [ ] 4.1 Implement `listRecords` — GET /core/v1/domains/{domainName}/records
- [ ] 4.2 Implement `createRecord` — POST /core/v1/domains/{domainName}/records
- [ ] 4.3 Implement `getRecord` — GET /core/v1/domains/{domainName}/records/{id}
- [ ] 4.4 Implement `updateRecord` — PUT /core/v1/domains/{domainName}/records/{id}
- [ ] 4.5 Implement `deleteRecord` — DELETE /core/v1/domains/{domainName}/records/{id}

## 5. Action handlers — URL Forwardings (9 ops)

- [ ] 5.1 Implement `listUrlForwardings` — GET /core/v1/domains/{domainName}/url/forwarding
- [ ] 5.2 Implement `createUrlForwarding` — POST /core/v1/domains/{domainName}/url/forwarding
- [ ] 5.3 Implement `getUrlForwarding` — GET /core/v1/domains/{domainName}/url/forwarding/{host}
- [ ] 5.4 Implement `updateUrlForwarding` — PUT /core/v1/domains/{domainName}/url/forwarding/{host}
- [ ] 5.5 Implement `deleteUrlForwarding` — DELETE /core/v1/domains/{domainName}/url/forwarding/{host}
- [ ] 5.6 Implement `listUrlForwardingsByDomain` — GET /core/v1/urlforwarding/{domainName}
- [ ] 5.7 Implement `getUrlForwardingById` — GET /core/v1/urlforwarding/{domainName}/{id}
- [ ] 5.8 Implement `updateUrlForwardingById` — PATCH /core/v1/urlforwarding/{domainName}/{id}
- [ ] 5.9 Implement `deleteUrlForwardingById` — DELETE /core/v1/urlforwarding/{domainName}/{id}

## 6. Action handlers — Email Forwardings (5 ops)

- [ ] 6.1 Implement `listEmailForwardings` — GET /core/v1/domains/{domainName}/email/forwarding
- [ ] 6.2 Implement `createEmailForwarding` — POST /core/v1/domains/{domainName}/email/forwarding
- [ ] 6.3 Implement `getEmailForwarding` — GET /core/v1/domains/{domainName}/email/forwarding/{emailBox}
- [ ] 6.4 Implement `updateEmailForwarding` — PUT /core/v1/domains/{domainName}/email/forwarding/{emailBox}
- [ ] 6.5 Implement `deleteEmailForwarding` — DELETE /core/v1/domains/{domainName}/email/forwarding/{emailBox}

## 7. Action handlers — Vanity Nameservers (5 ops)

- [ ] 7.1 Implement `listVanityNameservers` — GET /core/v1/domains/{domainName}/vanity_nameservers
- [ ] 7.2 Implement `createVanityNameserver` — POST /core/v1/domains/{domainName}/vanity_nameservers
- [ ] 7.3 Implement `getVanityNameserver` — GET /core/v1/domains/{domainName}/vanity_nameservers/{hostname}
- [ ] 7.4 Implement `updateVanityNameserver` — PUT /core/v1/domains/{domainName}/vanity_nameservers/{hostname}
- [ ] 7.5 Implement `deleteVanityNameserver` — DELETE /core/v1/domains/{domainName}/vanity_nameservers/{hostname}

## 8. Action handlers — DNSSECs (4 ops)

- [ ] 8.1 Implement `listDnssecs` — GET /core/v1/domains/{domainName}/dnssec
- [ ] 8.2 Implement `createDnssec` — POST /core/v1/domains/{domainName}/dnssec
- [ ] 8.3 Implement `getDnssec` — GET /core/v1/domains/{domainName}/dnssec/{digest}
- [ ] 8.4 Implement `deleteDnssec` — DELETE /core/v1/domains/{domainName}/dnssec/{digest}

## 9. Action handlers — Transfers (7 ops)

- [ ] 9.1 Implement `listTransfers` — GET /core/v1/transfers
- [ ] 9.2 Implement `createTransfer` — POST /core/v1/transfers
- [ ] 9.3 Implement `getTransfer` — GET /core/v1/transfers/{domainName}
- [ ] 9.4 Implement `cancelTransfer` — POST /core/v1/transfers/{domainName}:cancel
- [ ] 9.5 Implement `cancelExternalTransferOut` — POST /core/v1/transfers/external/out/{domainName}:cancel
- [ ] 9.6 Implement `createInternalTransferIn` — POST /core/v1/transfers/internal/in
- [ ] 9.7 Implement `getTransferEligibility` — GET /core/v1/transfers/eligibility/{domainName}

## 10. Action handlers — Webhook Notifications (4 ops)

- [ ] 10.1 Implement `listNotifications` — GET /core/v1/notifications
- [ ] 10.2 Implement `subscribeNotification` — POST /core/v1/notifications
- [ ] 10.3 Implement `deleteNotification` — DELETE /core/v1/notifications/{id}
- [ ] 10.4 Implement `modifyNotification` — PUT /core/v1/notifications/{id}

## 11. Action handlers — Domain Info (3 ops)

- [ ] 11.1 Implement `getTldRequirements` — GET /core/v1/domaininfo/requirements/{tld}
- [ ] 11.2 Implement `checkDomainClaims` — POST /core/v1/domaininfo/claims/{domain}
- [ ] 11.3 Implement `getTldRequirementsV2` — GET /core/v1/domaininfo/requirementsV2/{tld}

## 12. Action handlers — Contact Verification (3 ops)

- [ ] 12.1 Implement `listUnverifiedContacts` — GET /core/v1/contacts/unverified
- [ ] 12.2 Implement `verifyContact` — POST /core/v1/contacts/verify/{verificationId}
- [ ] 12.3 Implement `resendContactVerification` — POST /core/v1/contacts/verify/{verificationId}:resend

## 13. Action handlers — Orders, Account, Refunds, Pricing (6 ops)

- [ ] 13.1 Implement `listOrders` — GET /core/v1/orders
- [ ] 13.2 Implement `getOrder` — GET /core/v1/orders/{orderId}
- [ ] 13.3 Implement `getAccountBalance` — GET /core/v1/accountinfo/balance
- [ ] 13.4 Implement `createAccount` — POST /core/v1/accounts
- [ ] 13.5 Implement `processRefund` — POST /core/v1/refund
- [ ] 13.6 Implement `getTldPricing` — GET /core/v1/tldpricing
- [ ] 13.7 Implement `getPremiumDomainsList` — GET /core/v1/premiumdomainslist
- [ ] 13.8 Implement `hello` — GET /core/v1/hello

## 14. Action router and tool wrapper

- [ ] 14.1 Implement the `namecomImpl()` function with switch statement routing all 40+ actions to their handlers
- [ ] 14.2 Implement the `tool()` wrapper with name, description, and schema — matching the email tool pattern
- [ ] 14.3 Export the tool for registration in `src/tools/index.js`

## 15. Tool registration

- [ ] 15.1 Add import for `namecom` tool in `src/tools/index.js`
- [ ] 15.2 Add `namecom: ["network:outbound"]` to `TOOL_PERMISSIONS`
- [ ] 15.3 Add `namecom` to `TOOL_CLASSIFICATIONS` with appropriate agent types
- [ ] 15.4 Add `namecom` to `TOOLS` object
- [ ] 15.5 Add `namecom` case to `buildToolConfig` switch statement

## 16. Tests

- [ ] 16.1 Create `tests/unit/tools/namecom.test.js`
- [ ] 16.2 Test schema validation — valid action, invalid action, missing required params
- [ ] 16.3 Test credential validation — missing username, missing token, both present
- [ ] 16.4 Test URL allowlist — valid host, invalid host
- [ ] 16.5 Test request construction — correct URL, method, headers, body for representative actions across all 17 tag groups
- [ ] 16.6 Test error handling — 401, 403, 429 (with X-RateLimit-Reset header), 500, 502, 503, 504, timeout
- [ ] 16.7 Test all 40+ action names are covered in the enum
- [ ] 16.8 Test each tag group has at least one representative action tested

## 17. Verification

- [ ] 17.1 Run `npm run test` — all tests pass
- [ ] 17.2 Run `npm run lint` — no lint errors
- [ ] 17.3 Run `npm run coverage` — coverage maintained
- [ ] 17.4 Verify `npm start` doesn't crash