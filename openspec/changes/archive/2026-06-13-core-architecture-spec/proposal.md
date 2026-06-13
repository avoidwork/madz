# Change: Core Architecture Spec

## Why

The OpenSpec specs directory contains 28 subsystem-level specifications but no single artifact that describes the application as a whole. Anyone (human or agent) reading the specs gets the parts — memory, scheduler, TUI, provider, agent, tools — but not the whole. The entry point (`index.js`), the boot sequence, the subsystem wiring, the CLI modes, and the shutdown lifecycle are all undocumented at the spec level.

This creates a gap: to understand how the system fits together, one must read raw code. The spec layer should provide that high-level map.

## What

Create a new spec `app-architecture` that describes:
- The application entry point and boot sequence (ordered initialization of subsystems)
- How subsystems wire together (provider → agent → tools → session → memory → scheduler → TUI)
- CLI modes (`--mode interactive` vs `--chat`) and their differing lifecycles
- The shutdown lifecycle and signal handling
- The overall data flow and component relationships
- Configuration loading and its role as the single source of truth

## Impact

- Adds one new spec: `app-architecture/spec.md`
- No code changes required — this is a documentation/spec artifact only
- Existing subsystem specs remain unchanged; this spec references them for detailed requirements

## Non-Goals

- Refactoring the boot sequence or entry point
- Adding new subsystems or capabilities
- Changing any existing behavior
