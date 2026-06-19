## Context

The config loader in `src/config/loader.js` uses `yaml.load()` to parse `config.yaml` files. This is a security vulnerability because `yaml.load()` can execute arbitrary code if the YAML file contains malicious tags (e.g., `!!js/function`). The project uses js-yaml v4.2.0, where `yaml.load()` is technically safe by default (uses JSON_SCHEMA), but the code should explicitly use `yaml.safeLoad()` to make the security intent clear and prevent future confusion or issues if the library version changes.

## Goals / Non-Goals

**Goals:**
- Replace `yaml.load()` with `yaml.safeLoad()` in `src/config/loader.js` to explicitly use safe YAML parsing
- Add a comment explaining the security rationale for using safe YAML parsing
- Add unit tests to verify malicious YAML tags are handled safely
- Ensure no regressions in existing config loading functionality

**Non-Goals:**
- Modifying other files that use `yaml.load()` (e.g., `src/memory/reader.js`, `src/skills/discoverer.js`) unless specifically needed
- Changing the js-yaml library version or configuration
- Adding new configuration features or capabilities

## Decisions

1. **Use `yaml.safeLoad()` instead of `yaml.load()`**
   - Rationale: `yaml.safeLoad()` explicitly indicates that safe parsing is intended, making the security intent clear in the code
   - Alternatives considered:
     - Using `yaml.load()` with explicit schema: `yaml.load(content, { schema: yaml.DEFAULT_SCHEMA })` — more verbose but equally safe
     - Upgrading js-yaml version — not necessary as v4.2.0 is already safe by default
   - Chosen: `yaml.safeLoad()` is simpler and more explicit about the security intent

2. **Limit changes to `src/config/loader.js`**
   - Rationale: The config loader is the most critical file since it parses user-provided `config.yaml` files
   - Other files (`src/memory/reader.js`, `src/skills/discoverer.js`) parse internal/frontmatter YAML which is less likely to be malicious
   - These files can be addressed in a separate security audit if needed

3. **Add unit tests for malicious YAML input**
   - Rationale: Tests verify that the fix works and prevent regression
   - Tests should cover malicious YAML tags, empty config, and malformed YAML

## Risks / Trade-offs

1. **[Risk] `yaml.safeLoad()` may reject some YAML features not supported by the safe schema**
   - [Mitigation] Config files should only contain simple data types (strings, numbers, booleans, arrays, objects), so this is unlikely to be an issue. Test with existing config files to verify.

2. **[Risk] Existing configs with special YAML tags may fail to parse**
   - [Mitigation] This is actually the desired behavior — malicious tags should be rejected. Test with existing configs to ensure no legitimate use cases are broken.

3. **[Trade-off] Minimal change vs. comprehensive security audit**
   - [Mitigation] This fix addresses the specific vulnerability reported in the issue. A comprehensive security audit of all YAML usage can be done separately if needed.