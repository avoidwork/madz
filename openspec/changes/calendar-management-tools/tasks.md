## 1. Setup & Configuration

- [ ] 1.1 Add npm dependencies (googleapis, @microsoft/microsoft-graph-client) to package.json
- [ ] 1.2 Create calendar configuration schema in src/config/schemas/providers.js
- [ ] 1.3 Add calendar provider configuration to config.yaml loader with defaults

## 2. Calendar Provider Interface

- [ ] 2.1 Create CalendarProviderError domain-specific error class in src/calendar/errors.js
- [ ] 2.2 Define CalendarProvider interface with method signatures in src/calendar/types.js
- [ ] 2.3 Create provider factory in src/calendar/factory.js that selects provider by config

## 3. Google Calendar Provider

- [ ] 3.1 Implement GoogleCalendarProvider class in src/calendar/providers/googleCalendar.js
- [ ] 3.2 Implement OAuth2 token management and refresh logic
- [ ] 3.3 Implement listEvents method with date range, keyword, and pagination support
- [ ] 3.4 Implement createEvent method with attendee and timezone handling
- [ ] 3.5 Implement updateEvent method for title, time, and attendee updates
- [ ] 3.6 Implement deleteEvent method with cancellation notification

## 4. MS Graph Provider

- [ ] 4.1 Implement MSGraphProvider class in src/calendar/providers/msGraph.js
- [ ] 4.2 Implement token management for MS Graph (OAuth2 and API key support)
- [ ] 4.3 Implement listEvents method with equivalent filtering to Google provider
- [ ] 4.4 Implement createEvent method with MS Graph API conventions
- [ ] 4.5 Implement updateEvent method for MS Graph
- [ ] 4.6 Implement deleteEvent method for MS Graph

## 5. Calendar Tools

- [ ] 5.1 Create src/tools/calendar.js with all tool functions (listEvents, createEvent, updateEvent, deleteEvent, checkAvailability, generateSummary)
- [ ] 5.2 Define zod input schemas for each tool function
- [ ] 5.3 Implement timezone conversion utilities using Intl API
- [ ] 5.4 Implement availability checking logic with buffer time support
- [ ] 5.5 Implement conflict detection for overlapping events and attendee conflicts
- [ ] 5.6 Implement meeting summary generation from event metadata

## 6. Tool Registration & Integration

- [ ] 6.1 Register calendar tools in src/tools/index.js with TOOL_PERMISSIONS and TOOL_CLASSIFICATIONS
- [ ] 6.2 Add network:outbound permission tier for calendar tools
- [ ] 6.3 Wire calendar tools into DeepAgents orchestrator (src/agent/deepAgents.js)
- [ ] 6.4 Integrate calendar tool with email tool for invite/cancellation notifications

## 7. Testing

- [ ] 7.1 Create unit tests for CalendarProviderError in tests/unit/calendar/errors.test.js
- [ ] 7.2 Create unit tests for provider factory in tests/unit/calendar/factory.test.js
- [ ] 7.3 Create unit tests for GoogleCalendarProvider in tests/unit/calendar/providers/googleCalendar.test.js
- [ ] 7.4 Create unit tests for MSGraphProvider in tests/unit/calendar/providers/msGraph.test.js
- [ ] 7.5 Create unit tests for calendar tools in tests/unit/tools/calendar.test.js
- [ ] 7.6 Create unit tests for timezone utilities in tests/unit/calendar/timezone.test.js
- [ ] 7.7 Create unit tests for availability checking in tests/unit/calendar/availability.test.js

## 8. Verification & Polish

- [ ] 8.1 Run npm run test and fix any failures
- [ ] 8.2 Run npm run lint and fix any lint errors
- [ ] 8.3 Run npm run coverage and ensure coverage is maintained
- [ ] 8.4 Verify application starts with npm start (timeout 10s)
- [ ] 8.5 Run pre-commit hook (oxfmt, oxlint, tests, coverage)