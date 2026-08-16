import { google } from "googleapis";
import { EmailProvider } from "./base.js";

/**
 * Gmail API provider implementation.
 * Uses OAuth2 service account or user credentials via googleapis.
 */
export class GmailProvider extends EmailProvider {
	/**
	 * @type {import('googleapis').google}
	 */
	#gmail;

	/**
	 * @type {string}
	 */
	#userId;

	/**
	 * @param {object} config - Gmail provider configuration
	 * @param {string} config.clientId - OAuth2 client ID
	 * @param {string} config.clientSecret - OAuth2 client secret
	 * @param {string} config.refreshToken - OAuth2 refresh token
	 * @param {string} [config.accessToken] - Current access token (optional)
	 * @param {string} [config.userId] - Gmail user ID (default: "me")
	 * @param {string} [config.name] - Provider name
	 */
	constructor(config) {
		super({ ...config, type: "gmail" });

		const oauth2Client = new google.auth.OAuth2({
			clientId: config.clientId,
			clientSecret: config.clientSecret,
			redirectUri: "http://localhost",
		});

		if (config.refreshToken) {
			oauth2Client.setCredentials({ refresh_token: config.refreshToken });
		}
		if (config.accessToken) {
			oauth2Client.setCredentials({ access_token: config.accessToken });
		}

		this.#gmail = google.gmail({ version: "v1", auth: oauth2Client });
		this.#userId = config.userId || "me";
	}

