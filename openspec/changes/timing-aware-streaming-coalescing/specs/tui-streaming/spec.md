## ADDED Requirements

### Requirement: Stream events carry a per-segment arrival timestamp
The streaming event handler SHALL attach a `time` field to each segment it constructs, capturing the event arrival time via `Date.now()`, so the coalescing logic can gate cross-type transitions on timing.

#### Scenario: Message segment carries timestamp
- **WHEN** a `message` stream event is received
- **THEN** the segment passed to `updateMessage` includes a `time` field set to the event arrival time

#### Scenario: Reasoning segment carries timestamp
- **WHEN** a `reasoning` stream event is received
- **THEN** the segment passed to `updateMessage` includes a `time` field set to the event arrival time

#### Scenario: Chat model stream content segment carries timestamp
- **WHEN** an `on_chat_model_stream` event delivers content
- **THEN** the segment passed to `updateMessage` includes a `time` field set to the event arrival time

#### Scenario: Chat model stream reasoning segment carries timestamp
- **WHEN** an `on_chat_model_stream` event delivers reasoning
- **THEN** the segment passed to `updateMessage` includes a `time` field set to the event arrival time
