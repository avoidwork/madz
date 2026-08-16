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
	 * @param {object} config - IMAP provider configuration
	 * @param {string} config.host - IMAP/SMTP host
	 * @param {number} [config.port] - IMAP/SMTP port
	 * @param {string} config.user - Email username
	 * @param {string} config.password - Email password or app password
	 * @param {boolean} [config.secure] - Use SSL/TLS
	 * @param {string} [config.name] - Provider name
	 */
	constructor(config) {
		super({ ...config, type: "imap" });
		this.#config = {
			host: config.host,
			port: config.port || (config.secure ? 993 : 143),
			user: config.user,
			password: config.password,
			secure: config.secure || false,
		};
	}

	/**
	 * @param {object} params - Send parameters
	 * @returns {Promise<{ ok: boolean, messageId?: string, error?: string }>}
	 */
	async send(params) {
		try {
			const transport = createTransport({
				host: this.#config.host,
				port: this.#config.port || 587,
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

			const result = await transport.sendMail(mailOptions);
			return { ok: true, messageId: result.messageId };
		} catch (err) {
			return { ok: false, error: `IMAP send failed: ${err.message}` };
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
				host: this.#config.host,
				port: this.#config.port,
				secure: this.#config.secure,
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

			const result = [];
			for (const msg of messages.slice(0, limit)) {
				const data = await connection.getAttributes(msg.attributes.uid, {
					fetchHeaders: true,
				});
				result.push(this.#normalizeMessage(data, msg.attributes.uid));
			}

			await connection.closeBox(folder);
			await connection.disconnect();

			return { ok: true, messages: result };
		} catch (err) {
			return { ok: false, error: `IMAP read failed: ${err.message}` };
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
				host: this.#config.host,
				port: this.#config.port,
				secure: this.#config.secure,
				auth: {
					user: this.#config.user,
					pass: this.#config.password,
				},
			});

			await connection.openBox("INBOX");

			const searchCriteria = [["TEXT", params.query]];
			const messages = await connection.search(searchCriteria, { recent: false });

			const result = [];
			for (const msg of messages.slice(0, params.limit || 20)) {
				const data = await connection.getAttributes(msg.attributes.uid, {
					fetchHeaders: true,
				});
				result.push(this.#normalizeMessage(data, msg.attributes.uid));
			}

			await connection.closeBox("INBOX");
			await connection.disconnect();

			return { ok: true, messages: result };
		} catch (err) {
			return { ok: false, error: `IMAP search failed: ${err.message}` };
		}
	}

	/**
	 * @param {object} params - Draft parameters
	 * @returns {Promise<{ ok: boolean, draftId?: string, error?: string }>}
	 */
	async saveDraft(params) {
		try {
			const transport = createTransport({
				host: this.#config.host,
				port: this.#config.port || 587,
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
			};

			const result = await transport.sendMail({ ...mailOptions, envelope: { to: [] } });
			return { ok: true, draftId: result.messageId };
		} catch (err) {
			return { ok: false, error: `IMAP saveDraft failed: ${err.message}` };
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
				host: this.#config.host,
				port: this.#config.port,
				secure: this.#config.secure,
				auth: {
					user: this.#config.user,
					pass: this.#config.password,
				},
			});

			await connection.openBox("DRAFTS");

			const messages = await connection.search(["ALL"], { recent: false });

			const result = [];
			for (const msg of messages.slice(0, params.limit || 20)) {
				const data = await connection.getAttributes(msg.attributes.uid, {
					fetchHeaders: true,
				});
				result.push(this.#normalizeMessage(data, msg.attributes.uid));
			}

			await connection.closeBox("DRAFTS");
			await connection.disconnect();

			return { ok: true, drafts: result };
		} catch (err) {
			return { ok: false, error: `IMAP listDrafts failed: ${err.message}` };
		}
	}

	/**
	 * @param {string} draftId - Draft identifier
	 * @param {object} params - Updated draft parameters
	 * @returns {Promise<{ ok: boolean, draftId?: string, error?: string }>}
	 */
	async updateDraft(draftId, params) {
		try {
			const transport = createTransport({
				host: this.#config.host,
				port: this.#config.port || 587,
				secure: false,
				auth: {
					user: this.#config.user,
					pass: this.#config.password,
				},
			});

			const mailOptions = {
				from: this.#config.user,
				to: params.to?.join(", "),
				subject: params.subject,
				text: params.bodyType === "html" ? undefined : params.body,
				html: params.bodyType === "html" ? params.body : undefined,
			};

			await transport.sendMail({ ...mailOptions, envelope: { to: [] } });
			return { ok: true, draftId };
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
				host: this.#config.host,
				port: this.#config.port,
				secure: this.#config.secure,
				auth: {
					user: this.#config.user,
					pass: this.#config.password,
				},
			});

			await connection.openBox("DRAFTS");
			await connection.expunge({ uid: draftId });
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
				host: this.#config.host,
				port: this.#config.port,
				secure: this.#config.secure,
				auth: {
					user: this.#config.user,
					pass: this.#config.password,
				},
			});

			await connection.openBox("INBOX");

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
					await connection.closeBox("INBOX");
					await connection.disconnect();
					return { ok: false, error: `Unknown organize action: ${params.action}` };
			}

			await connection.closeBox("INBOX");
			await connection.disconnect();

			return { ok: true };
		} catch (err) {
			return { ok: false, error: `IMAP organize failed: ${err.message}` };
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
