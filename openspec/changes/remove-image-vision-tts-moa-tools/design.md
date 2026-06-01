## Context

The project uses a tool registry pattern in `src/tools/index.js` that imports, registers permissions, maps factories, and switches on tool names for all 18 tools. Four of these tools (`image_generate`, `vision_analyze`, `text_to_speech`, `mixture_of_agents`) depend on external APIs and add complexity (image downloaders, streaming audio handlers, multi-step agent coordination). The remaining tier-2 tools after removal are `web_search`, `web_extract`, `execute_code`, and `cronjob`.

## Goals / Non-Goals

**Goals:**
- Delete 4 tool files and their tests cleanly
- Remove all references in `src/tools/index.js` (imports, permissions, factories, switch cases)
- Update the `tools-tier2` spec to reflect only remaining tools
- Update `docs/FLOWS.md` to remove removed tool references
- Maintain 100% test coverage on remaining code

**Non-Goals:**
- No refactoring of remaining tool files
- No changes to the tool registration / permission gating architecture
- No changes to tier-1 tools

## Decisions

1. **Delete tool files outright rather than deprecate.** There is no external API consumer depending on these tools, and the project enforces 100% coverage — keeping dead code with skipped tests would conflict with pre-commit hooks.

2. **Remove `network:outbound` tier-2 requirement entirely.** After removal, the only tier-2 reference in the spec was the permission gating requirement itself. Since `web_search`, `web_extract`, `execute_code`, and `cronjob` have their own individual permission checks in code and in their own requirements, a blanket "all tier-2 tools need network:outbound" requirement becomes misleading.

3. **Use delta spec (REMOVED Requirements) rather than rewriting the whole spec.** Keeping the remaining requirements (web search, web extract, vision, tts, execute code, cronjob, safety limits) as-is preserves testability for the tools that stay. The four removed requirements and the blanket permission requirement are removed via delta.

## Risks / Trade-offs

- **[Breaking change for users relying on these tools]** → Document removal in FLOWS.md and release notes. No migration path exists since the tools are being removed entirely.
- **[Test coverage gap during transition]** → Deleting tests and cleaning up `index.js` must be coordinated so tests pass at each step. Run `npm run test` after each major change group.
- **[Spec drift during delta editing]** → The delta REMOVED spec must exactly match requirement headers in the original spec to avoid archive-time mismatches.

## Migration Plan

1. Implement all changes on the feature branch
2. Run `npm run test` to verify all remaining tests pass with 100% coverage
3. Open PR targeting `main`
4. No runtime migration needed — tools are removed, not deprecated

## Open Questions

None.
