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
	 * @type {AbortController|null}
	 */
	#currentAbort = null;

	/**
	 * @param {object} config - Graph provider configuration
	 * @param {string} [config.userId] - User email (default: "me")
	 * @param {string} [config.name] - Provider name
	 */
	constructor(config) {
		super({ ...config, type: "graph" });

		// Credentials from env vars only — never from config
		const clientId = process.env.EMAIL_GRAPH_CLIENT_ID;
		const clientSecret = process.env.EMAIL_GRAPH_CLIENT_SECRET;
		const refreshToken = process.env.EMAIL_GRAPH_REFRESH_TOKEN;
		const accessToken = process.env.EMAIL_GRAPH_ACCESS_TOKEN;
		const tenantId = process.env.EMAIL_GRAPH_TENANT_ID;

		if (!clientId || !clientSecret || !refreshToken || !tenantId) {
			throw new Error(
				"Graph provider requires EMAIL_GRAPH_CLIENT_ID, EMAIL_GRAPH_CLIENT_SECRET, EMAIL_GRAPH_REFRESH_TOKEN, and EMAIL_GRAPH_TENANT_ID env vars",
			);
		}

		this.#userId = config.userId || "me";
		this.#credentials = {
			clientId,
			clientSecret,
			refreshToken,
			tenantId,
		};

		if (accessToken) {
			this.#accessToken = accessToken;
		}
	}

	/**
	 * Validate provider configuration by checking required env vars.
	 * @returns {{ valid: boolean, errors?: string[] }}
	 */
	validateConfig() {
		const errors = [];
		if (!process.env.EMAIL_GRAPH_CLIENT_ID) errors.push("EMAIL_GRAPH_CLIENT_ID is required");
		if (!process.env.EMAIL_GRAPH_CLIENT_SECRET)
			errors.push("EMAIL_GRAPH_CLIENT_SECRET is required");
		if (!process.env.EMAIL_GRAPH_REFRESH_TOKEN)
			errors.push("EMAIL_GRAPH_REFRESH_TOKEN is required");
		if (!process.env.EMAIL_GRAPH_TENANT_ID) errors.push("EMAIL_GRAPH_TENANT_ID is required");
		return { valid: errors.length === 0, errors };
	}

	/**
	 * Cancel any in-flight request.
	 */
	cancel() {
		if (this.#currentAbort) {
			this.#currentAbort.abort();
			this.#currentAbort = null;
		}
	}

	/**
	 * Sanitize error messages to prevent credential leakage.
	 * Strips client IDs, tokens, and other sensitive data from error strings.
	 * @param {string} message - Raw error message
	 * @returns {string} Sanitized message
	 */
	#sanitizeError(message) {
		if (!message) return "An error occurred";
		return message
			.replace(/client_id=[^&\s]*/g, "client_id=[REDACTED]")
			.replace(/client_secret=[^&\s]*/g, "client_secret=[REDACTED]")
			.replace(/access_token=[^&\s]*/g, "access_token=[REDACTED]")
			.replace(/refresh_token=[^&\s]*/g, "refresh_token=[REDACTED]")
			.replace(/Bearer [^"'\s]*/g, "Bearer [REDACTED]");
	}

	/**
	 * Execute a fetch with timeout and automatic token refresh on 401.
	 * @param {string} url
	 * @param {object} options
	 * @returns {Promise<Response>}
	 */
	async #fetchWithTimeout(url, options) {
		if (this.#currentAbort) {
			this.#currentAbort.abort();
		}
		const controller = new AbortController();
		this.#currentAbort = controller;
		const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

		try {
			const response = await fetch(url, { ...options, signal: controller.signal });

			// On 401, try refreshing the token and retry once
			if (!response.ok && response.status === 401) {
				try {
					await this.#refreshAccessToken();
					// Rebuild the request with the new token
					const newHeaders = { ...options.headers };
					if (newHeaders.Authorization) {
						newHeaders.Authorization = `Bearer ${this.#accessToken}`;
					}
					const retryResponse = await fetch(url, {
						...options,
						signal: controller.signal,
						headers: newHeaders,
					});
					return retryResponse;
				} catch {
					// Token refresh failed — return the original 401 response
				}
			}

			return response;
		} finally {
			clearTimeout(timeoutId);
			this.#currentAbort = null;
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

		const response = await this.#fetchWithTimeout(
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
	 * Refresh the OAuth2 access token.
	 * @returns {Promise<string>} New access token
	 */
	async #refreshAccessToken() {
		if (!this.#credentials.refreshToken) {
			throw new Error("No refresh token available for Graph provider");
		}

		const response = await this.#fetchWithTimeout(
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
				toRecipients: params.to?.map((addr) => ({ emailAddress: { address: addr } })) || [],
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

			const response = await this.#fetchWithTimeout(
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
			return { ok: false, error: `Graph send failed: ${this.#sanitizeError(err.message)}` };
		}
	}

	/**
	 * @param {object} params - Read parameters
	 * @returns {Promise<{ ok: boolean, messages?: object[], error?: string }>}
	 */
	async read(params = {}) {
		try {
			const token = await this.#getAccessToken();
			const { folder = "INBOX", limit = 20, ...filters } = params;

			let url = `https://graph.microsoft.com/v1.0/users/${this.#userId}/${folder}/messages?$top=${limit}&$select=id,subject,from,toRecipients,body,receivedDateTime,bodyPreview`;

			const filtersList = [];
			if (filters.sender) {
				const escapedSender = filters.sender.replace(/'/g, "''");
				filtersList.push(`from/emailAddress/address eq '${escapedSender}'`);
			}
			if (filters.subject) {
				const escapedSubject = filters.subject.replace(/'/g, "''");
				filtersList.push(`contains(subject, '${escapedSubject}')`);
			}
			if (filters.keyword) {
				const escapedKeyword = filters.keyword.replace(/'/g, "''");
				filtersList.push(`contains(body/content, '${escapedKeyword}')`);
			}
			if (filters.dateFrom) filtersList.push(`receivedDateTime ge ${filters.dateFrom}`);
			if (filters.dateTo) filtersList.push(`receivedDateTime le ${filters.dateTo}`);

			if (filtersList.length > 0) {
				url += `&$filter=${filtersList.join(" and ")}`;
			}

			const response = await this.#fetchWithTimeout(url, {
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

			const response = await this.#fetchWithTimeout(
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
				toRecipients: params.to?.map((addr) => ({ emailAddress: { address: addr } })) || [],
			};

			const response = await this.#fetchWithTimeout(
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

			const response = await this.#fetchWithTimeout(
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
				toRecipients: params.to?.map((addr) => ({ emailAddress: { address: addr } })) || [],
			};

			const response = await this.#fetchWithTimeout(
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

			const response = await this.#fetchWithTimeout(
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
						await this.#fetchWithTimeout(
							`https://graph.microsoft.com/v1.0/users/${this.#userId}/messages/${id}`,
							{
								method: "PATCH",
								headers: {
									Authorization: `Bearer ${token}`,
									"Content-Type": "application/json",
								},
								body: JSON.stringify({ Flag: { flagStatus: "clean" } }),
							},
						);
					}
					break;
				}
				case "markUnread": {
					for (const id of messageIds) {
						await this.#fetchWithTimeout(
							`https://graph.microsoft.com/v1.0/users/${this.#userId}/messages/${id}`,
							{
								method: "PATCH",
								headers: {
									Authorization: `Bearer ${token}`,
									"Content-Type": "application/json",
								},
								body: JSON.stringify({ Flag: { flagStatus: "flagged" } }),
							},
						);
					}
					break;
				}
				case "archive": {
					for (const id of messageIds) {
						await this.#fetchWithTimeout(
							`https://graph.microsoft.com/v1.0/users/${this.#userId}/messages/${id}/move`,
							{
								method: "POST",
								headers: {
									Authorization: `Bearer ${token}`,
									"Content-Type": "application/json",
								},
								body: JSON.stringify({ destinationId: "deleteditems" }),
							},
						);
					}
					break;
				}
				case "addLabel": {
					// Graph uses categories for labels
					for (const id of messageIds) {
						await this.#fetchWithTimeout(
							`https://graph.microsoft.com/v1.0/users/${this.#userId}/messages/${id}`,
							{
								method: "PATCH",
								headers: {
									Authorization: `Bearer ${token}`,
									"Content-Type": "application/json",
								},
								body: JSON.stringify({ categories: [params.label] }),
							},
						);
					}
					break;
				}
				case "removeLabel": {
					for (const id of messageIds) {
						await this.#fetchWithTimeout(
							`https://graph.microsoft.com/v1.0/users/${this.#userId}/messages/${id}`,
							{
								method: "PATCH",
								headers: {
									Authorization: `Bearer ${token}`,
									"Content-Type": "application/json",
								},
								body: JSON.stringify({ categories: [] }),
							},
						);
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
