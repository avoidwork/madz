## Requirement: Application Entry Point

The application SHALL expose a single entry point (`index.js`) that orchestrates subsystem initialization, mode detection, and lifecycle management.

### Scenario: Entry point loads configuration first

- **WHEN** the application starts
- **THEN** the configuration is loaded from `config.yaml` via `src/config/loader.js` before any subsystem is initialized

### Scenario: Entry point detects CLI mode

- **WHEN** the application receives CLI arguments
- **THEN** the system determines the mode: `interactive` (TUI) if `--mode interactive` is present, otherwise `chat` (non-interactive)

### Scenario: Entry point exports subsystems for testing

- **WHEN** the module is imported by tests or other modules
- **THEN** the entry point exports `config`, `sessionId`, `sessionState`, `registry`, `tracer`, `dispatchProvider`, `handleConversation`, `invokeSkill`, `handleShutdown`, `scheduleManager`, `setConfigValue`, `loadContext`, `writeMemoryFile`, `readMemoryFile`, `loadMemories`, and `formatMemoriesForPrompt`

---

## Requirement: Boot Sequence

The application SHALL initialize subsystems in a defined order to ensure dependencies are satisfied before consumers are wired.

### Scenario: Crontab sync runs before any subsystem

- **WHEN** `config.schedules.syncOnInit` is not `false`
- **THEN** the scheduler synchronizes the system crontab from persisted job definitions before any other subsystem initializes

### Scenario: Sessions directory is ensured before session creation

- **WHEN** the application boots
- **THEN** the sessions directory (`memory/sessions/`) is created if it does not exist, before any session is created or restored

### Scenario: Onboarding runs only if profile is missing

- **WHEN** the application starts and no user profile exists
- **THEN** the contextual onboarding flow is initialized; if profile detection fails, the application continues without onboarding (graceful degradation)

### Scenario: Telemetry initializes only when enabled

- **WHEN** `config.telemetry.enabled` is `true`
- **THEN** the OpenTelemetry provider is initialized and a tracer is created; if disabled, no telemetry subsystem is active

### Scenario: Skill registry discovers skills before tool construction

- **WHEN** the application boots
- **THEN** the skills directory is ensured, the registry discovers all skills, and the catalog is built before tools are constructed

### Scenario: Memory system loads before prompt assembly

- **WHEN** the system prompt is loaded
- **THEN** memory entries are read from the context directory and formatted for injection into the prompt

### Scenario: GC manager initializes with graceful degradation

- **WHEN** `config.memory.gc.enabled` is not `false`
- **THEN** the V8 GC manager is initialized with configured idle timeout and max calls per hour; if initialization fails, the application continues without GC management

### Scenario: Checkpointer is created before tools

- **WHEN** the application constructs tools
- **THEN** the checkpointer exists so that `compactContext` tool can access it

### Scenario: Ephemeral memory cleanup runs asynchronously

- **WHEN** the session initializes
- **THEN** expired ephemeral memories are cleaned up via `queueMicrotask` (non-blocking); if the cleanup import fails, the session starts normally

### Scenario: React agent is created after provider and tools

- **WHEN** the application creates the agent
- **THEN** the chat model (from the configured provider), the assembled tools, and the checkpointer are all available

---

## Requirement: Subsystem Wiring

The application SHALL wire subsystems in a dependency graph where each subsystem receives only the primitives it requires.

### Scenario: Provider creates the chat model

- **WHEN** the provider configuration is loaded
- **THEN** `createChatModel` produces a LangChain-compatible chat model instance from the first configured provider (default: `openai`)

### Scenario: Tools are built from the skill registry and config

- **WHEN** `buildToolConfig` is called
- **THEN** it receives the skill registry, sandbox config (permissions, paths, maxReadSize, safety, timeout, memoryLimit), session config, memory config, and checkpointer, and returns an assembled tools object

### Scenario: Agent receives model, tools, and checkpointer

- **WHEN** `createReactAgent` is called
- **THEN** it receives the chat model, assembled tools, checkpointer, and optional recursion limit, and returns a LangGraph React agent

### Scenario: Session state manages conversation and thread ID

- **WHEN** the session is created
- **THEN** a `SessionStateManager` wraps the initial state, manages the conversation array, and provides the thread ID for LangGraph checkpointing

### Scenario: Schedule manager runs background jobs

- **WHEN** the application is in interactive mode
- **THEN** a `ScheduleManager` instance runs configured cron jobs (e.g., `reflection-daily`) in the background

---

## Requirement: Provider Dispatch

The application SHALL provide a unified dispatch function that assembles the prompt and invokes the agent.

### Scenario: Provider dispatch assembles the full prompt

- **WHEN** `callProvider` is invoked
- **THEN** the system loads memory entries, formats them, generates the skill catalog prompt, and concatenates: `systemPrompt + skillCatalog + memoryEntries`

