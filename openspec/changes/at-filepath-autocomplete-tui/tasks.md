## 1. Add fast-glob dependency

- [ ] 1.1 Add fast-glob to package.json dependencies
- [ ] 1.2 Run npm install to update lockfile

## 2. Create autocomplete utility module

- [ ] 2.1 Create src/tui/autocomplete.js with glob search function
- [ ] 2.2 Implement debounced file search using fast-glob with 150ms delay
- [ ] 2.3 Implement file filtering to exclude node_modules and .git directories
- [ ] 2.4 Limit results to top 5 matches
- [ ] 2.5 Export search function for use by InputPanel

## 3. Extend InputPanel with autocomplete mode

- [ ] 3.1 Add autocomplete mode detection for @ trigger character
- [ ] 3.2 Implement keyboard interception (up/down/Enter/Esc) in autocomplete mode
- [ ] 3.3 Pass autocomplete state props from parent component
- [ ] 3.4 Maintain query string and selection index state within InputPanel
- [ ] 3.5 When not in autocomplete mode, pass all keys through to TextInput normally

## 4. Create autocomplete dropdown component

- [ ] 4.1 Create src/tui/AutoCompleteDropdown.js component
- [ ] 4.2 Render list of matching file paths
- [ ] 4.3 Highlight selected item with visual indicator
- [ ] 4.4 Display "No files match" when search returns zero results
- [ ] 4.5 Position dropdown below input line (sibling component, not overlay)

## 5. Lift autocomplete state to App component

- [ ] 5.1 Add autocomplete state (inAutocomplete, query, matches, selectedIndex) to App
- [ ] 5.2 Pass autocomplete state and handlers as props to InputPanel
- [ ] 5.3 Pass autocomplete state and dropdown component reference to App render
- [ ] 5.4 Reset state on selection or dismiss (Esc)

## 6. Integrate dropdown rendering in App

- [ ] 6.1 Render AutoCompleteDropdown between InputPanel and StatusBar in Box hierarchy
- [ ] 6.2 Conditionally render dropdown only when inAutocomplete is true
- [ ] 6.3 Ensure StatusBar is not pushed down by dropdown rendering

## 7. Implement path selection and coloring

- [ ] 7.1 On Enter key, replace @<query> with full file path in input value
- [ ] 7.2 Split input value into segments for colored rendering
- [ ] 7.3 Render selected filename portion in cyan/green using chalk
- [ ] 7.4 Exit autocomplete mode after selection

## 8. Add tests

- [ ] 8.1 Create tests/unit/tui/autocomplete.test.js for glob search function
- [ ] 8.2 Test debounced search behavior
- [ ] 8.3 Test file filtering (exclusion of node_modules, .git)
- [ ] 8.4 Test result limiting to 5 matches
- [ ] 8.5 Create tests/unit/tui/AutoCompleteDropdown.test.js for dropdown component
- [ ] 8.6 Test keyboard navigation (up/down wrapping)
- [ ] 8.7 Test "No files match" display

## 9. Verify and lint

- [ ] 9.1 Run npm run lint to verify no lint errors
- [ ] 9.2 Run npm run test to verify all tests pass
- [ ] 9.3 Run timeout 10 npm start to verify application starts