	/**
	 * @param {object} params - Send parameters
	 * @returns {Promise<{ ok: boolean, messageId?: string, error?: string }>}
	 */
	async send(params) {
		try {
			const message = this.#buildRawMessage(params);
			const response = await this.#gmail.users.messages.send({
				userId: this.#userId,
				resource: {
					raw: message,
				},
			});
			return {
				ok: true,
				messageId: response.data?.id || response.data?.message?.id,
			};
		} catch (err) {
			return { ok: false, error: `Gmail send failed: ${err.message}` };
		}
	}

	/**
	 * @param {object} params - Read parameters
	 * @returns {Promise<{ ok: boolean, messages?: object[], error?: string }>}
	 */
	async read(params = {}) {
		try {
			const { folder = "INBOX", limit = 20, ...filters } = params;
			const labelIds = folder === "INBOX" ? ["INBOX"] : [folder];

			let query = "";
			if (filters.sender) query += `from:${filters.sender} `;
			if (filters.subject) query += `subject:${filters.subject} `;
			if (filters.keyword) query += `${filters.keyword} `;
			if (filters.dateFrom) query += `after:${filters.dateFrom} `;
			if (filters.dateTo) query += `before:${filters.dateTo} `;
			if (filters.label) query += `label:${filters.label} `;

			const response = await this.#gmail.users.messages.list({
				userId: this.#userId,
				labelIds,
				maxResults: limit,
				q: query.trim() || undefined,
			});

			const messages = response.data.messages || [];
			const result = [];

			for (const msg of messages) {
				const detail = await this.#gmail.users.messages.get({
					userId: this.#userId,
					id: msg.id,
					format: "full",
				});
				result.push(this.#normalizeMessage(detail.data));
			}

			return { ok: true, messages: result };
		} catch (err) {
			return { ok: false, error: `Gmail read failed: ${err.message}` };
		}
	}

	/**
	 * @param {object} params - Search parameters
	 * @returns {Promise<{ ok: boolean, messages?: object[], error?: string }>}
	 */
	async search(params) {
		try {
			const response = await this.#gmail.users.messages.list({
				userId: this.#userId,
				q: params.query,
				maxResults: params.limit || 20,
			});

			const messages = response.data.messages || [];
			const result = [];

			for (const msg of messages) {
				const detail = await this.#gmail.users.messages.get({
					userId: this.#userId,
					id: msg.id,
					format: "full",
				});
				result.push(this.#normalizeMessage(detail.data));
			}

			return { ok: true, messages: result };
		} catch (err) {
			return { ok: false, error: `Gmail search failed: ${err.message}` };
		}
	}

	/**
	 * @param {object} params - Draft parameters
	 * @returns {Promise<{ ok: boolean, draftId?: string, error?: string }>}
	 */
	async saveDraft(params) {
		try {
			const message = this.#buildRawMessage(params);
			const response = await this.#gmail.users.drafts.create({
				userId: this.#userId,
				resource: {
					message: { raw: message },
				},
			});
			return { ok: true, draftId: response.data.id };
		} catch (err) {
			return { ok: false, error: `Gmail saveDraft failed: ${err.message}` };
		}
	}

	/**
	 * @param {object} params - List parameters
	 * @returns {Promise<{ ok: boolean, drafts?: object[], error?: string }>}
	 */
	async listDrafts(params = {}) {
		try {
			const response = await this.#gmail.users.drafts.list({
				userId: this.#userId,
				maxResults: params.limit || 20,
			});

			const drafts = response.data.drafts || [];
			const result = [];

			for (const draft of drafts) {
				const detail = await this.#gmail.users.drafts.get({
					userId: this.#userId,
					id: draft.id,
				});
				result.push({ id: draft.id, ...this.#normalizeMessage(detail.data.message) });
			}

			return { ok: true, drafts: result };
		} catch (err) {
			return { ok: false, error: `Gmail listDrafts failed: ${err.message}` };
		}
	}

	/**
	 * @param {string} draftId - Draft identifier
	 * @param {object} params - Updated draft parameters
	 * @returns {Promise<{ ok: boolean, draftId?: string, error?: string }>}
	 */
	async updateDraft(draftId, params) {
		try {
			const message = this.#buildRawMessage(params);
			await this.#gmail.users.drafts.update({
				userId: this.#userId,
				id: draftId,
				resource: {
					message: { raw: message },
				},
			});
			return { ok: true, draftId };
		} catch (err) {
			return { ok: false, error: `Gmail updateDraft failed: ${err.message}` };
		}
	}

	/**
	 * @param {string} draftId - Draft identifier
	 * @returns {Promise<{ ok: boolean, error?: string }>}
	 */
	async deleteDraft(draftId) {
		try {
			await this.#gmail.users.drafts.delete({
				userId: this.#userId,
				id: draftId,
			});
			return { ok: true };
		} catch (err) {
			return { ok: false, error: `Gmail deleteDraft failed: ${err.message}` };
		}
	}

	/**
	 * @param {object} params - Organization parameters
	 * @returns {Promise<{ ok: boolean, error?: string }>}
	 */
	async organize(params) {
		try {
			const messageIds = Array.isArray(params.messageIds) ? params.messageIds : [params.messageIds];

			switch (params.action) {
				case "markRead":
				case "markUnread": {
					const modifyRequest = {
						removeLabelIds: params.action === "markRead" ? ["UNREAD"] : [],
						addLabelIds: params.action === "markUnread" ? ["UNREAD"] : [],
					};
					for (const id of messageIds) {
						await this.#gmail.users.messages.modify({
							userId: this.#userId,
							id,
							resource: modifyRequest,
						});
					}
					break;
				}
				case "archive": {
					const modifyRequest = { removeLabelIds: ["INBOX", "CATEGORY_UPDATES", "CATEGORY_SOCIAL", "CATEGORY_PROMOTIONS", "CATEGORY_UPDATES", "CATEGORY_FORUMS"] };
					for (const id of messageIds) {
						await this.#gmail.users.messages.modify({
							userId: this.#userId,
							id,
							resource: modifyRequest,
						});
					}
					break;
				}
				case "addLabel": {
					for (const id of messageIds) {
						await this.#gmail.users.messages.modify({
							userId: this.#userId,
							id,
							resource: { addLabelIds: [params.label] },
						});
					}
					break;
				}
				case "removeLabel": {
					for (const id of messageIds) {
						await this.#gmail.users.messages.modify({
							userId: this.#userId,
							id,
							resource: { removeLabelIds: [params.label] },
						});
					}
					break;
				}
				default:
					return { ok: false, error: `Unknown organize action: ${params.action}` };
			}

			return { ok: true };
		} catch (err) {
			return { ok: false, error: `Gmail organize failed: ${err.message}` };
		}
	}

	/**
	 * Build a raw MIME message from params.
	 * @param {object} params - Message parameters
	 * @returns {string} Base64 encoded MIME message
	 */
	#buildRawMessage(params) {
		const { to, subject, body, bodyType = "text", cc = [], bcc = [], attachments = [] } = params;

		let mime = `From: madz\r\nTo: ${to.join(", ")}\r\n`;
		if (cc.length) mime += `Cc: ${cc.join(", ")}\r\n`;
		if (bcc.length) mime += `Bcc: ${bcc.join(", ")}\r\n`;
		mime += `Subject: ${subject}\r\n`;
		mime += `MIME-Version: 1.0\r\n`;

		if (attachments.length > 0) {
			const boundary = `boundary_${Date.now()}`;
			mime += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
			mime += `--${boundary}\r\n`;
			mime += `Content-Type: ${bodyType === "html" ? "text/html" : "text/plain"}; charset="UTF-8"\r\n\r\n`;
			mime += `${body}\r\n`;

			for (const attachment of attachments) {
				const contentType = attachment.contentType || "application/octet-stream";
				mime += `--${boundary}\r\n`;
				mime += `Content-Type: ${contentType}; name="${attachment.filename}"\r\n`;
				mime += `Content-Transfer-Encoding: base64\r\n`;
				mime += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n\r\n`;
				mime += `${attachment.content}\r\n`;
			}
			mime += `--${boundary}--\r\n`;
		} else {
			mime += `Content-Type: ${bodyType === "html" ? "text/html" : "text/plain"}; charset="UTF-8"\r\n\r\n`;
			mime += `${body}\r\n`;
		}

		return Buffer.from(mime).toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
	}

	/**
	 * Normalize a Gmail message to a standard format.
	 * @param {object} message - Gmail message object
	 * @returns {object} Normalized message
	 */
	#normalizeMessage(message) {
		if (!message) return {};

		const headers = {};
		const payload = message.payload || {};

		if (payload.headers) {
			for (const h of payload.headers) {
				headers[h.name.toLowerCase()] = h.value;
			}
		}

		let body = "";
		if (payload.parts) {
			for (const part of payload.parts) {
				if (part.mimeType === "text/plain" && part.body?.data) {
					body = Buffer.from(part.body.data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
					break;
				}
				if (part.mimeType === "text/html" && part.body?.data && !body) {
					body = Buffer.from(part.body.data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
				}
			}
		} else if (payload.body?.data) {
			body = Buffer.from(payload.body.data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
		}

		return {
			id: message.id,
			threadId: message.threadId,
			from: headers["from"] || "",
			to: headers["to"] || "",
			subject: headers["subject"] || "(no subject)",
			date: headers["date"] || "",
			body,
			labelIds: message.labelIds || [],
			snippet: message.snippet || "",
		};
	}
}