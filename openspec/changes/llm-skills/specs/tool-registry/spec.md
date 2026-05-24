## ADDED Requirements

### Requirement: Tool Skill ID
Tools MAY be associated with a `skill_id` string that references the skill definition that registered them. When a skill invokes a tool, the tool registry MUST track the `skill_id` in execution logs so that tool invocations can be audited back to the originating skill. The `skill_id` is stored in the execution log alongside existing fields (session_id, duration_ms, destructive).

#### Scenario: Tool invocation logs skill_id
- **WHEN** a skill invokes a tool
- **THEN** the tool execution log entry includes a `skill_id` field with the originating skill's name

#### Scenario: Tool with no skill association omits skill_id
- **WHEN** a tool is invoked without a `skill_id` context (regular user request)
- **THEN** the log entry omits the `skill_id` field (null/undefined)
