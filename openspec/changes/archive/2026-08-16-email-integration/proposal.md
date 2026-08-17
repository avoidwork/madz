## Why

Email is the central nervous system of professional workflows, yet Madz has zero capability to interact with email systems. Users cannot ask the agent to triage their inbox, draft replies, organize email threads, or manage calendar scheduling via email. This is a critical gap for any agent designed to assist with professional workflows.

## What Changes

- Add `email.read` tool — fetch messages from inbox, sent, drafts, or custom folders with filtering
- Add `email.send` tool — compose and send emails with text/HTML body, attachments, CC/BCC
- Add `email.draft` tools — save, list, update, and delete email drafts
- Add `email.organize` tool — label/archive messages, mark as read/unread, search
- Add multi-provider support: Gmail (Gmail API), Outlook/MS Graph (Microsoft Graph API), IMAP (fallback)
- Add provider configuration schemas for OAuth2 and IMAP credentials
- Register email tools in the tool map with appropriate permissions

## Capabilities

### New Capabilities
- `email-tools`: Core email tool interface with read, send, draft, and organize operations
- `email-providers`: Multi-provider abstraction layer (Gmail, MS Graph, IMAP)
- `email-auth`: Authentication and credential management for email providers

### Modified Capabilities
- `tools-tier2`: New tools registered in the tier2 tool map
- `tool-classification`: New email tool classifications added
- `config-system`: Email provider configuration schemas added

## Impact

- `src/tools/index.js` — New email tools registered with TOOL_PERMISSIONS and TOOL_CLASSIFICATIONS
- `src/config/loader.js` — Email provider config loading and validation
- `src/config/schemas/providers.js` — New email provider configuration schemas
- `src/tools/web.js` — Attachment validation patterns reused
- `src/agent/deepAgents.js` — Email tools available to agents via tool map
- New dependencies: `googleapis`, `@microsoft/microsoft-graph-client`, `nodemailer` or `imap-simple`
- New files: `src/tools/email.js`, `src/tools/email/providers/base.js`, `src/tools/email/providers/gmail.js`, `src/tools/email/providers/graph.js`, `src/tools/email/providers/imap.js`

## Non-goals

- Push/webhook-based email notification (pull-only for v1)
- Multi-account support (single provider per session)
- Calendar integration (cross-referenced issue #780, separate feature)
- Email encryption/signing (PGP/S/MIME)
- Mobile push notifications