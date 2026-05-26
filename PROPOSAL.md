# Proposal: LangGraph Checkpointing with SQLite

## Context

Currently, `madz` uses `createReactAgent` from `@langchain/langgraph/prebuilt` without a checkpointer. Conversation history lives only in an in-memory `SessionStateManager` and is written to flat JSON files on disk, which do not participate in LangGraph's checkpointing system. There is no support for resuming conversations, fault-tolerant state recovery, time travel, or human-in-the-loop interrupts.

## Goal

Replace the bare `createReactAgent` pattern with a `StateGraph` backed by `SqliteSaver`, enabling:

1. **Persistent conversation across restarts** — Graph state is stored in SQLite; resuming a `thread_id` restores the exact checkpoint.
2. **Fault tolerance** — Super-step checkpoints mean partial node failures do not require re-running completed nodes.
3. **Pending writes recovery** — On resume, successful node writes in a failed super-step are re-applied without recomputation.
4. **Time travel & replay** — `getState` and `getStateHistory` let users inspect or replay prior checkpoints.
5. **Human-in-the-loop** — `interrupt()` works through checkpoints for approve/reject flows.

## Architecture

### High-level picture

```
                         config.yaml
                             |
                         loadConfig()
                             |
                +------------+-------------+
                |                          |
         StateGraph               SqliteSaver
   (state schema, nodes,      (SQLite file,
     edges, compiled agent)     thread_id <-> checkpoint tuples)
                |                          |
                +------------+-------------+
                             |
                    graph.invoke()
                    graph.stream()
                    graph.getState()
                    graph.getStateHistory()
```

### File structure

```
src/
├── agent/
│   ├── react.js              # Keep backward-compat wrapper; delegates to graph builder
│   └── state_graph.js        # NEW: StateGraph builder + checkpointer setup
├── session/
│   ├── factory.js            # Adds threadId alongside sessionId
│   ├── stateManager.js       # Minor: use threadId from LangGraph state
│   └── loader.js             # Minor: load thread state from SQLite on resume
├── config/
│   ├── loader.js             # Reads new sqlite: {} config section
│   └── schemas.js            # Zod schema for sqlite section
└── tests/unit/
    ├── agent/state_graph.test.js    # NEW
    ├── session/factory.test.js      # Update for threadId
    └── session/loader.test.js       # NEW: load thread IDs
```

## Changes

### 1. New dependency

**File:** `package.json`

Add `@langchain/langgraph-checkpoint-sqlite` (and its peer `@langchain/langgraph-checkpoint` which it depends on):

```json
"dependencies": {
  "..."
  "@langchain/langgraph-checkpoint-sqlite": "^0.2.0"
}
```

### 2. Config section

**File:** `config.yaml`

Add a `sqlite:` section under the root:

```yaml
sqlite:
  path: memory/checkpoints.db
```

This path can be overridden via `SQLITE_PATH` env var. The default places the database inside the memory directory which is already gitignored.

**File:** `src/config/schemas.js`

Add a Zod schema for the new section:

```javascript
import { z } from "zod/v4";

export const sqliteSchema = z.object({
  path: z.string().default("memory/checkpoints.db"),
});

export type SqliteConfig = z.infer<typeof sqliteSchema>;
```

And wire it into the config merge logic in `loader.js`.

### 3. New module: `src/agent/state_graph.js`

```javascript
import { StateGraph, Annotation } from "@langchain/langgraph";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";

/**
 * Build a StateGraph with SQLite-backed checkpointing.
 * @param {BaseChatModel} model - Chat model instance
 * @param {unknown[]} [tools=[]] - LangGraph tools
 * @param {string} [dbPath="memory/checkpoints.db"] - SQLite file path
 * @returns {{ graph: ReturnType<StateGraph["compile"]>, saver: SqliteSaver }}
 */
export function buildCheckpointedGraph(model, tools = [], dbPath = "memory/checkpoints.db") {
  // Define the state schema using the Annotation API (mirrors the
  // messages channel used by createReactAgent).
  const State = Annotation.Root({
    messages: Annotation({
      reducer: (current, update) => [...current, update],
      default: () => [],
    }),
  });

  const saver = new SqliteSaver(dbPath);

  const graph = new StateGraph(State)
    // The prebuilt ReAct flow can be wired as a single node here, or
    // we can inline the react-agent node from @langchain/langgraph/prebuilt.
    // This is the minimal migration path.
    .addNode("agent", prebuilt.createStructuredToolResponse())
    // ... wiring continues
    ;

  const compiled = graph.compile({ checkpointer: saver });

  return { graph: compiled, saver };
}
```

**Key implementation notes:**

- The `SqliteSaver` constructor takes a single SQLite file path string. LangGraph creates and manages the required tables (`checkpoints`, `checkpoint_blobs`, `checkpoint_writes`, `streams`) automatically on first use.
- Each graph run needs a `configurable: { thread_id: "..." }`. The `thread_id` maps to the user's conversation session.
- The state schema uses `Annotation.Root()` with a `messages` channel that accumulates via the `reducer` pattern so that each message in the conversation history is retained across super-steps.
- The `prebuilt.createReactAgent` nodes are reused as-is; we wrap them in a `StateGraph` so the checkpointer intercepts every super-step boundary.

### 4. Update: `src/agent/react.js`

Refactor `createReactAgent` to delegate to the new `buildCheckpointedGraph` under the hood, preserving the current function signature so `index.js` needs minimal changes:

