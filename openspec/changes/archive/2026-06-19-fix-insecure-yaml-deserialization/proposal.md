## Why

The config loader uses `yaml.load()` to parse `config.yaml`, which is vulnerable to arbitrary code execution if the YAML file contains malicious tags (e.g., `!!js/function`). This security vulnerability needs to be fixed to prevent potential code execution attacks through malicious configuration files.

## What Changes

- Replace `yaml.load(fileContent)` with `yaml.safeLoad(fileContent)` in `src/config/loader.js` at line 139
- Add a comment explaining the security rationale for using safe YAML parsing
- Add unit tests for malicious YAML input and edge cases (empty config, malformed YAML)

## Capabilities

### New Capabilities
- None — this is a security bug fix, not a new capability

### Modified Capabilities
- `config-system`: Add security requirement for safe YAML parsing to prevent arbitrary code execution

## Impact

- **Affected code**: `src/config/loader.js` — the config loader module
- **Dependencies**: `js-yaml` v4.2.0 (already in use, `safeLoad` is available)
- **Systems**: Configuration loading subsystem
- **Breaking changes**: None — `yaml.safeLoad()` is compatible with existing config files