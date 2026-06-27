import { randomUUID } from "node:crypto";

/**
 * Session state manager that tracks active provider, context window size, and skill context.
 */
export class SessionStateManager {
	#state;

	/**
	 * Create a new session state manager.
	 * @param {Object} initialState - The initial session state
	 */
	constructor(initialState) {
		this.#state = {
			provider: "openai",
			conversation: [],
			contextWindow: 20,
			skills: [],
			...initialState,
			createdAt: initialState.createdAt || new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};
	}

	/**
	 * Get the current provider.
	 * @returns {string}
	 */
	getProvider() {
		return this.#state.provider;
	}

	/**
	 * Set the active provider.
	 * @param {string} provider - Provider name (e.g., "openai", "local")
	 */
	setProvider(provider) {
		this.#state.provider = provider;
		this.#state.updatedAt = new Date().toISOString();
	}

	/**
	 * Get the conversation history.
	 * @returns {Array}
	 */
	getConversation() {
		return this.#state.conversation;
	}

	/**
	 * Add a message exchange to the conversation.
	 * @param {{ role: string, content: string }} exchange - Message exchange
	 */
	addExchange(exchange) {
		this.#state.conversation.push({
			...exchange,
			timestamp: new Date().toISOString(),
		});
		this.#state.updatedAt = new Date().toISOString();
	}

	/**
	 * Remove the last exchange from the conversation (used on abort).
	 * @returns {{ role: string, content: string, timestamp: string } | undefined}
	 */
	popExchange() {
		const removed = this.#state.conversation.pop();
		if (removed) {
			this.#state.updatedAt = new Date().toISOString();
		}
		return removed;
	}

	/**
	 * Remove the last assistant message with tool_calls from the conversation.
	 * Used during interrupt cleanup to remove orphaned tool-call messages.
	 * This method is idempotent — safe to call when no matching message exists.
	 * @returns {{ role: string, content: string, timestamp: string } | undefined} The removed message, or undefined if no matching message was found.
	 */
	removeLastAssistantToolCallMessage() {
		const lastMessage = this.#state.conversation[this.#state.conversation.length - 1];
		if (lastMessage && lastMessage.role === "assistant" && this.#hasToolCalls(lastMessage)) {
			const removed = this.#state.conversation.pop();
			this.#state.updatedAt = new Date().toISOString();
			return removed;
		}
		return undefined;
	}

	/**
	 * Check if a message contains tool calls.
	 * @param {{ role: string, content: string | object }} message - The message to check.
	 * @returns {boolean} True if the message has tool_calls.
	 */
	#hasToolCalls(message) {
		if (typeof message.content === "object" && message.content !== null) {
			return Array.isArray(message.content.tool_calls) && message.content.tool_calls.length > 0;
		}
		return false;
	}

	/**
	 * Get the active skills list.
	 * @returns {string[]}
	 */
	getSkills() {
		return this.#state.skills;
	}

	/**
	 * Register a skill for this session.
	 * @param {string} skillName
	 */
	registerSkill(skillName) {
		if (!this.#state.skills.includes(skillName)) {
			this.#state.skills.push(skillName);
		}
		this.#state.updatedAt = new Date().toISOString();
	}

	/**
	 * Get the context window size.
	 * @returns {number}
	 */
	getContextWindow() {
		return this.#state.contextWindow;
	}

	/**
	 * Set the context window size.
	 * @param {number} size
	 */
	setContextWindow(size) {
		this.#state.contextWindow = Math.max(1, Math.floor(size));
		this.#state.updatedAt = new Date().toISOString();
	}

	/**
	 * Get a serializable copy of the session state.
	 * @returns {Object}
	 */
	getState() {
		return {
			...this.#state,
			conversation: [...this.#state.conversation],
			skills: [...this.#state.skills],
		};
	}

	/**
	 * Get the current thread ID used by the checkpointer.
	 * @returns {string}
	 */
	getThreadId() {
		return this.#state.threadId || this.#state.provider;
	}

	/**
	 * Set the thread ID for the checkpointer.
	 * @param {string} threadId - The thread ID (e.g., UUID for new sessions)
	 */
	setThreadId(threadId) {
		this.#state.threadId = threadId;
		this.#state.updatedAt = new Date().toISOString();
	}

	/**
	 * Create a completely new session: generate new UUID, clear conversation, reset skills, keep provider.
	 * @param {string} [newThreadId] - Optional thread ID override
	 * @returns {{ sessionId: string }}
	 */
	createNewSession(newThreadId) {
		const sessionId = newThreadId || randomUUID();
		this.setThreadId(sessionId);
		this.#state.conversation = [];
		this.#state.skills = [];
		this.#state.updatedAt = new Date().toISOString();
		return { sessionId };
	}
}
