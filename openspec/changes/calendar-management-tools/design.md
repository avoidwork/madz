## Context

The Madz AI harness currently has no calendar integration. Users cannot ask the agent to read, create, or manage calendar events. The existing tool architecture (`src/tools/`) provides a pattern for registering tools with permission tiers, zod schemas, and OpenTelemetry instrumentation. The date tool (`src/tools/date.js`) provides timezone awareness utilities that can be reused.

The project uses Node.js 24+ with ESM, LangGraph for agent state machines, and DeepAgents for sub-agent orchestration. Tools are registered in `src/tools/index.js` with `TOOL_PERMISSIONS` and `TOOL_CLASSIFICATIONS`. Configuration is managed via `config.yaml` loaded by `src/config/loader.js`.

## Goals / Non-Goals

**Goals:**
- Implement calendar tool module with read, create, update, delete, checkAvailability, and generateSummary operations
- Support Google Calendar API and Microsoft Graph API as provider backends
- Register tools in the agent's tool registry with proper permissions
- Add provider configuration schemas for calendar credentials
- Handle timezone conversions correctly

**Non-Goals:**
- Email integration for sending calendar invites (covered by #779)
- OAuth flow implementation (service account / API key auth first)
- Mobile or native calendar app support
- Recurring event pattern editing (basic recurring event support only)

## Decisions

**Decision 1: Provider Factory Pattern**
- Use a factory pattern (`src/tools/providers/factory.js`) to select the active calendar provider based on `config.yaml` settings
- Rationale: Allows easy addition of new providers (e.g., Apple Calendar, iCloud) without modifying tool code
- Alternative: Dependency injection via config — rejected as over-engineered for two providers

**Decision 2: Service Account Auth First**
- Start with API key / service account authentication; add OAuth in a follow-up
- Rationale: Simplifies initial implementation; OAuth adds significant complexity (redirect URLs, token refresh, state management)
- The existing auth middleware patterns in the codebase can be extended for OAuth later

**Decision 3: Shared Provider Interface**
- Both Google Calendar and MS Graph implement a common `CalendarProvider` interface
- Rationale: Enables swapping providers without changing tool code; simplifies testing via mocking
- Interface methods: `listEvents`, `createEvent`, `updateEvent`, `deleteEvent`, `checkAvailability`, `generateSummary`

**Decision 4: Timezone Handling**
- Accept and return times in ISO 8601 format with timezone offsets
- Store events internally in UTC; convert to user's configured timezone for display
- Reuse timezone utilities from `src/tools/date.js`
- Rationale: ISO 8601 is the standard; UTC internally avoids DST edge cases

**Decision 5: Tool Registration**
- Register calendar tools with `network:outbound` permission (same as `src/tools/web.js`)
- Classify under `category: 'scheduling'`, `priority: 'high'`
- Group under a `calendar` namespace in the agent's tool list
- Rationale: Follows existing patterns; ensures consistent permission model

## Risks / Trade-offs

[Risk] OAuth complexity deferred — users requiring OAuth will need to wait for follow-up
→ Mitigation: Service account auth covers most use cases; document OAuth as a known limitation

[Risk] Rate limiting on calendar APIs (Google: 10 req/s per user; MS Graph: limited by tenant)
→ Mitigation: Implement exponential backoff in provider adapters; add retry logic

[Risk] Timezone edge cases (DST transitions, cross-date events, mixed timezone attendees)
→ Mitigation: Use ISO 8601 with explicit offsets; leverage `date-fns-tz` or Node.js Intl API

[Risk] Two new npm dependencies (`googleapis`, `@microsoft/microsoft-graph-client`) increase attack surface
→ Mitigation: Pin versions; validate against OWASP; include in Docker multi-arch build

## Migration Plan

1. Add dependencies to `package.json` (`googleapis`, `@microsoft/microsoft-graph-client`)
2. Create provider interface and factory
3. Implement Google Calendar provider
4. Implement MS Graph provider
5. Create calendar tool module
6. Register tools in `src/tools/index.js`
7. Add config schemas
8. Write tests for all components
9. Update documentation

## Open Questions

- Should calendar events be stored in conversation memory for context-aware responses? (Recommended: yes, but low priority)
- Should the scheduler (`src/scheduler/`) be extended to detect recurring calendar events? (Recommended: yes, but can be a follow-up)
- What is the default timezone for users who don't specify one? (Recommended: use system timezone from `Intl.DateTimeFormat().resolvedOptions().timeZone`)