# Spec Delta

## Purpose

Lets madz's browser join a company's Poppy browser session so the company sees one session across browsing, APIs, and conversations.

## ADDED Requirements

### Requirement: Browser session join is supported
The system SHALL support a `browser` action on the `poppy` tool that joins a company's browser session via its `browser_session_endpoint`.

#### Scenario: Successful browser session join
- **WHEN** the `browser` action is invoked with a valid `endpoint` and the company's browser-session page presents a one-time code
- **THEN** the system loads the endpoint in the agent's browser, reads the code, authorizes it, submits the form to set the session cookie, and returns a success result

### Requirement: One-time code is read from the agent's own browser
The system SHALL read the one-time code only from the agent's own browser page, never from another source.

#### Scenario: Code is taken from the agent's browser
- **WHEN** the `browser` action loads the `browser_session_endpoint`
- **THEN** the one-time code is extracted from the agent's own browser page

### Requirement: Code authorization is validated
The system SHALL authorize the one-time code via `POST {browser_session_endpoint}/authorize`, validating the code and the join response against Zod schemas.

#### Scenario: Code is authorized
- **WHEN** the one-time code is read from the browser
- **THEN** the system sends `POST {browser_session_endpoint}/authorize` with the session header and, if signed in, the access token

#### Scenario: Invalid code is rejected
- **WHEN** the code or join response fails Zod validation
- **THEN** the system returns an error result

### Requirement: Session cookie is set via form submission
The system SHALL submit the form in the browser, which sets the session cookie, and browse the website with the session cookie.

#### Scenario: Session cookie is set
- **WHEN** the code is authorized
- **THEN** the system submits the form in the browser to set the session cookie and browses the website with it

### Requirement: Browser sign-in scope is enforced
The system SHALL enforce the `poppy:browser-sign-in` scope when sending the access token.

#### Scenario: Missing scope is rejected
- **WHEN** the access token is sent without the `poppy:browser-sign-in` scope
- **THEN** the system returns an error result

### Requirement: Web disabled and unscoped settings are handled
The system SHALL handle the `web.disabled` and `web.unscoped` settings from the company's poppy.json.

#### Scenario: Web is disabled
- **WHEN** the company's `web.disabled` setting is true
- **THEN** the system returns an error result indicating web browsing is disabled

#### Scenario: Web is unscoped
- **WHEN** the company's `web.unscoped` setting is true
- **THEN** the system proceeds without requiring the `poppy:browser-sign-in` scope

### Requirement: Access token is never sent through the browser
The system SHALL never send the access token through the browser; the token is only sent in the authorize request headers.

#### Scenario: Token stays out of the browser
- **WHEN** the browser loads the endpoint and submits the form
- **THEN** the access token is not transmitted through the browser
