import { createReactAgent as createReactAgentPrebuilt } from "@langchain/langgraph/prebuilt";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";

const DEFAULT_DB_PATH = "memory/checkpoints.db";

/**
 * Build a ReAct agent with SQLite-backed checkpoint persistence.
 * Wraps the prebuilt createReactAgent with a SqliteSaver checkpointer
 * so that graph state is persisted at every super-step boundary.
 *
 * @param {import("@langchain/core").BaseChatModel} model - Chat language model instance
 * @param {unknown[]} [tools=[]] - LangGraph tools to attach to the agent
 * @param {string} [dbPath] - SQLite database file path (defaults to "memory/checkpoints.db")
 * @returns {import("@langchain/langgraph").CompiledStateGraph} A compiled ReAct agent with SQLite checkpointer
 */
export function buildCheckpointedGraph(model, tools = [], dbPath = DEFAULT_DB_PATH) {
	const checkpointer = new SqliteSaver(dbPath);

	return createReactAgentPrebuilt({
		llm: model,
		tools,
		checkpointer,
	});
}
