## 1. Update skills-registry spec

- [x] 1.1 Create delta spec at openspec/changes/rename-system-skills-to-dot-skills/specs/skills-registry/spec.md with MODIFIED Cross-Client Directory Scanning requirement
- [x] 1.2 Verify delta spec replaces `.agents/skills/` with `.skills/` and updates all scenarios

## 2. Verify change artifacts

- [x] 2.1 Run `openspec status --change rename-system-skills-to-dot-skills` to confirm all artifacts are done
- [x] 2.2 Verify delta spec is valid (no `openspec diff` command available — confirmed via status check)
