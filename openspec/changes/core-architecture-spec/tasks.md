# Tasks: Core Architecture Spec

## 1. Create the spec artifact

- [ ] Write `openspec/specs/app-architecture/spec.md` with all requirements and scenarios
- [ ] Ensure each requirement has at least one scenario
- [ ] Cross-reference existing subsystem specs where applicable

## 2. Review and validate

- [ ] Walk through `index.js` line-by-line against the spec requirements
- [ ] Verify all 10 boot sequence steps are captured
- [ ] Verify all subsystem wiring points are documented
- [ ] Verify shutdown lifecycle covers all cleanup paths
- [ ] Verify TUI and chat mode differences are captured

## 3. Integration

- [ ] Add `app-architecture` to any OpenSpec index or table of contents
- [ ] Update AGENTS.md section 2.0 to reference `app-architecture/spec.md` as the top-level architecture document
- [ ] Ensure the spec appears in the OpenSpec directory listing

## 4. Future: Spec-driven code generation (optional)

- [ ] Evaluate whether the spec can drive automated boot-sequence validation tests
- [ ] Consider generating a diagram (e.g., Mermaid) from the spec's subsystem wiring requirements
