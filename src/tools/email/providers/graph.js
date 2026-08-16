import { EmailProvider } from "./base.js";

/**
 * Microsoft Graph API provider implementation.
 * Uses OAuth2 access tokens for authentication.
 */
export class GraphProvider extends EmailProvider {
	/**
	 * @type {string}
	 */
	#userId;

	/**
	 * @type {object}
	 */
	#credentials;

	/**
	 * @type {string|null}
	 */
	#accessToken = null;

	/**
	 * @param {object} config - Graph provider configuration
	 * @param {string} config.clientId - OAuth2 client ID
	 * @param {string} config.clientSecret - OAuth2 client secret
	 * @param {string} config.refreshToken - OAuth2 refresh token
	 * @param {string} config.tenantId - Azure AD tenant ID
	 * @param {string} [config.accessToken] - Current access token (optional)
	 * @param {string} [config.userId] - User email (default: "me")
	 * @param {string} [config.name] - Provider name
	 */
	constructor(config) {
		super({ ...config, type: "graph" });

		this.#userId = config.userId || "me";
		this.#credentials = {
			clientId: config.clientId,
			clientSecret: config.clientSecret,
			refreshToken: config.refreshToken,
			tenantId: config.tenantId,
		};

		if (config.accessToken) {
			this.#accessToken = config.accessToken;
		}
	}

	/**
	 * Get or refresh an access token.
	 * @returns {Promise<string>}
	 */
	async #getAccessToken() {
		if (this.#accessToken) {
			return this.#accessToken;
		}

		if (!this.#credentials.refreshToken) {
			throw new Error("No refresh token available for Graph provider");
		}

		const response = await fetch(
			`https://login.microsoftonline.com/${this.#credentials.tenantId}/oauth2/v2.0/token`,
			{
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					client_id: this.#credentials.clientId,
					client_secret: this.#credentials.clientSecret,
					refresh_token: this.#credentials.refreshToken,
					grant_type: "refresh_token",
					scope: "https://graph.microsoft.com/.default",
				}),
			},
		);

		if (!response.ok) {
			throw new Error(`Graph token refresh failed: ${response.status}`);
		}

		const data = await response.json();
		this.#accessToken = data.access_token;
		return this.#accessToken;
	}

	/**
	 * @param {object} params - Send parameters
	 * @returns {Promise<{ ok: boolean, messageId?: string, error?: string }>}
	 */
	async send(params) {
		try {
			const token = await this.#getAccessToken();

			const message = {
				subject: params.subject,
				body: {
					contentType: params.bodyType === "html" ? "HTML" : "Text",
					content: params.body,
				},
				toRecipients: params.to.map((addr) => ({ emailAddress: { address: addr } })),
			};

			if (params.cc && params.cc.length > 0) {
				message.ccRecipients = params.cc.map((addr) => ({
					emailAddress: { address: addr },
				}));
			}

			if (params.bcc && params.bcc.length > 0) {
				message.bccRecipients = params.bcc.map((addr) => ({
					emailAddress: { address: addr },
				}));
			}

			if (params.attachments && params.attachments.length > 0) {
				message.attachments = params.attachments.map((att) => ({
					"@odata.type": "#microsoft.graph.fileAttachment",
					name: att.filename,
					contentBytes: att.content,
					contentType: att.contentType || "application/octet-stream",
				}));
			}

			const response = await fetch(
				`https://graph.microsoft.com/v1.0/users/${this.#userId}/sendMail`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ message, saveToSentItems: true }),
				},
			);

			if (!response.ok) {
				const errBody = await response.text();
				return { ok: false, error: `Graph send failed (${response.status}): ${errBody}` };
			}

			const data = await response.json();
			return { ok: true, messageId: data?.id };
		} catch (err) {
			return { ok: false, error: `Graph send failed: ${err.message}` };
		}
	}

	/**
	 * @param {object} params - Read parameters
	 * @returns {Promise<{ ok: boolean, messages?: object[], error?: string }>}
	 */
	async read(params = {}) {
		try {
			const token = await this.#getAccessToken();
			const { folder = "inbox", limit = 20, ...filters } = params;

			let url = `https://graph.microsoft.com/v1.0/users/${this.#userId}/${folder}/messages?$top=${limit}&$select=id,subject,from,toRecipients,body,receivedDateTime,bodyPreview`;

			const filtersList = [];
			if (filters.sender) filtersList.push(`from/emailAddress/address eq '${filters.sender}'`);
			if (filters.subject) filtersList.push(`contains(subject, '${filters.subject}')`);
			if (filters.keyword) filtersList.push(`contains(body/content, '${filters.keyword}')`);
			if (filters.dateFrom) filtersList.push(`receivedDateTime ge ${filters.dateFrom}`);
			if (filters.dateTo) filtersList.push(`receivedDateTime le ${filters.dateTo}`);

			if (filtersList.length > 0) {
				url += `&$filter=${filtersList.join(" and ")}`;
			}

			const response = await fetch(url, {
				headers: { Authorization: `Bearer ${token}` },
			});

			if (!response.ok) {
				return { ok: false, error: `Graph read failed (${response.status})` };
			}

			const data = await response.json();
			const messages = data.value || [];
			const result = messages.map((m) => this.#normalizeMessage(m));

			return { ok: true, messages: result };
		} catch (err) {
			return { ok: false, error: `Graph read failed: ${err.message}` };
		}
	}

	/**
	 * @param {object} params - Search parameters
	 * @returns {Promise<{ ok: boolean, messages?: object[], error?: string }>}
	 */
	async search(params) {
		try {
			const token = await this.#getAccessToken();

			const response = await fetch(
				`https://graph.microsoft.com/v1.0/users/${this.#userId}/messages?$q=${encodeURIComponent(params.query)}&$top=${params.limit || 20}&$select=id,subject,from,toRecipients,body,receivedDateTime`,
				{
					headers: { Authorization: `Bearer ${token}` },
				},
			);

			if (!response.ok) {
				return { ok: false, error: `Graph search failed (${response.status})` };
			}

			const data = await response.json();
			const messages = data.value || [];
			const result = messages.map((m) => this.#normalizeMessage(m));

			return { ok: true, messages: result };
		} catch (err) {
			return { ok: false, error: `Graph search failed: ${err.message}` };
		}
	}

	/**
	 * @param {object} params - Draft parameters
	 * @returns {Promise<{ ok: boolean, draftId?: string, error?: string }>}
	 */
	async saveDraft(params) {
		try {
			const token = await this.#getAccessToken();

			const message = {
				subject: params.subject,
				body: {
					contentType: params.bodyType === "html" ? "HTML" : "Text",
					content: params.body,
				},
				toRecipients: params.to.map((addr) => ({ emailAddress: { address: addr } })),
			};

			const response = await fetch(
				`https://graph.microsoft.com/v1.0/users/${this.#userId}/messages/drafts`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify(message),
				},
			);

			if (!response.ok) {
				return { ok: false, error: `Graph saveDraft failed (${response.status})` };
			}

			const data = await response.json();
			return { ok: true, draftId: data.id };
		} catch (err) {
			return { ok: false, error: `Graph saveDraft failed: ${err.message}` };
		}
	}

	/**
	 * @param {object} params - List parameters
	 * @returns {Promise<{ ok: boolean, drafts?: object[], error?: string }>}
	 */
	async listDrafts(params = {}) {
		try {
			const token = await this.#getAccessToken();

			const response = await fetch(
				`https://graph.microsoft.com/v1.0/users/${this.#userId}/messages/drafts?$top=${params.limit || 20}&$select=id,subject,from,body,receivedDateTime`,
				{
					headers: { Authorization: `Bearer ${token}` },
				},
			);

			if (!response.ok) {
				return { ok: false, error: `Graph listDrafts failed (${response.status})` };
			}

			const data = await response.json();
			const drafts = data.value || [];
			const result = drafts.map((d) => this.#normalizeMessage(d));

			return { ok: true, drafts: result };
		} catch (err) {
			return { ok: false, error: `Graph listDrafts failed: ${err.message}` };
		}
	}

	/**
	 * @param {string} draftId - Draft identifier
	 * @param {object} params - Updated draft parameters
	 * @returns {Promise<{ ok: boolean, draftId?: string, error?: string }>}
	 */
	async updateDraft(draftId, params) {
		try {
			const token = await this.#getAccessToken();

			const message = {
				subject: params.subject,
				body: {
					contentType: params.bodyType === "html" ? "HTML" : "Text",
					content: params.body,
				},
				toRecipients: params.to?.map((addr) => ({ emailAddress: { address: addr } })),
			};

			const response = await fetch(
				`https://graph.microsoft.com/v1.0/users/${this.#userId}/messages/drafts/${draftId}`,
				{
					method: "PATCH",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify(message),
				},
			);

			if (!response.ok) {
				return { ok: false, error: `Graph updateDraft failed (${response.status})` };
			}

			return { ok: true, draftId };
		} catch (err) {
			return { ok: false, error: `Graph updateDraft failed: ${err.message}` };
		}
	}

	/**
	 * @param {string} draftId - Draft identifier
	 * @returns {Promise<{ ok: boolean, error?: string }>}
	 */
	async deleteDraft(draftId) {
		try {
			const token = await this.#getAccessToken();

			const response = await fetch(
				`https://graph.microsoft.com/v1.0/users/${this.#userId}/messages/drafts/${draftId}`,
				{
					method: "DELETE",
					headers: { Authorization: `Bearer ${token}` },
				},
			);

			if (!response.ok) {
				return { ok: false, error: `Graph deleteDraft failed (${response.status})` };
			}

			return { ok: true };
		} catch (err) {
			return { ok: false, error: `Graph deleteDraft failed: ${err.message}` };
		}
	}

	/**
	 * @param {object} params - Organization parameters
	 * @returns {Promise<{ ok: boolean, error?: string }>}
	 */
	async organize(params) {
		try {
			const token = await this.#getAccessToken();
			const messageIds = Array.isArray(params.messageIds) ? params.messageIds : [params.messageIds];

			switch (params.action) {
				case "markRead": {
					// Graph doesn't have a direct "mark read" — set flag to clean
					for (const id of messageIds) {
						await fetch(`https://graph.microsoft.com/v1.0/users/${this.#userId}/messages/${id}`, {
							method: "PATCH",
							headers: {
								Authorization: `Bearer ${token}`,
								"Content-Type": "application/json",
							},
							body: JSON.stringify({ Flag: { flagStatus: "clean" } }),
						});
					}
					break;
				}
				case "markUnread": {
					for (const id of messageIds) {
						await fetch(`https://graph.microsoft.com/v1.0/users/${this.#userId}/messages/${id}`, {
							method: "PATCH",
							headers: {
								Authorization: `Bearer ${token}`,
								"Content-Type": "application/json",
							},
							body: JSON.stringify({ Flag: { flagStatus: "flagged" } }),
						});
					}
					break;
				}
				case "archive": {
					for (const id of messageIds) {
						await fetch(
							`https://graph.microsoft.com/v1.0/users/${this.#userId}/messages/${id}/move`,
							{
								method: "POST",
								headers: {
									Authorization: `Bearer ${token}`,
									"Content-Type": "application/json",
								},
								body: JSON.stringify({ destinationId: "deletedmessages" }),
							},
						);
					}
					break;
				}
				case "addLabel": {
					// Graph uses categories for labels
					for (const id of messageIds) {
						await fetch(`https://graph.microsoft.com/v1.0/users/${this.#userId}/messages/${id}`, {
							method: "PATCH",
							headers: {
								Authorization: `Bearer ${token}`,
								"Content-Type": "application/json",
							},
							body: JSON.stringify({ categories: [...(params.categories || []), params.label] }),
						});
					}
					break;
				}
				case "removeLabel": {
					for (const id of messageIds) {
						await fetch(`https://graph.microsoft.com/v1.0/users/${this.#userId}/messages/${id}`, {
							method: "PATCH",
							headers: {
								Authorization: `Bearer ${token}`,
								"Content-Type": "application/json",
							},
							body: JSON.stringify({
								categories: (params.categories || []).filter((l) => l !== params.label),
							}),
						});
					}
					break;
				}
				default:
					return { ok: false, error: `Unknown organize action: ${params.action}` };
			}

			return { ok: true };
		} catch (err) {
			return { ok: false, error: `Graph organize failed: ${err.message}` };
		}
	}

	/**
	 * Normalize a Graph message to a standard format.
	 * @param {object} message - Graph message object
	 * @returns {object} Normalized message
	 */
	#normalizeMessage(message) {
		if (!message) return {};

		const from = message.from?.emailAddress?.address || "";
		const to = message.toRecipients?.map((r) => r.emailAddress.address).join(", ") || "";
		const subject = message.subject || "(no subject)";

		let body = "";
		if (message.body?.content) {
			body = message.body.content;
		}

		return {
			id: message.id,
			subject,
			from,
			to,
			body,
			date: message.receivedDateTime || "",
			bodyPreview: message.bodyPreview || "",
		};
	}
}
