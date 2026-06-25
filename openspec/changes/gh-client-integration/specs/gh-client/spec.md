## ADDED Requirements

### Requirement: Client instantiation with authentication
The system SHALL provide a `createGhClient(config)` factory function that accepts `{ owner, repo, token, baseUrl }` and returns a client instance. The factory MUST throw a clear error if `token` is missing.

#### Scenario: Successful instantiation
- **WHEN** `createGhClient({ owner: 'avoidwork', repo: 'madz', token: 'ghp_xxx' })` is called
- **THEN** a client instance is returned with methods available

#### Scenario: Missing token throws error
- **WHEN** `createGhClient({ owner: 'avoidwork', repo: 'madz', token: undefined })` is called
- **THEN** a `TypeError` is thrown with message indicating `GITHUB_TOKEN` is required

#### Scenario: Default base URL
- **WHEN** `createGhClient({ owner: 'avoidwork', repo: 'madz', token: 'ghp_xxx' })` is called without `baseUrl`
- **THEN** the client uses `https://api.github.com` as the base URL

### Requirement: Issue CRUD operations
The system SHALL provide methods for creating, viewing, editing, and listing issues.

#### Scenario: Create issue
- **WHEN** `client.createIssue({ title: 'Bug report', body: 'Something is broken', labels: ['bug'] })` is called
- **THEN** a POST request is sent to `/repos/{owner}/{repo}/issues` with the provided body
- **THEN** the response `{ data: <issue object>, error: null }` is returned on success

#### Scenario: View issue
- **WHEN** `client.viewIssue(42)` is called
- **THEN** a GET request is sent to `/repos/{owner}/{repo}/issues/42`
- **THEN** the response `{ data: <issue object>, error: null }` is returned on success

#### Scenario: Edit issue
- **WHEN** `client.editIssue(42, { state: 'closed' })` is called
- **THEN** a PATCH request is sent to `/repos/{owner}/{repo}/issues/42` with `{ state: 'closed' }`
- **THEN** the response `{ data: <updated issue object>, error: null }` is returned on success

#### Scenario: List issues
- **WHEN** `client.listIssues({ state: 'open', page: 1, perPage: 30 })` is called
- **THEN** a GET request is sent to `/repos/{owner}/{repo}/issues?state=open&page=1&per_page=30`
- **THEN** the response `{ data: [<issue objects>], error: null }` is returned on success

#### Scenario: Issue not found returns error
- **WHEN** `client.viewIssue(999999)` is called and the issue does not exist
- **THEN** the response `{ data: null, error: { status: 404, message: 'Not Found' } }` is returned

### Requirement: PR CRUD operations
The system SHALL provide methods for creating, viewing, editing, listing, and merging pull requests.

#### Scenario: Create PR
- **WHEN** `client.createPR({ title: 'Add feature', body: 'New feature', head: 'feature-branch', base: 'main' })` is called
- **THEN** a POST request is sent to `/repos/{owner}/{repo}/pulls` with the provided body
- **THEN** the response `{ data: <pr object>, error: null }` is returned on success

#### Scenario: View PR
- **WHEN** `client.viewPR(42)` is called
- **THEN** a GET request is sent to `/repos/{owner}/{repo}/pulls/42`
- **THEN** the response `{ data: <pr object>, error: null }` is returned on success

#### Scenario: Edit PR
- **WHEN** `client.editPR(42, { state: 'closed' })` is called
- **THEN** a PATCH request is sent to `/repos/{owner}/{repo}/pulls/42` with `{ state: 'closed' }`
- **THEN** the response `{ data: <updated pr object>, error: null }` is returned on success

#### Scenario: List PRs
- **WHEN** `client.listPRs({ state: 'open', page: 1, perPage: 30 })` is called
- **THEN** a GET request is sent to `/repos/{owner}/{repo}/pulls?state=open&page=1&per_page=30`
- **THEN** the response `{ data: [<pr objects>], error: null }` is returned on success

#### Scenario: Merge PR
- **WHEN** `client.mergePR(42, { commit_title: 'Merge', merge_method: 'merge' })` is called
- **THEN** a PUT request is sent to `/repos/{owner}/{repo}/pulls/42/merge` with the provided body
- **THEN** the response `{ data: <merge result>, error: null }` is returned on success

### Requirement: Comment operations
The system SHALL provide a method for creating comments on issues and PRs.

#### Scenario: Create comment
- **WHEN** `client.createComment(42, { body: 'LGTM' })` is called
- **THEN** a POST request is sent to `/repos/{owner}/{repo}/issues/42/comments` with `{ body: 'LGTM' }`
- **THEN** the response `{ data: <comment object>, error: null }` is returned on success

### Requirement: Authentication header
The system SHALL include the `Authorization: Bearer <token>` header on every API request.

#### Scenario: Auth header is set
- **WHEN** any client method makes an API request
- **THEN** the request includes `Authorization: Bearer ghp_xxx` header
- **THEN** the request includes `Accept: application/vnd.github+json` header

#### Scenario: 401 on invalid token
- **WHEN** `client.viewIssue(42)` is called with an invalid token
- **THEN** the response `{ data: null, error: { status: 401, message: 'Unauthorized' } }` is returned

### Requirement: Rate limiting handling
The system SHALL surface GitHub API rate limiting information in error responses.

#### Scenario: 429 rate limit response
- **WHEN** `client.listIssues()` is called and GitHub returns 429
- **THEN** the response `{ data: null, error: { status: 429, message: 'Rate Limited', retryAfter: <seconds> } }` is returned
- **THEN** the `retryAfter` value is parsed from the `Retry-After` response header if present

### Requirement: Timeout handling
The system SHALL use `fetchWithTimeout()` for all API requests with consistent timeout behavior.

#### Scenario: Request timeout
- **WHEN** `client.viewIssue(42)` is called and the API does not respond within the timeout
- **THEN** the response `{ data: null, error: { status: 0, message: 'Request timeout' } }` is returned

### Requirement: Module export pattern
The system SHALL export the client as a standard Node.js module.

#### Scenario: Module is importable
- **WHEN** another module executes `import { createGhClient } from './gh-client.js'`
- **THEN** the `createGhClient` function is available for use