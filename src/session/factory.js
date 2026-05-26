import { randomUUID } from "node:crypto";

/**
 * Generate session UUIDs and create initial session state, including
 * a `threadId` for LangGraph checkpointing.
 * @param {Object} [config] - Optional session config override
 * @returns {{ sessionId: string, threadId: string, state: Object }}
 */
export function createSession(config = {}) {
	const sessionId = randomUUID();
	return {
		sessionId,
		threadId: config.threadId || sessionId,
		state: {
			provider: config.provider || "openai",
			conversation: [],
			contextWindow: config.contextWindow || 20,
			skills: config.skills || [],
		},
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};
}
