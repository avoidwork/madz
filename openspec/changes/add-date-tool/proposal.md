## Problem

The assistant has no way to obtain the current date/time. Every time it needs to reference the current date (e.g., for logging, time-sensitive responses, or cron job validation), it must either refuse to answer or fabricate a date. This is a common need for a conversational AI assistant.

## Proposed Solution

Add a lightweight `date` tool that returns the current date and time as an ISO 8601 string. The tool takes no parameters — it simply returns `new Date().toISOString()` on invocation.

## Goals

- Provide a zero-config, permissionless tool that returns the current system date/time in ISO 8601 format.
- Follow the same pattern as existing tools: `createDateTool()` factory exports a LangChain `tool()` wrapper.
- Register the tool alongside `clarify` and `execute_code` (zero permissions required).

## Non-Goals

- Time zone configuration — always uses the system local time converted to UTC (ISO 8601).
- Human-readable formatting — ISO 8601 is the only format.
- Date arithmetic or parsing capabilities — out of scope for a "get current date" tool.

## Impact

- New file: `src/tools/date.js` (implements the date tool).
- Modified file: `src/tools/index.js` (registers the date tool in `TOOL_PERMISSIONS` and `TOOL_FACTORIES`).
- New test file: `tests/unit/tools/date.test.js`.
