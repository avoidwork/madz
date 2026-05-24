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
}
