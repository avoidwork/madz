## 1. Setup — Dependencies and Module Structure

- [ ] 1.1 Add npm dependencies: googleapis, @microsoft/microsoft-graph-client, nodemailer
- [ ] 1.2 Create src/tools/email/ directory structure with providers/ subdirectory
- [ ] 1.3 Create src/tools/email/index.js — main entry point and tool factory
- [ ] 1.4 Create src/tools/email/providers/base.js — EmailProvider abstract interface

## 2. Email Provider Abstraction Layer

- [ ] 2.1 Implement EmailProvider interface with send, read, search, draft, organize methods
- [ ] 2.2 Implement GmailProvider class using googleapis library
- [ ] 2.3 Implement GraphProvider class using @microsoft/microsoft-graph-client library
- [ ] 2.4 Implement ImapProvider class using nodemailer IMAP transport
- [ ] 2.5 Implement provider factory function that selects provider from config
- [ ] 2.6 Implement message format normalization across all providers

## 3. Authentication and Credential Management

- [ ] 3.1 Create Zod schemas for Gmail, Graph, and IMAP provider configs in src/config/schemas/providers.js
- [ ] 3.2 Implement credential storage using existing memory writer/reader system
- [ ] 3.3 Implement credential encryption at rest using existing encryption utilities
- [ ] 3.4 Implement OAuth2 token refresh logic for Gmail and Graph providers
- [ ] 3.5 Implement credential validation on application startup
- [ ] 3.6 Ensure credentials are never logged or exposed in error messages

## 4. Email Tools Implementation

- [ ] 4.1 Implement email.read tool with folder, sender, date, subject, keyword filters
- [ ] 4.2 Implement email.send tool with text/HTML body, attachments, CC/BCC support
- [ ] 4.3 Implement email.draft.save tool
- [ ] 4.4 Implement email.draft.list tool
- [ ] 4.5 Implement email.draft.update tool
- [ ] 4.6 Implement email.draft.delete tool
- [ ] 4.7 Implement email.organize tool with markRead, markUnread, archive, addLabel, removeLabel, search actions

## 5. Tool Registration and Integration

- [ ] 5.1 Register email tools in src/tools/index.js with TOOL_PERMISSIONS (network:outbound)
- [ ] 5.2 Add email tool classifications in TOOL_CLASSIFICATIONS map
- [ ] 5.3 Wire email tools into deepAgents.js tool map
- [ ] 5.4 Add email provider config loading to src/config/loader.js

## 6. Testing

- [ ] 6.1 Create tests/unit/tools/email/providers/base.test.js — provider interface tests
- [ ] 6.2 Create tests/unit/tools/email/providers/gmail.test.js — Gmail provider tests (mocked)
- [ ] 6.3 Create tests/unit/tools/email/providers/graph.test.js — Graph provider tests (mocked)
- [ ] 6.4 Create tests/unit/tools/email/providers/imap.test.js — IMAP provider tests (mocked)
- [ ] 6.5 Create tests/unit/tools/email/index.test.js — tool factory and registration tests
- [ ] 6.6 Create tests/unit/tools/email/email-tools.test.js — email tool integration tests (mocked)
- [ ] 6.7 Create tests/unit/config/providers.test.js — provider config schema validation tests

## 7. Verification and Polish

- [ ] 7.1 Run npm run lint and fix any issues
- [ ] 7.2 Run npm run test and ensure all tests pass
- [ ] 7.3 Run npm run coverage and verify coverage is acceptable
- [ ] 7.4 Run timeout 10 npm start to verify application starts without crashing
- [ ] 7.5 Verify email tools are listed in the TUI skills panel
- [ ] 7.6 Verify graceful degradation when no provider is configured