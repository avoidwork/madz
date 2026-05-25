## MODIFIED Requirements

### Requirement: Session Context Window
The system SHALL maintain a conversation context window limited to the most recent N exchanges (configurable via `session.context_window_size` in `config.yaml`), discarding older exchanges from the active LLM prompt. The checkpointer thread MUST be linked to the session identifier so that LangGraph state is persisted and resumed per session.

#### Scenario: Context window is enforced
- **WHEN** a conversation exceeds `session.context_window_size` exchanges
- **THEN** the system removes the oldest exchanges from the prompt sent to the LLM while retaining full history in the LangGraph checkpointer

#### Scenario: Context window is configured
- **WHEN** `config.yaml` sets `session.context_window_size: 20`
- **THEN** only the last 20 message exchanges are included in the LLM prompt, with LangGraph checkpoints preserved per session thread

### Requirement: Session Memory Loading
On session creation, the system SHALL load the latest conversation file from `memory/`, reconstruct the visible conversation buffer, and associate the session with a LangGraph checkpointer thread ID for persistent agent state.

#### Scenario: Session resumes from last conversation with checkpointed state
- **WHEN** the harness starts and a previous conversation file exists in `memory/`
- **THEN** the system renders previous messages in the conversation panel and resumes the agent from the LangGraph checkpoint for that `thread_id`
