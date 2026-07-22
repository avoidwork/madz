## REMOVED Requirements

### Requirement: subAgent tool spawns child processes
**Reason:** Replaced by Deep Agents native orchestration; process spawning is no longer needed
**Migration:** The subAgent tool is removed entirely; delegation is handled by the Deep Agents orchestrator

### Requirement: subAgentLog tool manages log files
**Reason:** Replaced by Deep Agents built-in observability; log file management is no longer needed
**Migration:** The subAgentLog tool is removed entirely; logging is handled by Deep Agents

### Requirement: subAgentMessage tool sends stdin messages
**Reason:** Replaced by Deep Agents native coordination; stdin messaging is no longer needed
**Migration:** The subAgentMessage tool is removed entirely; coordination is handled by Deep Agents

### Requirement: subAgent tools registered in TOOL_PERMISSIONS
**Reason:** Tools are deleted; registrations must be removed
**Migration:** Remove subAgent, subAgentLog, and subAgentMessage from TOOL_PERMISSIONS in src/tools/index.js

### Requirement: subAgent tools registered in TOOL_FACTORIES
**Reason:** Tools are deleted; factory registrations must be removed
**Migration:** Remove subAgent, subAgentLog, and subAgentMessage from TOOL_FACTORIES in src/tools/index.js

### Requirement: Recursion guard excludes subAgent tools
**Reason:** subAgent tools are deleted; recursion guard exclusions are no longer needed
**Migration:** Remove subAgent tool exclusions from recursion guard in src/tools/index.js