## 1. Setup

- [ ] 1.1 Add `googleapis` and `@microsoft/microsoft-graph-client` to package.json dependencies
- [ ] 1.2 Run `npm i` to install new dependencies
- [ ] 1.3 Create `src/tools/providers/` directory structure

## 2. Provider Interface & Factory

- [ ] 2.1 Define `CalendarProvider` interface in `src/tools/providers/interface.js` with methods: listEvents, createEvent, updateEvent, deleteEvent, checkAvailability, generateSummary
- [ ] 2.2 Create provider factory in `src/tools/providers/factory.js` that selects provider based on config.yaml setting
- [ ] 2.3 Implement default provider selection (Google Calendar) when no provider is configured

## 3. Google Calendar Provider

- [ ] 3.1 Create `src/tools/providers/googleCalendar.js` implementing the CalendarProvider interface
- [ ] 3.2 Implement Google Calendar API v3 authentication using service account credentials
- [ ] 3.3 Implement listEvents — fetch events with date range filtering, calendar ID support
- [ ] 3.4 Implement createEvent — create events with title, time, attendees, location, description
- [ ] 3.5 Implement updateEvent — partial updates to existing events
- [ ] 3.6 Implement deleteEvent — remove events by ID
- [ ] 3.7 Implement checkAvailability — find free time slots using freeBusy API
- [ ] 3.8 Implement generateSummary — format events into readable summary text
- [ ] 3.9 Add exponential backoff retry logic for rate-limited responses

## 4. Microsoft Graph Provider

- [ ] 4.1 Create `src/tools/providers/msGraph.js` implementing the CalendarProvider interface
- [ ] 4.2 Implement MS Graph API authentication using service account credentials
- [ ] 4.3 Implement listEvents — fetch events with date range filtering
- [ ] 4.4 Implement createEvent — create events via Microsoft Graph API
- [ ] 4.5 Implement updateEvent — partial updates to existing events
- [ ] 4.6 Implement deleteEvent — remove events by ID
- [ ] 4.7 Implement checkAvailability — find free time slots using findMeetingTimes endpoint
- [ ] 4.8 Implement generateSummary — format events into readable summary text
- [ ] 4.9 Add exponential backoff retry logic for rate-limited responses

## 5. Calendar Tool Module

- [ ] 5.1 Create `src/tools/calendar.js` with tool functions that wrap provider calls
- [ ] 5.2 Define zod input schemas for each operation (listEvents, createEvent, updateEvent, deleteEvent, checkAvailability, generateSummary)
- [ ] 5.3 Add OpenTelemetry instrumentation to each tool function (spans with sanitized input)
- [ ] 5.4 Add error handling — translate provider errors to domain-specific error classes
- [ ] 5.5 Implement timezone conversion — accept ISO 8601 with offsets, store in UTC, convert to user timezone for display

## 6. Tool Registration

- [ ] 6.1 Register calendar tools in `src/tools/index.js` with `network:outbound` permission
- [ ] 6.2 Add `TOOL_CLASSIFICATIONS` with `category: 'scheduling'`, `priority: 'high'`
- [ ] 6.3 Group calendar tools under `calendar` namespace in agent's tool list
- [ ] 6.4 Verify tools are discoverable by the agent

## 7. Configuration

- [ ] 7.1 Add `providers.calendar` section to config.yaml schema
- [ ] 7.2 Define config schema in `src/config/schemas/providers.js` for calendar provider settings
- [ ] 7.3 Support `provider` field (google | msgraph) with default to google
- [ ] 7.4 Support `credentials` field for service account configuration
- [ ] 7.5 Support `timezone` field for user's preferred display timezone
- [ ] 7.6 Ensure credentials are never logged or exposed in error messages

## 8. Tests

- [ ] 8.1 Create `tests/unit/tools/providers/googleCalendar.test.js` — test all provider methods
- [ ] 8.2 Create `tests/unit/tools/providers/msGraph.test.js` — test all provider methods
- [ ] 8.3 Create `tests/unit/tools/providers/factory.test.js` — test provider selection
- [ ] 8.4 Create `tests/unit/tools/calendar.test.js` — test tool functions, zod validation, timezone handling
- [ ] 8.5 Mock external API calls — no real API calls in tests
- [ ] 8.6 Test error handling — invalid input, provider errors, rate limiting
- [ ] 8.7 Test OpenTelemetry instrumentation — spans created correctly

## 9. Integration & Verification

- [ ] 9.1 Run `npm run test` — all tests pass
- [ ] 9.2 Run `npm run lint` — no lint errors
- [ ] 9.3 Run `npm run coverage` — coverage maintained
- [ ] 9.4 Verify application starts with `timeout 10 npm start`
- [ ] 9.5 Verify calendar tools appear in agent's tool list