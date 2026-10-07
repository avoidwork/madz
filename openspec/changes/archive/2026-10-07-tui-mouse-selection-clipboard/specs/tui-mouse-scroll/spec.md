## MODIFIED Requirements

### Requirement: Mouse reporting is enabled and disabled around the hook lifecycle
The `useMouseScroll` hook SHALL enable terminal mouse reporting (`\x1b[?1000h` / `\x1b[?1006h`) and button-event tracking (`\x1b[?1002h`) on mount and disable them (`\x1b[?1000l` / `\x1b[?1006l` / `\x1b[?1002l`) on unmount. It SHALL remove its stdin listener on unmount.

#### Scenario: Mouse reporting enabled on mount
- **WHEN** the `useMouseScroll` hook mounts
- **THEN** the terminal mouse reporting sequences (`\x1b[?1000h` / `\x1b[?1006h`) and button-event tracking (`\x1b[?1002h`) are written to stdout

#### Scenario: Mouse reporting disabled on unmount
- **WHEN** the `useMouseScroll` hook unmounts
- **THEN** the terminal mouse reporting disable sequences (`\x1b[?1000l` / `\x1b[?1006l` / `\x1b[?1002l`) are written to stdout and the stdin listener is removed
