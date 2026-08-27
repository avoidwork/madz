## Context

The Madz AI harness currently has no calendar integration. Users cannot ask the agent to read, create, update, or delete calendar events, check availability, or generate meeting summaries. This is a significant gap for professional workflow assistance. The agent already has date awareness (`src/tools/date.js`), web access (`src/tools/web.js`), and email integration (#779), making calendar a natural extension.

## Goals / Non-Goals

**Goals:**
- Unified calendar tool interface supporting Google Calendar and Outlook/MS Graph
- CRUD operations for calendar events (list, create, update, delete)
- Availability checking (free/busy lookup, available time slot detection)
- Meeting summary generation from event metadata
- Timezone-aware operations with proper UTC storage and user-timezone display
- Integration with email tool for calendar invites and notifications

**Non-Goals:**
- Mobile/desktop calendar app integrations (Apple Calendar, Thunderbird)
- Recurring event pattern generation (creation accepts explicit start/end only)
- Native OAuth UI flows (credentials provided via config/env)
- Calendar notifications or push updates (pull-based only)
- Shared calendar management (viewing/editing others' calendars without ownership)

## Decisions

### Decision 1: Provider Abstraction Pattern
**Choice:** Create a common `CalendarProvider` interface with separate Google and MS Graph implementations.
**Rationale:** Both providers have different APIs, auth models, and error formats. An abstraction layer lets us add providers later (Apple Calendar, CalDAV) without changing tool code. The existing provider pattern in `src/provider/` (LLM providers) serves as a template.
**Alternatives considered:**
- Single provider first (Google), add MS Graph later: Simpler initially but creates vendor lock-in and blocks enterprise users.
- Unified REST client: Too complex, each provider has unique features and quirks.

### Decision 2: OAuth2 for Google, Token-based for MS Graph
**Choice:** Google Calendar uses OAuth2 flow (user authorization), MS Graph uses API key/service principal tokens.
**Rationale:** Google Calendar's API requires OAuth2 for most operations (reading user calendars, creating events). MS Graph supports both OAuth2 and API keys for service accounts. The abstraction handles both auth models transparently.
**Alternatives considered:**
- OAuth2 for both: MS Graph supports it but API keys are simpler for service accounts.
- API key for both: Google doesn't support API keys for user calendar operations.

### Decision 3: Tool-per-Operation Granularity
**Choice:** Each calendar operation (listEvents, createEvent, updateEvent, deleteEvent, checkAvailability, generateSummary) is a separate tool function registered in `src/tools/index.js`.
**Rationale:** Follows the existing pattern in `src/tools/` (date.js, web.js, etc.). Each tool has its own zod input schema, JSDoc, and permission tier. This makes testing, documentation, and permission management cleaner.
**Alternatives considered:**
- Single calendar tool with action parameter: More complex input validation, harder to set granular permissions.

### Decision 4: UTC Internal Storage, User-Timezone Display
**Choice:** All calendar events stored and transmitted in UTC. User-facing operations convert to/from the configured timezone.
**Rationale:** UTC eliminates DST ambiguity and cross-timezone comparison issues. The existing date tool can handle conversions. Users configure their timezone once in `config.yaml`.
**Alternatives considered:**
- Store in user timezone: DST transitions cause bugs, cross-timezone comparisons fail.
- Store in both: Redundant, increases complexity.

### Decision 5: Integration with Email Tool (#779)
**Choice:** Calendar invites and cancellation notifications sent via the email tool's existing infrastructure.
**Rationale:** Avoids duplicating email sending logic. The email tool already handles MIME formatting, SMTP/SMTPS, and provider auth. Calendar operations trigger email tool calls when needed (create with invites, update with attendee changes, delete with cancellations).
**Alternatives considered:**
- Dedicated calendar email sender: Duplicates email infrastructure, harder to maintain.
- Provider-native invite sending: Google Calendar does this automatically; MS Graph requires separate API calls. Hybrid approach adds complexity.

### Decision 6: No Local Caching
**Choice:** Calendar data fetched from provider APIs on each call. No local cache layer.
**Rationale:** Calendar data is inherently real-time (events change, attendees update). Caching would require invalidation logic and could serve stale data. If performance becomes an issue, TTL-based caching (tiny-lru) can be added later.
**Alternatives considered:**
- TTL-based caching (5-minute window): Reduces API calls but risks stale data. Defer until needed.

## Architecture

```
src/tools/calendar.js (tool functions)
    │
    ├─ listEvents() ─────────┐
    ├─ createEvent() ────────┤
    ├─ updateEvent() ────────┤  → calendar/providers.js (CalendarProvider interface)
    ├─ deleteEvent() ────────┤
    ├─ checkAvailability() ──┤
    └─ generateSummary() ────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
              googleCalendar.js    msGraph.js
              (googleapis)        (@microsoft/
                                    microsoft-
                                    graph-client)
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| OAuth token expiry during long sessions | Implement token refresh logic in provider layer; fail gracefully with clear error message |
| Provider API rate limits | Implement exponential backoff in provider layer; log rate limit warnings via telemetry |
| Timezone edge cases (DST, mixed inputs) | Use Node.js Intl API for conversions; validate all timezone inputs against IANA database |
| Google vs MS Graph feature parity | MS Graph lacks some Google Calendar features (e.g., event attachments); document provider-specific limitations |
| Shared auth complexity (email + calendar) | Design auth abstraction as a separate module (`src/auth/providers.js`) that both email and calendar tools consume |
| Large event history queries | Paginate API results; limit default query to 30 days; allow user-specified date range |

## Migration Plan

No migration needed — this is a new feature. The tools are registered alongside existing tools and require no changes to existing functionality.

## Open Questions

1. Should the calendar tool support multiple calendars per provider (e.g., work + personal Google calendars)?
2. What is the default behavior for calendar invites — send immediately or wait for user confirmation?
3. Should meeting summaries use the LLM (via existing tool infrastructure) or simple template-based generation?