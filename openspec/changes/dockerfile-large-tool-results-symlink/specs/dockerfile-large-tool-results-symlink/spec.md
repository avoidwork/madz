## ADDED Requirements

### Requirement: /large_tool_results symlink to /tmp

The Dockerfile runtime stage SHALL create a symlink so `/large_tool_results` resolves to `/tmp`, keeping large tool outputs off the container's writable layer.

#### Scenario: Symlink is created in the runtime stage

- **WHEN** the Dockerfile runtime stage (the second `FROM node:26-slim` block) is parsed
- **THEN** a `RUN ln -s /tmp /large_tool_results` command appears after the permissions block (`RUN chown -R madz:node /app /home/madz`)

#### Scenario: Symlink resolves to /tmp

- **WHEN** the container is built and started
- **THEN** `readlink /large_tool_results` resolves to `/tmp`

#### Scenario: Writes to /large_tool_results land in /tmp

- **WHEN** a large tool result is offloaded to `/large_tool_results/<tool_call_id>.txt`
- **THEN** the file is written under `/tmp` rather than the container's writable layer
