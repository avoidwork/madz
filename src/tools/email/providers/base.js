/**
 * Abstract email provider interface.
 * All concrete providers (Gmail, Graph, IMAP) extend this.
 */
export class EmailProvider {
	/**
	 * @type {string}
	 */
	name;

	/**
	 * @type {string}
	 */
	type;

	/**
	 * @type {number}
	 */
	timeoutMs;

	/**
	 * @param {object} config - Provider configuration
	 */
	constructor(config) {
		this.name = config.name || "unnamed";
		this.type = config.type || "unknown";
		this.timeoutMs = config.timeoutMs || 30000; // 30s default
	}

	/**
	 * Send an email message.
	 * @param {object} params - Send parameters
	 * @param {string[]} params.to - Recipient addresses
	 * @param {string} params.subject - Email subject
	 * @param {string} params.body - Email body (plain text or HTML)
	 * @param {string} [params.bodyType="text"] - "text" or "html"
	 * @param {string[]} [params.cc] - CC recipients
	 * @param {string[]} [params.bcc] - BCC recipients
	 * @param {Array<{filename: string, content: string, contentType?: string}>} [params.attachments] - Attachments
	 * @returns {Promise<{ ok: boolean, messageId?: string, error?: string }>}
	 */
	async send(_params) {
		throw new Error(`send() not implemented for ${this.type} provider`);
	}

	/**
	 * Read messages from the mailbox.
	 * @param {object} params - Read parameters
	 * @param {string} [params.folder="INBOX"] - Mailbox folder
	 * @param {number} [params.limit=20] - Max messages to return
	 * @param {string} [params.sender] - Filter by sender
	 * @param {string} [params.subject] - Filter by subject keyword
	 * @param {string} [params.keyword] - Filter by body keyword
	 * @param {string} [params.dateFrom] - Filter by date (ISO string)
	 * @param {string} [params.dateTo] - Filter by date (ISO string)
	 * @param {string} [params.label] - Filter by label
	 * @returns {Promise<{ ok: boolean, messages?: object[], error?: string }>}
	 */
	async read(_params = {}) {
		throw new Error(`read() not implemented for ${this.type} provider`);
	}

	/**
	 * Search messages across the mailbox.
	 * @param {object} params - Search parameters
	 * @param {string} params.query - Search query
	 * @param {number} [params.limit=20] - Max results
	 * @returns {Promise<{ ok: boolean, messages?: object[], error?: string }>}
	 */
	async search(_params) {
		throw new Error(`search() not implemented for ${this.type} provider`);
	}

	/**
	 * Save a draft message.
	 * @param {object} params - Draft parameters
	 * @param {string[]} params.to - Recipient addresses
	 * @param {string} params.subject - Draft subject
	 * @param {string} params.body - Draft body
	 * @param {string} [params.bodyType="text"] - "text" or "html"
	 * @returns {Promise<{ ok: boolean, draftId?: string, error?: string }>}
	 */
	async saveDraft(_params) {
		throw new Error(`saveDraft() not implemented for ${this.type} provider`);
	}

	/**
	 * List draft messages.
	 * @param {object} params - List parameters
	 * @param {number} [params.limit=20] - Max drafts
	 * @returns {Promise<{ ok: boolean, drafts?: object[], error?: string }>}
	 */
	async listDrafts(_params = {}) {
		throw new Error(`listDrafts() not implemented for ${this.type} provider`);
	}

	/**
	 * Update an existing draft.
	 * @param {string} draftId - Draft identifier
	 * @param {object} params - Updated draft parameters
	 * @param {string[]} [params.to] - Recipient addresses
	 * @param {string} [params.subject] - Draft subject
	 * @param {string} [params.body] - Draft body
	 * @returns {Promise<{ ok: boolean, draftId?: string, error?: string }>}
	 */
	async updateDraft(_draftId, _params) {
		throw new Error(`updateDraft() not implemented for ${this.type} provider`);
	}

	/**
	 * Delete a draft.
	 * @param {string} draftId - Draft identifier
	 * @returns {Promise<{ ok: boolean, error?: string }>}
	 */
	async deleteDraft(_draftId) {
		throw new Error(`deleteDraft() not implemented for ${this.type} provider`);
	}

	/**
	 * Organize messages (mark read/unread, archive, label).
	 * @param {object} params - Organization parameters
	 * @param {string|string[]} params.messageIds - Message ID(s)
	 * @param {string} params.action - "markRead", "markUnread", "archive", "addLabel", "removeLabel"
	 * @param {string} [params.label] - Label name (for addLabel/removeLabel)
	 * @returns {Promise<{ ok: boolean, error?: string }>}
	 */
	async organize(_params) {
		throw new Error(`organize() not implemented for ${this.type} provider`);
	}

	/**
	 * Validate provider configuration.
	 * @returns {{ valid: boolean, errors?: string[] }}
	 */
	validateConfig() {
		return { valid: true };
	}
}
