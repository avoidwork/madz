## ADDED Requirements

### Requirement: InputPanel detects @ trigger and enters autocomplete mode
The InputPanel component SHALL detect when the user types the `@` character and enter autocomplete mode. In this mode, the component captures keyboard input for navigation instead of passing it to the underlying text input.

#### Scenario: User types @ to trigger autocomplete
- **WHEN** the user types `@` in the input field
- **THEN** the InputPanel enters autocomplete mode and displays a dropdown below the input line

#### Scenario: User types @ followed by characters to filter
- **WHEN** the user types `@` followed by one or more characters
- **THEN** the system performs a glob search using the typed characters as a prefix filter

#### Scenario: User dismisses autocomplete with Esc
- **WHEN** the user presses `Esc` while in autocomplete mode
- **THEN** the dropdown is dismissed, autocomplete mode exits, and the `@<query>` text remains in the input field

### Requirement: Glob search finds matching files
The system SHALL use `fast-glob` to search the project root for files matching the typed prefix. Results are limited to the top 5 matches.

#### Scenario: Glob search returns matches
- **WHEN** the user types `@src` in autocomplete mode
- **THEN** the system returns up to 5 files matching the prefix `src` from the project root

#### Scenario: Glob search returns no matches
- **WHEN** the user types `@xyznonexistent` in autocomplete mode
- **THEN** the system displays "No files match" in the dropdown

#### Scenario: Glob search excludes ignored directories
- **WHEN** the user types `@` followed by a prefix that matches files in `node_modules`
- **THEN** files in `node_modules` and other `.gitignore`-excluded directories are not included in results

### Requirement: Dropdown renders with keyboard navigation
The system SHALL render a dropdown list below the input line with keyboard navigation support.

#### Scenario: Up arrow navigates up the list
- **WHEN** the user presses the up arrow key while in autocomplete mode with matches
- **THEN** the selection index decreases (wrapping to the last item when at the first)

#### Scenario: Down arrow navigates down the list
- **WHEN** the user presses the down arrow key while in autocomplete mode with matches
- **THEN** the selection index increases (wrapping to the first item when at the last)

#### Scenario: Enter selects a file
- **WHEN** the user presses Enter while a file is selected in the dropdown
- **THEN** the `@<query>` text is replaced with the full file path and autocomplete mode exits

#### Scenario: Dropdown renders between InputPanel and StatusBar
- **WHEN** the autocomplete dropdown is visible
- **THEN** it is rendered as a sibling component below the InputPanel and above the StatusBar, without pushing the StatusBar content

### Requirement: Selected path renders in cyan/green
The system SHALL render the selected filename portion of the input in cyan/green using chalk ANSI codes.

#### Scenario: Selected filename is colored
- **WHEN** a file is selected and the input is displayed
- **THEN** the filename portion (after the `@` trigger) is rendered in cyan/green color

#### Scenario: Non-selected input remains default color
- **WHEN** the input contains text but no file is selected
- **THEN** the input text is rendered in the default color

### Requirement: Autocomplete state is managed in App component
The App component SHALL manage autocomplete state (`inAutocomplete`, `query`, `matches`, `selectedIndex`) and pass it as props to the InputPanel.

#### Scenario: State is lifted to App
- **WHEN** the user types `@` in the input
- **THEN** the App component updates `inAutocomplete` to true and passes state to InputPanel

#### Scenario: State resets on selection or dismiss
- **WHEN** the user selects a file or presses Esc
- **THEN** the App component resets `inAutocomplete` to false and clears `query`, `matches`, and `selectedIndex`

### Requirement: Debounced glob search
The system SHALL debounce glob search by 150ms to avoid excessive file system reads on every keystroke.

#### Scenario: Search is debounced
- **WHEN** the user types multiple characters rapidly in autocomplete mode
- **THEN** the glob search is executed only after 150ms of inactivity

#### Scenario: Search re-executes on new input after debounce
- **WHEN** the user types a new character after the debounce period
- **THEN** the glob search re-executes with the updated query
