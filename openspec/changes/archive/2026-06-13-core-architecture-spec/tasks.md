# Tasks: Core Architecture Spec

## 1. Create the spec artifact

- [x] Write `openspec/specs/app-architecture/spec.md` with all requirements and scenarios
- [x] Ensure each requirement has at least one scenario
- [x] Cross-reference existing subsystem specs where applicable

## 2. Review and validate

- [x] Walk through `index.js` line-by-line against the spec requirements
- [x] Verify all 10 boot sequence steps are captured
- [x] Verify all subsystem wiring points are documented
- [x] Verify shutdown lifecycle covers all cleanup paths
- [x] Verify TUI and chat mode differences are captured

## 3. Integration

- [x] Add `app-architecture` to any OpenSpec index or table of contents
- [x] Update AGENTS.md section 2.0 to reference `app-architecture/spec.md` as the top-level architecture document
- [x] Ensure the spec appears in the OpenSpec directory listing

## 4. Future: Spec-driven code generation (optional)

- [ ] Evaluate whether the spec can drive automated boot-sequence validation tests
- [ ] Consider generating a diagram (e.g., Mermaid) from the spec's subsystem wiring requirements
