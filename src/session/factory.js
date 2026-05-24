import { randomUUID } from "node:crypto";

/**
 * Generate a session UUID and create initial session state.
 * @param {Object} [config] - Optional session config override
 * @returns {{ sessionId: string, state: Object }}
 */
export function createSession(config = {}) {
  return {
    sessionId: randomUUID(),
    state: {
      provider: config.provider || "openai",
      conversation: [],
      contextWindow: config.contextWindow || 20,
      skills: config.skills || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}