```javascript
import { buildCheckpointedGraph } from "./state_graph.js";

// Cache the compiled graph per dbPath so we don't re-compile on each call.
const graphCache = new Map();

/**
 * Create a ReAct agent with SQLite persistence.
 * The first invocation initializes the checkpointer; subsequent calls
 * reuse the cached compiled graph.
 * @param {BaseChatModel} model - Chat model instance
 * @param {unknown[]} [tools=[]] - Tools
 * @returns {CompiledStateGraph}
 */
export function createReactAgent(model, tools = []) {
  const dbPath = config.sqlite?.path ?? "memory/checkpoints.db";
  const cacheKey = `${dbPath}:${model.modelName}`;

  if (!graphCache.has(cacheKey)) {
    graphCache.set(cacheKey, buildCheckpointedGraph(model, tools, dbPath));
  }

  return graphCache.get(cacheKey);
}
```

### 5. Update: `src/session/factory.js`

Add a `threadId` to the session state returned by `createSession`. The `threadId` is the LangGraph `thread_id` used by the checkpointer:

```javascript
/**
 * @returns {{ sessionId: string, state: Object, threadId?: string }}
 */
export function createSession(config = {}) {
  const threadId = config.threadId || randomUUID();
  return {
    sessionId: randomUUID(),
    threadId,
    state: { ... },
  };
}
```

### 6. Update: `index.js`

Wire the threadId through to graph invocations:

```javascript
const { sessionId, threadId, state: initialState } = createSession({
  provider: providerName,
  contextWindow: config.session.context_window_size,
});

// Pass thread_id in the config every time we invoke/stream the graph:
const config = { configurable: { thread_id: threadId } };

// Instead of manual sessionState.addExchange(), use graph.getState() to read state.
```

### 7. New module: `src/session/loader.js`

Module that, given a `SqliteSaver` instance, can enumerate active thread IDs so the TUI can show a conversation list:

```javascript
/**
 * List all thread IDs that have checkpoints.
 * @param {import("@langchain/langgraph-checkpoint-sqlite").SqliteSaver} saver
 * @returns {Promise<string[]>}
 */
export async function listThreadIds(saver) {
  const threads = new Set();
  for await (const tuple of saver.list({})) {
    const tid = tuple.config?.configurable?.thread_id;
    if (tid) threads.add(tid);
  }
  return [...threads];
}
```

### 8. New module: `src/session/saver.js` (replace existing)

The current `saver.js` writes flat JSON files. With checkpointing, the JSON file write can become optional (for human-readable export) or be removed entirely. The primary persistence medium is SQLite.

## Thread lifecycle

```
1. User selects a session (or creates a new one)
   └── threadId is assigned or loaded from config
2. Graph invocation
   └── config: { configurable: { thread_id: threadId } }
   └── At each super-step, state snapshot is flushed to SQLite
3. Graph resume
   └── Same threadId -> same thread -> same checkpoint
   └── graph.invoke(..., config) automatically loads last checkpoint
4. Shutdown
   └── saver.flush() is called (or let Node.js exit handle it; SQLite WAL mode is durable)
```

## Config.yaml reference

```yaml
sqlite:
  # Path to the SQLite database file.
  # Defaults to memory/checkpoints.db
  # Override with SQLITE_PATH env var.
  path: memory/checkpoints.db
```

## Tasks

| # | Task | Details |
|---|------|---------|
| 1 | Add `@langchain/langgraph-checkpoint-sqlite` to `package.json` | Install and verify the package |
| 2 | Add `sqlite:` config section to `config.yaml` | Default path: `memory/checkpoints.db` |
| 3 | Update `src/config/schemas.js` | Zod schema for `sqlite` object |
| 4 | Create `src/agent/state_graph.js` | Build `StateGraph` with `SqliteSaver` |
| 5 | Refactor `src/agent/react.js` | Delegate to `buildCheckpointedGraph` with caching |
| 6 | Update `src/session/factory.js` | Add `threadId` to session creation |
| 7 | Update `src/session/loader.js` | Add `listThreadIds()` utility |
| 8 | Update `index.js` | Pass `thread_id` in config on every graph call; switch from `sessionState` to `graph.getState()` |
| 9 | Write tests | `tests/unit/agent/state_graph.test.js`, updated `session/factory.test.js` |
| 10 | Update `src/session/saver.js` | Mark JSON file export as optional/legacy |

## Migration risks

- **State schema mismatch**: The current `createReactAgent` uses an implicit state shape (just `messages` as an array). The `StateGraph` must use the same `messages` channel shape so that existing code accessing `result.messages` still works.
- **Table creation**: `SqliteSaver` creates tables on first `put()`. The TUI must handle the case where `listThreadIds()` is called before any checkpoint exists (returns empty array).
- **Concurrency**: SQLite is single-writer by default. `SqliteSaver` uses WAL mode, so reads are concurrent-safe. Only one graph can write per `thread_id` at a time. If multiple `thread_id` values write concurrently, the WAL journal handles the serialization safely.

## Rollback plan

If the migration encounters issues:
1. Keep the old `createReactAgent` path as a fallback (the `graphCache` can return the old graph on error).
2. The `sqlite:` config section is optional; if absent, the system falls back to the non-persistent `createReactAgent` behavior.
3. No data loss: JSON conversation files are still readable as human fallback even if SQLite is the primary store.
