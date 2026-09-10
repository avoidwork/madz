## ADDED Requirements

### Requirement: applyDotPath helper for config materialization
The system SHALL provide an `applyDotPath()` helper function that materializes intermediate objects and arrays in a target object given a dot-path and value. This helper is used by `syncEnv()` and is also available for config mutation scenarios.

#### Scenario: applyDotPath creates intermediate objects
- **WHEN** `applyDotPath(obj, "a.b.c", "value")` is called
- **THEN** `obj.a.b.c` equals `"value"` and intermediate objects `a` and `b` are created

#### Scenario: applyDotPath creates arrays for numeric segments
- **WHEN** `applyDotPath(obj, "arr.0", "first")` is called
- **THEN** `obj.arr` is an array with `"first"` at index 0

#### Scenario: applyDotPath fills array gaps with null
- **WHEN** `applyDotPath(obj, "arr.2", "third")` is called on a new object
- **THEN** `obj.arr` is `[null, null, "third"]`
