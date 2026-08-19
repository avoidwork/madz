## Why

The agent has no capability to interact with calendar systems — it cannot read upcoming events, create new meetings, check attendee availability, update existing events, or generate meeting summaries. This is a fundamental gap for any agent designed to assist with professional workflows. Users cannot ask the agent to "find a 30-minute slot tomorrow" or "summarize my afternoon meetings."

## What Changes

- Add a new `calendar` tool (`src/tools/calendar.js`) with functions for reading, creating, updating, and deleting calendar events, checking availability, and generating meeting summaries
- Create a provider abstraction layer (`src/tools/calendar/providers.js`) with implementations for Google Calendar (`googleapis`) and Outlook/MS Graph (`@microsoft/microsoft-graph-client`)
- Add configuration schemas for calendar providers in `src/config/schemas/providers.js`
- Register calendar tools in `src/tools/index.js` with `network:outbound` permission and `scheduling`/`productivity` classifications
- Add unit tests in `tests/unit/tools/calendar.test.js`
- Add dependencies: `googleapis`, `@microsoft/microsoft-graph-client`
- Integrate with email tool (#779) for sending calendar invites and cancellation notifications

### Non-goals

- Mobile or desktop calendar app integrations (Apple Calendar, Thunderbird)
- Recurring event pattern generation (creation accepts explicit start/end only)
- Native OAuth UI flows (credentials are provided via config/env; OAuth setup is external)
- Calendar notifications or push updates (pull-based only)

## Capabilities

### New Capabilities
- `calendar-api`: Unified calendar provider interface with Google Calendar and MS Graph implementations
- `calendar-events`: CRUD operations for calendar events (list, create, update, delete)
- `calendar-availability`: Free/busy lookup and available time slot detection
- `calendar-summarization`: Meeting summary generation from event metadata and descriptions

### Modified Capabilities
N/A

## Impact

- **src/tools/index.js** — New tool registration with TOOL_PERMISSIONS and TOOL_CLASSIFICATIONS
- **src/tools/date.js** — Calendar tools extend date awareness with event-level operations
- **src/config/loader.js / src/config/schemas/providers.js** — Calendar provider configuration schemas (Google Calendar, MS Graph)
- **src/tools/web.js** — Calendar tools follow same `network:outbound` permission model
- **src/agent/deepAgents.js** — Calendar tools registered alongside existing tools
- **src/scheduler/cron.js / src/scheduler/scheduler.js** — Calendar tools could leverage scheduler for recurring event detection
- **Dependencies** — `googleapis` and `@microsoft/microsoft-graph-client` npm packages required
- **Integration** — Cross-references #779 (email integration) for calendar invites; shared auth abstraction recommended