### Scenario: Provider dispatch tracks new threads

- **WHEN** the conversation is empty at dispatch time
- **THEN** `isNewThread: true` is passed to the agent for checkpoint configuration

### Scenario: Provider dispatch returns normalized result

- **WHEN** the agent completes
- **THEN** the result is returned as `{ provider, content, tokens: { input, output } }`

---

## Requirement: Conversation Handler

The application SHALL manage conversation flow: receiving user input, dispatching to the provider, recording exchanges, and persisting to disk.

### Scenario: Conversation handler restores a session

- **WHEN** a `sessionId` is provided
- **THEN** the existing conversation is loaded from `memory/sessions/` and replayed into the session state

### Scenario: Conversation handler persists after each exchange

- **WHEN** a response is received from the provider
- **THEN** the user message, assistant response, provider name, and session ID are written to `memory/sessions/` as JSON

---

## Requirement: Skill Invocation

The application SHALL provide a skill invocation path that validates the skill and returns execution context.

### Scenario: Skill invocation validates existence

- **WHEN** `invokeSkill` is called with a skill name
- **THEN** the system resolves the skill from the registry and throws an error if not found

### Scenario: Skill invocation validates enabled state

- **WHEN** the resolved skill is disabled
- **THEN** the system throws an error indicating the skill is disabled

### Scenario: Skill invocation resolves permissions

- **WHEN** the skill is found and enabled
- **THEN** permissions are resolved from the skill's metadata and returned in the invocation result

---

## Requirement: Shutdown Lifecycle

The application SHALL define a graceful shutdown sequence that persists state and releases resources.

### Scenario: Shutdown saves the session

- **WHEN** shutdown is triggered (signal, TUI exit, or chat mode completion)
- **THEN** the current conversation is saved to `memory/sessions/`

### Scenario: Shutdown stops the GC manager

- **WHEN** shutdown is triggered and a GC manager is active
- **THEN** the GC manager's idle timer is stopped

### Scenario: Shutdown flushes telemetry

- **WHEN** shutdown is triggered and telemetry is enabled
- **THEN** the OpenTelemetry tracer is shut down, flushing any pending spans

### Scenario: Shutdown flushes the logger

- **WHEN** shutdown completes
- **THEN** the structured logger flushes any pending log entries to disk

### Scenario: Shutdown is registered via a centralized handler

- **WHEN** the application initializes
- **THEN** `registerShutdownHandler` registers the shutdown function, and the handler is called from both the chat mode exit path and the TUI `onExit` callback

---

## Requirement: Configuration as Single Source of Truth

The application SHALL load all subsystem configuration from `config.yaml` and expose it as a singleton.

### Scenario: Configuration is loaded at boot

- **WHEN** the application starts
- **THEN** `loadConfig()` reads `config.yaml` and returns a merged configuration object

### Scenario: Configuration provides subsystem defaults

- **WHEN** a subsystem reads a config value that is not explicitly set
- **THEN** the system uses a defined default (e.g., `gc.idleTimeoutMs` defaults to `300000`, `gc.maxGcPerHour` defaults to `4`)

### Scenario: Configuration can be mutated at runtime

- **WHEN** `setConfigValue` is called
- **THEN** the configuration singleton is updated, and subsequent reads reflect the change

---

## Requirement: TUI Application

The application SHALL render a terminal user interface using Ink (React for CLI) when running in interactive mode.

### Scenario: TUI receives all subsystem references

- **WHEN** the TUI app is rendered
- **THEN** it receives `config`, `registry`, `sessionState`, `dispatchProvider`, `scheduleManager`, `invokeSkill`, `appInfo`, `onboarding`, `onSaveSession`, `gcManager.onActivity`, and `gcTrigger` as props

### Scenario: TUI handles session save on explicit save

- **WHEN** the user triggers a session save in the TUI
- **THEN** `onSaveSession` is called, which persists the current conversation to `memory/sessions/`

### Scenario: TUI flushes logger and restores terminal on exit

- **WHEN** the TUI exits
- **THEN** the logger is flushed, the terminal is restored (newline written), and the shutdown handler is invoked

---

## Requirement: Chat Mode Application

The application SHALL provide a non-interactive CLI mode for programmatic or scripted use.

### Scenario: Chat mode processes a single message

- **WHEN** the application runs in `--chat` mode with a message argument
- **THEN** `handleConversation` is called with the message and optional session ID, and the response is printed to stdout

### Scenario: Chat mode supports JSON output

- **WHEN** the `--json` flag is present
- **THEN** the response is serialized as JSON with `provider`, `content`, and `tokens` fields

### Scenario: Chat mode exits after processing

- **WHEN** the chat mode completes
- **THEN** shutdown handlers run, the logger flushes, and the process exits with code 0 (or 1 on error)
