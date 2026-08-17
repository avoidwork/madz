import { createTransport } from "nodemailer";
import { EmailProvider } from "./base.js";

/**
 * Generic IMAP provider implementation.
 * Uses nodemailer for SMTP send and imap-simple for IMAP read.
 */
export class ImapProvider extends EmailProvider {
	/**
	 * @type {object}
	 */
	#config;

	/**
	 * @type {AbortController|null}
	 */
	#currentAbort = null;

	/**
	 * @param {object} config - IMAP provider configuration
	 * @param {string} [config.imapHost] - IMAP host (default: from env or imap.gmail.com)
	 * @param {number} [config.imapPort] - IMAP port
	 * @param {boolean} [config.imapSecure] - Use SSL/TLS for IMAP
	 * @param {string} [config.smtpHost] - SMTP host (default: from env or same as IMAP host)
	 * @param {number} [config.smtpPort] - SMTP port
	 * @param {string} [config.name] - Provider name
	 */
	constructor(config) {
		super({ ...config, type: "imap" });

		// Credentials from env vars only — never from config
		const imapHost = config.imapHost || process.env.EMAIL_IMAP_HOST || "imap.gmail.com";
		const imapPort = config.imapPort || parseInt(process.env.EMAIL_IMAP_PORT || "993", 10);
		const imapSecure = config.imapSecure ?? process.env.EMAIL_IMAP_SECURE !== "false";
		const smtpHost = config.smtpHost || process.env.EMAIL_SMTP_HOST || imapHost;
		const smtpPort = config.smtpPort || parseInt(process.env.EMAIL_SMTP_PORT || "587", 10);
		const user = process.env.EMAIL_IMAP_USER;
		const password = process.env.EMAIL_IMAP_PASSWORD;

		if (!user || !password) {
			throw new Error(
				"IMAP provider requires EMAIL_IMAP_USER and EMAIL_IMAP_PASSWORD env vars",
			);
		}

		this.#config = {
			imapHost,
			imapPort,
			imapSecure,
			smtpHost,
			smtpPort,
			user,
			password,
		};
	}

	/**
	 * Validate provider configuration by checking required env vars.
	 * @returns {{ valid: boolean, errors?: string[] }}
	 */
	validateConfig() {
		const errors = [];
		if (!process.env.EMAIL_IMAP_USER) errors.push("EMAIL_IMAP_USER is required");
		if (!process.env.EMAIL_IMAP_PASSWORD) errors.push("EMAIL_IMAP_PASSWORD is required");
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
	 * Strips passwords, host info, and other sensitive data from error strings.
	 * @param {string} message - Raw error message
	 * @returns {string} Sanitized message
	 */
	#sanitizeError(message) {
		if (!message) return "An error occurred";
		return message
			.replace(/password=[^&\s]*/g, "password=[REDACTED]")
			.replace(/pass=[^&\s]*/g, "pass=[REDACTED]")
			.replace(/Bearer [^"'\s]*/g, "Bearer [REDACTED]")
			.replace(/client_secret=[^&\s]*/g, "client_secret=[REDACTED]")
			.replace(/access_token=[^&\s]*/g, "access_token=[REDACTED]")
			.replace(/refresh_token=[^&\s]*/g, "refresh_token=[REDACTED]");
	}

	/**
	 * Execute an async operation with timeout.
	 * @param {Function} fn - Async function to execute
	 * @returns {Promise<*>}
	 */
	async #withTimeout(fn) {
		if (this.#currentAbort) {
			this.#currentAbort.abort();
		}
		const controller = new AbortController();
		this.#currentAbort = controller;
		const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

		try {
			return await fn({ signal: controller.signal });
		} finally {
			clearTimeout(timeoutId);
			this.#currentAbort = null;
		}
	}

	/**
	 * @param {object} params - Send parameters
	 * @returns {Promise<{ ok: boolean, messageId?: string, error?: string }>}
	 */
	async send(params) {
		try {
			const transport = createTransport({
				host: this.#config.smtpHost,
				port: this.#config.smtpPort,
				secure: false,
				auth: {
					user: this.#config.user,
					pass: this.#config.password,
				},
			});

			const mailOptions = {
				from: this.#config.user,
				to: params.to.join(", "),
				subject: params.subject,
				text: params.bodyType === "html" ? undefined : params.body,
				html: params.bodyType === "html" ? params.body : undefined,
				cc: params.cc?.join(", "),
				bcc: params.bcc?.join(", "),
			};

			if (params.attachments && params.attachments.length > 0) {
				mailOptions.attachments = params.attachments.map((att) => ({
					filename: att.filename,
					content: Buffer.from(att.content, "base64"),
					contentType: att.contentType || "application/octet-stream",
				}));
			}

			const result = await this.#withTimeout(async () => transport.sendMail(mailOptions));
			return { ok: true, messageId: result.messageId };
		} catch (err) {
			return { ok: false, error: `IMAP send failed: ${this.#sanitizeError(err.message)}` };
		}
	}

	/**
	 * @param {object} params - Read parameters
	 * @returns {Promise<{ ok: boolean, messages?: object[], error?: string }>}
	 */
	async read(params = {}) {
		try {
			const { folder = "INBOX", limit = 20, ...filters } = params;

			const { default: ImapSimple } = await import("imap-simple");
			const imapConfig = {
				host: this.#config.imapHost,
				port: this.#config.imapPort,
				secure: this.#config.imapSecure,
				auth: {
					user: this.#config.user,
					pass: this.#config.password,
				},
			};

			const connection = await ImapSimple.connect(imapConfig);
			await connection.openBox(folder);

			let searchCriteria = ["ALL"];
			if (filters.sender) searchCriteria = [["FROM", filters.sender]];
			if (filters.subject) searchCriteria = [["SUBJECT", filters.subject]];
			if (filters.dateFrom) searchCriteria = [["SINCE", filters.dateFrom]];
			if (filters.dateTo) searchCriteria = [["ON", filters.dateTo]];
			if (filters.keyword) searchCriteria = [["TEXT", filters.keyword]];

			const messages = await connection.search(searchCriteria, { recent: false });

			// Use UID-based pagination to avoid fetching all messages
			const result = [];
			const uids = messages.slice(0, limit).map((m) => m.attributes.uid);
			if (uids.length > 0) {
				const dataArray = await connection.getAttributes(uids, { fetchHeaders: true });
				for (let i = 0; i < uids.length; i++) {
					result.push(this.#normalizeMessage(dataArray[i], uids[i]));
				}
			}

			await connection.closeBox(folder);
			await connection.disconnect();

			return { ok: true, messages: result };
		} catch (err) {
			return { ok: false, error: `IMAP read failed: ${this.#sanitizeError(err.message)}` };
		}
	}

	/**
	 * @param {object} params - Search parameters
	 * @returns {Promise<{ ok: boolean, messages?: object[], error?: string }>}
	 */
	async search(params) {
		try {
			const { default: ImapSimple } = await import("imap-simple");
			const connection = await ImapSimple.connect({
				host: this.#config.imapHost,
				port: this.#config.imapPort,
				secure: this.#config.imapSecure,
				auth: {
					user: this.#config.user,
					pass: this.#config.password,
				},
			});

			const folder = params.folder || "INBOX";
			await connection.openBox(folder);

			const searchCriteria = [["TEXT", params.query]];
			const messages = await connection.search(searchCriteria, { recent: false });

			// Use UID-based pagination to avoid fetching all messages
			const result = [];
			const uids = messages.slice(0, params.limit || 20).map((m) => m.attributes.uid);
			if (uids.length > 0) {
				const dataArray = await connection.getAttributes(uids, { fetchHeaders: true });
				for (let i = 0; i < uids.length; i++) {
					result.push(this.#normalizeMessage(dataArray[i], uids[i]));
				}
			}

			await connection.closeBox(folder);
			await connection.disconnect();

			return { ok: true, messages: result };
		} catch (err) {
			return { ok: false, error: `IMAP search failed: ${this.#sanitizeError(err.message)}` };
		}
	}

	/**
	 * @param {object} params - Draft parameters
	 * @returns {Promise<{ ok: boolean, draftId?: string, error?: string }>}
	 */
	async saveDraft(params) {
		try {
			const { default: ImapSimple } = await import("imap-simple");
			const connection = await ImapSimple.connect({
				host: this.#config.imapHost,
				port: this.#config.imapPort,
				secure: this.#config.imapSecure,
				auth: {
					user: this.#config.user,
					pass: this.#config.password,
				},
			});

			// Build RFC 822 message
			const from = params.from || this.#config.user;
			let rfc822 = `From: ${from}\r\nTo: ${params.to.join(", ")}\r\n`;
			if (params.cc?.length) rfc822 += `Cc: ${params.cc.join(", ")}\r\n`;
			if (params.bcc?.length) rfc822 += `Bcc: ${params.bcc.join(", ")}\r\n`;
			rfc822 += `Subject: ${params.subject}\r\n`;
			rfc822 += `Date: ${new Date().toUTCString()}\r\n`;
			rfc822 += `Content-Type: ${params.bodyType === "html" ? "text/html" : "text/plain"}; charset="UTF-8"\r\n\r\n`;
			rfc822 += params.body;

			await connection.openBox("DRAFTS");
			const result = await connection.addMessage("DRAFTS", rfc822);
			await connection.closeBox("DRAFTS");
			await connection.disconnect();

			// Use the actual IMAP UID as the draft ID
			return { ok: true, draftId: String(result.uid) };
		} catch (err) {
			return { ok: false, error: `IMAP saveDraft failed: ${this.#sanitizeError(err.message)}` };
		}
	}

	/**
	 * @param {object} params - List parameters
	 * @returns {Promise<{ ok: boolean, drafts?: object[], error?: string }>}
	 */
	async listDrafts(params = {}) {
		try {
			const { default: ImapSimple } = await import("imap-simple");
			const connection = await ImapSimple.connect({
				host: this.#config.imapHost,
				port: this.#config.imapPort,
				secure: this.#config.imapSecure,
				auth: {
					user: this.#config.user,
					pass: this.#config.password,
				},
			});

			await connection.openBox("DRAFTS");

			const messages = await connection.search(["ALL"], { recent: false });

			// Use UID-based pagination to avoid fetching all messages
			const result = [];
			const uids = messages.slice(0, params.limit || 20).map((m) => m.attributes.uid);
			if (uids.length > 0) {
				const dataArray = await connection.getAttributes(uids, { fetchHeaders: true });
				for (let i = 0; i < uids.length; i++) {
					result.push(this.#normalizeMessage(dataArray[i], uids[i]));
				}
			}

			await connection.closeBox("DRAFTS");
			await connection.disconnect();

			return { ok: true, drafts: result };
		} catch (err) {
			return { ok: false, error: `IMAP listDrafts failed: ${this.#sanitizeError(err.message)}` };
		}
	}

	/**
	 * @param {string} draftId - Draft identifier
	 * @param {object} params - Updated draft parameters
	 * @returns {Promise<{ ok: boolean, draftId?: string, error?: string }>}
	 */
	async updateDraft(draftId, params) {
		try {
			// IMAP doesn't support updating drafts in place — delete and recreate
			await this.deleteDraft(draftId);
			return this.saveDraft(params);
		} catch (err) {
			return { ok: false, error: `IMAP updateDraft failed: ${err.message}` };
		}
	}

	/**
	 * @param {string} draftId - Draft identifier
	 * @returns {Promise<{ ok: boolean, error?: string }>}
	 */
	async deleteDraft(draftId) {
		try {
			const { default: ImapSimple } = await import("imap-simple");
			const connection = await ImapSimple.connect({
				host: this.#config.imapHost,
				port: this.#config.imapPort,
				secure: this.#config.imapSecure,
				auth: {
					user: this.#config.user,
					pass: this.#config.password,
				},
			});

			await connection.openBox("DRAFTS");
			await connection.setFlags({ uid: [draftId] }, ["\\Deleted"]);
			await connection.expunge();
			await connection.closeBox("DRAFTS");
			await connection.disconnect();

			return { ok: true };
		} catch (err) {
			return { ok: false, error: `IMAP deleteDraft failed: ${err.message}` };
		}
	}

	/**
	 * @param {object} params - Organization parameters
	 * @returns {Promise<{ ok: boolean, error?: string }>}
	 */
	async organize(params) {
		try {
			const { default: ImapSimple } = await import("imap-simple");
			const connection = await ImapSimple.connect({
				host: this.#config.imapHost,
				port: this.#config.imapPort,
				secure: this.#config.imapSecure,
				auth: {
					user: this.#config.user,
					pass: this.#config.password,
				},
			});

			const folder = params.folder || "INBOX";
			await connection.openBox(folder);

			const messageIds = Array.isArray(params.messageIds) ? params.messageIds : [params.messageIds];

			switch (params.action) {
				case "markRead":
					await connection.setFlags({ uid: messageIds }, ["\\Seen"]);
					break;
				case "markUnread":
					await connection.setFlags({ uid: messageIds }, ["\\Seen"], { remove: true });
					break;
				case "archive":
					await connection.copy({ uid: messageIds }, "Archive");
					await connection.setFlags({ uid: messageIds }, ["\\Deleted"]);
					break;
				case "addLabel":
					await connection.setFlags({ uid: messageIds }, [`\\${params.label}`]);
					break;
				case "removeLabel":
					await connection.setFlags({ uid: messageIds }, [`\\${params.label}`], { remove: true });
					break;
				default:
					await connection.closeBox(folder);
					await connection.disconnect();
					return { ok: false, error: `Unknown organize action: ${params.action}` };
			}

			await connection.closeBox(folder);
			await connection.disconnect();

			return { ok: true };
		} catch (err) {
			return { ok: false, error: `IMAP organize failed: ${this.#sanitizeError(err.message)}` };
		}
	}

	/**
	 * Normalize an IMAP message to a standard format.
	 * @param {object} data - IMAP message data
	 * @param {string} uid - Message UID
	 * @returns {object} Normalized message
	 */
	#normalizeMessage(data, uid) {
		const headers = data.headers || {};
		return {
			id: uid,
			subject: headers.subject || "(no subject)",
			from: headers.from || "",
			to: headers.to || "",
			body: data.body || "",
			date: headers.date || "",
			uid,
		};
	}
}
