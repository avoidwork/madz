# Tasks

## 1. Config

- [x] 1.1 Add `src/config/schemas/poppy.js` (`PoppySchema`: enabled, rateLimit, timeout) and export it from `src/config/schemas/index.js` and `src/config/config.js`; verify `loadConfig().poppy` parses
- [x] 1.2 Add a `poppy:` section to `config.yaml` mirroring `jira:` defaults; verify config tests pass

## 2. Tool

- [x] 2.1 Implement `src/tools/poppy/index.js` (`poppyImpl`, `PoppyInputSchema`, `poppy` tool) with discovery, redirect, schema, domain and issuer checks; verify with `tests/unit/tools/poppy.test.js`
- [x] 2.2 Register `poppy` in `src/tools/index.js` (`TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, `ORCHESTRATOR_TOOLS`, `TOOLS`, `buildToolConfig`); verify with `tests/unit/tools_orchestrator.test.js`
- [x] 2.3 Add unit tests covering every scenario in the spec; verify `npm run test`, `npm run lint` and `npm run coverage` pass
