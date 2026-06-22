## ADDED Requirements

### Requirement: ToolMessage preservation during compaction
The ReAct agent SHALL preserve ToolMessage instances during conversation compaction. When `compactConversation` is called and the resulting messages are rebuilt, any message with role "tool" MUST be reconstructed as a `ToolMessage` instance, not an `AIMessage` instance.

#### Scenario: ToolMessage preserved in callReactAgent
- **WHEN** a conversation exceeds context length and compaction is triggered in `callReactAgent`
- **THEN** the rebuilt messages include ToolMessage instances for all messages with role "tool"

#### Scenario: ToolMessage preserved in callReactAgentStreaming
- **WHEN** a conversation exceeds context length and compaction is triggered in `callReactAgentStreaming`
- **THEN** the rebuilt messages include ToolMessage instances for all messages with role "tool"

#### Scenario: Tool results available after compaction
- **WHEN** the agent continues execution after compaction
- **THEN** tool results from before compaction are available in the message history