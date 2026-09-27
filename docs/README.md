# madz Documentation

The documentation for the madz AI harness. This directory is organized for readers from novice to advanced — no prior knowledge is assumed, but each document tells you what it assumes.

## Where to Start

| If you want to... | Read this |
|---|---|
| **Get madz running** (Docker, config, first conversation) | [TUTORIAL.md](./TUTORIAL.md) |
| **Understand the architecture** (how subsystems fit together) | [OVERVIEW.md](./OVERVIEW.md) |
| **Trace how the code actually runs** (call chains, data flows) | [FLOWS.md](./FLOWS.md) |
| **Understand the terminal interface** | [TUI.md](./TUI.md) and [TUI_FLOWS.md](./TUI_FLOWS.md) |
| **Understand streaming and segment coalescing** | [STREAMING.md](./STREAMING.md) |
| **Understand semantic code search** | [VECTOR_SEARCH.md](./VECTOR_SEARCH.md) |
| **Write code that follows the conventions** | [CODE_STYLE.md](./CODE_STYLE.md) |
| **Understand the security posture** | [THREAT_MODEL.md](./THREAT_MODEL.md) |
| **Look up a term** | [GLOSSARY.md](./GLOSSARY.md) |

## Document Map

| Document | Audience | Assumes | Covers |
|----------|----------|---------|--------|
| [TUTORIAL.md](./TUTORIAL.md) | Novice → Advanced | Nothing | Setup, config, first conversation, working on projects, daily usage, troubleshooting |
| [OVERVIEW.md](./OVERVIEW.md) | Intermediate → Advanced | TUTORIAL | Architecture, subsystems, data flows |
| [FLOWS.md](./FLOWS.md) | Advanced | OVERVIEW | Call chains and data flows for every primary code path |
| [TUI.md](./TUI.md) | Intermediate → Advanced | React, Ink | TUI design blueprint, current implementation, proposed features |
| [TUI_FLOWS.md](./TUI_FLOWS.md) | Advanced | OVERVIEW, TUI.md | TUI component interactions and call chains |
| [STREAMING.md](./STREAMING.md) | Intermediate → Advanced | OVERVIEW | Streaming event → segment mapping and coalescing |
| [VECTOR_SEARCH.md](./VECTOR_SEARCH.md) | Intermediate → Advanced | OVERVIEW | Semantic code search, indexing, configuration |
| [CODE_STYLE.md](./CODE_STYLE.md) | Contributor | Node.js | Coding conventions, testing, git workflow |
| [THREAT_MODEL.md](./THREAT_MODEL.md) | Advanced | OVERVIEW | Assets, trust boundaries, attack vectors, mitigations |
| [GLOSSARY.md](./GLOSSARY.md) | All | Nothing | Shared vocabulary across all documents |

## Conventions

- **Status badges** in design documents (e.g., `✅ Implemented`, `🔶 Proposed`, `⚠️ Debt`) distinguish what exists from what is imagined. A document without a badge is a mix — cross-check against the source before relying on it.
- **Cross-references** use relative links (`./FILE.md`). The [GLOSSARY.md](./GLOSSARY.md) defines terms used across documents.
- **Accuracy:** These documents are maintained against the source. If a document and the code disagree, the code is the source of truth — update the document.
