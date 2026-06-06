## 1. Update types.js — drop inputSchema/outputSchema, add standard fields

- [ ] 1.1 Remove SkillInputSchema and SkillMetadataSchema inputSchema/outputSchema fields
- [ ] 1.2 Add license, compatibility, metadata, allowed-tools, disabled fields to SkillMetadataSchema
- [ ] 1.3 Update PermissionSchema if permission values need adjustments
- [ ] 1.4 Export only new schema types from types.js (remove SkillInputSchema)

## 2. Rewrite discoverer.js — parse SKILL.md frontmatter

- [ ] 2.1 Add extractFrontmatter function that parses YAML between `---` delimiters
- [ ] 2.2 Add lenientYamlParse fallback that retries with quoted colons
- [ ] 2.3 Update discoverSkills to scan for SKILL.md files instead of skill.yaml/skill.json
- [ ] 2.4 Add cross-client directory scope constants: project skills/, .agents/skills/, user ~/.agents/skills/
- [ ] 2.5 Update discoverSkills to scan multiple scopes (project-level + user-level)
- [ ] 2.6 Add name collision detection — project overrides user, log warning on shadow
- [ ] 2.7 Add trust check flag: only load project-level skills if trust config is set
- [ ] 2.8 Add .gitignore / dotfile filtering — skip node_modules, .git, hidden dirs

## 3. Rewrite validator.js — enforce spec constraints with lenient validation

- [ ] 3.1 Add validateSkillName function with spec constraints (chars, length, directory match)
- [ ] 3.2 Add validateSkillDescription function with 1-1024 char constraint
- [ ] 3.3 Add validateOptionalFields for compatibility (max 500 chars), metadata (string map)
- [ ] 3.4 Update validateSkillSchema to use new validators with lenient approach (warn, don't skip — except empty desc or unparseable YAML)
- [ ] 3.5 Remove inputSchema/outputSchema validation logic

## 4. Update registry.js — wire to new discoverer output

- [ ] 4.1 Update discover method to use new frontmatter-extracted metadata shape
- [ ] 4.2 Store full SKILL.md body path in skill record for progressive disclosure
- [ ] 4.3 Add getCatalog method that returns {name, description, location} for all skills (tier 1 of progressive disclosure)
- [ ] 4.4 Add getSkillBody method that reads full SKILL.md body at activation time (tier 2)

## 5. Update tools/skills.js — remove schema references

- [ ] 5.1 Remove inputSchema and outputSchema from skill_viewImpl output object
- [ ] 5.2 Add compatibility and metadata fields to skill_view output
- [ ] 5.3 Update tools/skills.js description to reflect new SKILL.md format
- [ ] 5.4 Keep skill_view tool but re-purpose it as a legacy access path (still valid for manual inspection)

## 6. Update tools/index.js — remove skills_list from tool permissions

- [ ] 6.1 Remove skills_list from TOOL_PERMISSIONS map
- [ ] 6.2 Remove skills_list from TOOL_FACTORIES map
- [ ] 6.3 Remove skill_view from TOOL_PERMISSIONS or keep it (decision: keep for manual TUI use)

## 7. Replace fork with spawn in sandbox/runner.js

- [ ] 7.1 Create detectInterpreter function that maps file extension to interpreter command
- [ ] 7.2 Create detectShebang function that reads first line of script
- [ ] 7.3 Update runSandbox to use child_process.spawn instead of fork
- [ ] 7.4 Pass --max-old-space-size to Node.js scripts based on memoryLimit config
- [ ] 7.5 For non-Node.js scripts, set appropriate resource limits or skip memory flag
- [ ] 7.6 Ensure stdout/stderr collection still works with spawn's Stream data event

## 8. Update tools/skills.js progressive disclosure support

- [ ] 8.1 Update skills_list tool to call registry.getCatalog() instead of registry.list()
- [ ] 8.2 Add systemPrompt section generation function that formats catalog for model injection
- [ ] 8.3 Export generateSkillCatalogPrompt utility for use in system prompt construction

## 9. Update config defaults

- [ ] 9.1 Add trustProjectSkills config default to sandbox config (boolean, default true)
- [ ] 9.2 Add scanPaths config default that includes `skills/` and `.agents/skills/` patterns
- [ ] 9.3 Update ConfigSchema if new config options are needed

## 10. Update schema validation and tests

- [ ] 10.1 Update openspec/specs/skills-registry/spec.md to use SKILL.md format
- [ ] 10.2 Add unit tests for extractFrontmatter in discoverer.js
- [ ] 10.3 Add unit tests for validateSkillName constraints
- [ ] 10.4 Add unit tests for validateSkillDescription constraints
- [ ] 10.5 Add unit tests for lenientYamlParse fallback
- [ ] 10.6 Add unit tests for detectInterpreter by extension and shebang
- [ ] 10.7 Add unit tests for cross-client dir collision handling
- [ ] 10.8 Verify all existing unit tests pass (registry.test.js, sandbox.test.js)
- [ ] 10.9 Run full test suite with coverage to ensure 100%

## 11. Integration verification

- [ ] 11.1 Create a test SKILL.md with full frontmatter and validate end-to-end discovery
- [ ] 11.2 Verify catalog generation outputs correct name/description/location
- [ ] 11.3 Verify that spawning a .py script from a skill directory works end-to-end
- [ ] 11.4 Verify system prompt includes skill catalog correctly
- [ ] 11.5 Run npm run lint and npm run fix to ensure no linting issues
- [ ] 11.6 Run npm run coverage to regenerate coverage.txt and verify 100%
