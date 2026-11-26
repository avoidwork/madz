# Spec Delta

## ADDED Requirements

### Requirement: TUI auth handler registration SHALL handle dynamic import rejection without an unhandled rejection

The 401 re-auth handler registration and cleanup in `src/tui/app.js` SHALL attach rejection handlers to the dynamic `import("../provider/copilotAuth.js")` promise chains so that a failed dynamic import does not surface as an unhandled promise rejection, while preserving the disposed/generation guards so the handler is not registered or cleared after disposal.

#### Scenario: Dynamic import rejects during handler registration

- **WHEN** the dynamic import of `copilotAuth.js` rejects during the 401 re-auth handler effect
- **THEN** the rejection is handled and no unhandled promise rejection is emitted

#### Scenario: Dynamic import rejects during effect cleanup

- **WHEN** the dynamic import of `copilotAuth.js` rejects during the effect cleanup
- **THEN** the rejection is handled and no unhandled promise rejection is emitted

#### Scenario: Handler is not registered after disposal

- **WHEN** the dynamic import resolves after the effect has been disposed
- **THEN** the auth-required handler is not registered
