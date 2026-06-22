## 1. Update types.js — drop inputSchema/outputSchema, add standard fields

- [x] 1.1 Remove SkillInputSchema and SkillMetadataSchema inputSchema/outputSchema fields
- [x] 1.2 Add license, compatibility, metadata, allowed-tools, disabled fields to SkillMetadataSchema
- [x] 1.3 Update PermissionSchema if permission values need adjustments
- [x] 1.4 Export only new schema types from types.js (remove SkillInputSchema)

## 2. Rewrite discoverer.js — parse SKILL.md frontmatter

- [x] 2.1 Add extractFrontmatter function that parses YAML between `---` delimiters
- [x] 2.2 Add lenientYamlParse fallback that retries with quoted colons
- [x] 2.3 Update discoverSkills to scan for SKILL.md files instead of skill.yaml/skill.json
- [x] 2.4 Add cross-client directory scope constants: project skills/, .agents/skills/, user ~/.agents/skills/
- [x] 2.5 Update discoverSkills to scan multiple scopes (project-level + user-level)
- [x] 2.6 Add name collision detection — project overrides user, log warning on shadow
- [x] 2.7 Add trust check flag: only load project-level skills if trust config is set
- [x] 2.8 Add .gitignore / dotfile filtering — skip node_modules, .git, hidden dirs

## 3. Rewrite validator.js — enforce spec constraints with lenient validation

- [x] 3.1 Add validateSkillName function with spec constraints (chars, length, directory match)
- [x] 3.2 Add validateSkillDescription function with 1-1024 char constraint
- [x] 3.3 Add validateOptionalFields for compatibility (max 500 chars), metadata (string map)
- [x] 3.4 Update validateSkillSchema to use new validators with lenient approach (warn, don't skip — except empty desc or unparseable YAML)
- [x] 3.5 Remove inputSchema/outputSchema validation logic

## 4. Update registry.js — wire to new discoverer output

- [x] 4.1 Update discover method to use new frontmatter-extracted metadata shape
- [x] 4.2 Store full SKILL.md body path in skill record for progressive disclosure
- [x] 4.3 Add getCatalog method that returns {name, description, location} for all skills (tier 1 of progressive disclosure)
- [x] 4.4 Add getSkillBody method that reads full SKILL.md body at activation time (tier 2)

## 5. Update tools/skills.js — remove schema references

- [x] 5.1 Remove inputSchema and outputSchema from skill_viewImpl output object
- [x] 5.2 Add compatibility and metadata fields to skill_view output
- [x] 5.3 Update tools/skills.js description to reflect new SKILL.md format
- [x] 5.4 Keep skill_view tool but re-purpose it as a legacy access path (still valid for manual inspection)

## 6. Update tools/index.js — remove skills_list from tool permissions

- [x] 6.1 Remove skills_list from TOOL_PERMISSIONS map
- [x] 6.2 Remove skills_list from TOOL_FACTORIES map
- [x] 6.3 Remove skill_view from TOOL_PERMISSIONS or keep it (decision: keep for manual TUI use)

## 7. Replace fork with spawn in sandbox/runner.js

- [x] 7.1 Create detectInterpreter function that maps file extension to interpreter command
- [x] 7.2 Create detectShebang function that reads first line of script
- [x] 7.3 Update runSandbox to use child_process.spawn instead of fork
- [x] 7.4 Pass --max-old-space-size to Node.js scripts based on memoryLimit config
- [x] 7.5 For non-Node.js scripts, set appropriate resource limits or skip memory flag
- [x] 7.6 Ensure stdout/stderr collection still works with spawn's Stream data event

## 8. Update tools/skills.js progressive disclosure support

- [x] 8.1 Update skills_list tool to call registry.getCatalog() instead of registry.list()
- [x] 8.2 Add systemPrompt section generation function that formats catalog for model injection
- [x] 8.3 Export generateSkillCatalogPrompt utility for use in system prompt construction

## 9. Update config defaults

- [x] 9.1 Add trustProjectSkills config default to sandbox config (boolean, default true)
- [x] 9.2 Add scanPaths config default that includes `skills/` and `.agents/skills/` patterns
- [x] 9.3 Update ConfigSchema if new config options are needed

## 10. Update schema validation and tests

- [x] 10.1 Update openspec/specs/skills-registry/spec.md to use SKILL.md format
- [x] 10.2 Add unit tests for extractFrontmatter in discoverer.js
- [x] 10.3 Add unit tests for validateSkillName constraints
- [x] 10.4 Add unit tests for validateSkillDescription constraints
- [x] 10.5 Add unit tests for lenientYamlParse fallback
- [x] 10.6 Add unit tests for detectInterpreter by extension and shebang
- [x] 10.7 Add unit tests for cross-client dir collision handling
- [x] 10.8 Verify all existing unit tests pass (registry.test.js, sandbox.test.js)
- [x] 10.9 Run full test suite with coverage to ensure 100%

## 11. Integration verification

- [x] 11.1 Create a test SKILL.md with full frontmatter and validate end-to-end discovery
- [x] 11.2 Verify catalog generation outputs correct name/description/location
- [x] 11.3 Verify that spawning a .py script from a skill directory works end-to-end
- [x] 11.4 Verify system prompt includes skill catalog correctly
- [x] 11.5 Run npm run lint and npm run fix to ensure no linting issues
- [x] 11.6 Run npm run coverage to regenerate coverage.txt and verify 100%
