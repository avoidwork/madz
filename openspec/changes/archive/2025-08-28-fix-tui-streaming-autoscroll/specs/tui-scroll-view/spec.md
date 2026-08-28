# tui-scroll-view Specification (Modified)

## Purpose
Define the renderData/prune loop optimization and children array stabilization.

## Requirements

### Requirement: renderData/prune loop SHALL be guarded by length change
The renderData slice and prune loop in MessageList SHALL only execute when the message count has changed, preventing unnecessary allocations on every render.

#### Scenario: Loop skipped when count unchanged
- **WHEN** the message count is the same as the previous render
- **THEN** renderData slice and prune loop are skipped

#### Scenario: Loop runs when count changes
- **WHEN** a new message is added or removed
- **THEN** renderData slice and prune loop execute normally

### Requirement: Children array SHALL be stabilized in a ref
The children array SHALL be stored in a ref and only rebuilt when the message count changes, allowing Ink's diffing to reuse existing elements.

#### Scenario: Children ref persists across renders
- **WHEN** the component re-renders without message changes
- **THEN** the same children array reference is used

#### Scenario: Children ref updates on count change
- **WHEN** the message count changes
- **THEN** a new children array is created and stored in the ref
