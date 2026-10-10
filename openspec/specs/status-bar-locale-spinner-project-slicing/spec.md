# status-bar-locale-spinner-project-slicing Specification

## Purpose
TBD - created by archiving change tui-statusbar-locale-spinner-project-slicing. Update Purpose after archive.
## Requirements
### Requirement: Status bar formats numbers with the number-format locale
The status bar SHALL format numbers using the locale resolved from `Intl.NumberFormat().resolvedOptions().locale`, cached once at module load, rather than the date-format locale.

#### Scenario: formatNumber uses the number-format locale
- **WHEN** `formatNumber` is called with a number
- **THEN** it formats the number using the cached number-format locale

#### Scenario: formatSize uses the number-format locale
- **WHEN** `formatSize` is called with a number
- **THEN** it formats the scaled number using the cached number-format locale

### Requirement: Streaming spinner color reflects context-window utilization
The streaming spinner SHALL be colored by context-window utilization: cyan for 0-60%, orange for 61-80%, and red for 81-100%. When no context window is configured (0/unset), the spinner SHALL fall back to cyan.

#### Scenario: Spinner is cyan at low utilization
- **WHEN** context utilization is between 0% and 60% inclusive
- **THEN** the spinner renders in cyan

#### Scenario: Spinner is orange at mid utilization
- **WHEN** context utilization is between 61% and 80% inclusive
- **THEN** the spinner renders in orange

#### Scenario: Spinner is red at high utilization
- **WHEN** context utilization is 81% or higher
- **THEN** the spinner renders in red

#### Scenario: Spinner falls back to cyan without a context window
- **WHEN** the context window is 0 or unset
- **THEN** the spinner renders in cyan

### Requirement: Project path is sliced with path.basename
The status bar SHALL render only the basename of the project path when the path is under a `projects/` directory, falling back to the full path otherwise. The slicing SHALL use `path.basename()` rather than a string match on `projects/`.

#### Scenario: Project under projects/ renders basename
- **WHEN** the project path contains a `projects/` directory
- **THEN** the status bar renders only the basename of the path

#### Scenario: Project not under projects/ renders full path
- **WHEN** the project path is not under a `projects/` directory
- **THEN** the status bar renders the full path

### Requirement: Provider config exposes a contextWindow field
The OpenAI and Copilot provider config schemas SHALL expose a `contextWindow` field with a default of 128000, and the active provider's `contextWindow` SHALL be updated at runtime from the resolved model context length.

#### Scenario: contextWindow defaults to 128000
- **WHEN** a provider config is parsed without a `contextWindow` value
- **THEN** the `contextWindow` field defaults to 128000

#### Scenario: contextWindow is updated from the resolved model context length
- **WHEN** the model context length is resolved at agent init
- **THEN** the active provider's `contextWindow` field is updated to the resolved context length

