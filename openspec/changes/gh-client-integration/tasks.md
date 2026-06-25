## 1. Client Core

- [ ] 1.1 Create `src/gh-client.js` with `createGhClient(config)` factory function
- [ ] 1.2 Implement token validation — throw if token is missing
- [ ] 1.3 Set default base URL to `https://api.github.com`
- [ ] 1.4 Implement `_request(method, path, body)` internal helper that builds fetch options with auth headers and timeout

## 2. Issue Methods

- [ ] 2.1 Implement `createIssue({ title, body, labels })` — POST /repos/{owner}/{repo}/issues
- [ ] 2.2 Implement `viewIssue(number)` — GET /repos/{owner}/{repo}/issues/{number}
- [ ] 2.3 Implement `editIssue(number, { title, body, labels, state })` — PATCH /repos/{owner}/{repo}/issues/{number}
- [ ] 2.4 Implement `listIssues({ state, labels, page, perPage })` — GET /repos/{owner}/{repo}/issues

## 3. PR Methods

- [ ] 3.1 Implement `createPR({ title, body, head, base })` — POST /repos/{owner}/{repo}/pulls
- [ ] 3.2 Implement `viewPR(number)` — GET /repos/{owner}/{repo}/pulls/{number}
- [ ] 3.3 Implement `editPR(number, { title, body, state, draft })` — PATCH /repos/{owner}/{repo}/pulls/{number}
- [ ] 3.4 Implement `listPRs({ state, page, perPage })` — GET /repos/{owner}/{repo}/pulls
- [ ] 3.5 Implement `mergePR(number, { commit_title, merge_method })` — PUT /repos/{owner}/{repo}/pulls/{number}/merge

## 4. Comment Methods

- [ ] 4.1 Implement `createComment(number, { body })` — POST /repos/{owner}/{repo}/issues/{number}/comments

## 5. Error Handling

- [ ] 5.1 Implement normalized `{ data, error }` return pattern for all methods
- [ ] 5.2 Handle 401/403 — return error with status and message
- [ ] 5.3 Handle 404 — return error with status and message
- [ ] 5.4 Handle 429 — parse `Retry-After` header and include in error object
- [ ] 5.5 Handle timeout — return error with status 0 and message

## 6. Tests

- [ ] 6.1 Create `tests/gh-client.test.js` with test infrastructure
- [ ] 6.2 Test successful CRUD operations (mock fetch with 200/201 responses)
- [ ] 6.3 Test missing token throws at instantiation
- [ ] 6.4 Test 401/403/404 error responses
- [ ] 6.5 Test 429 rate limiting with Retry-After header
- [ ] 6.6 Test timeout handling