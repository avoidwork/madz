## Why

The agent has no capability to interact with calendar systems — it cannot read upcoming events, create new meetings, check attendee availability, update existing events, or generate meeting summaries. This is a fundamental gap for any agent designed to assist with professional workflows. Users cannot ask the agent to "find a 30-minute slot tomorrow" or "summarize my afternoon meetings."

## What Changes

- Add a new `calendar` tool module (`src/tools/calendar.js`) providing read, create, update, delete, checkAvailability, and generateSummary operations
- Implement provider adapters for Google Calendar API and Microsoft Graph API
- Register calendar tools in the agent's tool registry with `network:outbound` permission
- Add provider configuration schemas for calendar credentials in `config.yaml`
- Integrate timezone handling using existing date tool utilities

## Capabilities

### New Capabilities
- `calendar`: Calendar event management — read, create, update, delete events, check availability, generate meeting summaries across Google Calendar and Microsoft Graph providers

### Modified Capabilities
<!-- No existing spec-level requirement changes -->

## Impact

- **Affected code:** `src/tools/calendar.js` (new), `src/tools/index.js` (registration), `src/config/schemas/providers.js` (new schemas), `src/tools/date.js` (reuse timezone utilities)
- **Dependencies:** `googleapis` (Google Calendar), `@microsoft/microsoft-graph-client` (MS Graph)
- **Systems:** Agent tool registry, config loader, permission model
- **Non-goals:** Email integration (covered by #779), OAuth flow implementation (service account auth first), mobile/native calendar app support