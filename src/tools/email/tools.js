import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getActiveProvider, validateProviderConfig } from "./index.js";
import { loadConfig } from "../../config/loader.js";

const config = loadConfig();

/**
 * Email read tool — fetch messages from the configured email provider.
 */
export const emailRead = tool(
	async ({ folder, limit, sender, subject, keyword, dateFrom, dateTo, label }) => {
		const provider = getActiveProvider(config);
		if (!provider) {
			return {
				ok: false,
				error: "No email provider configured. Set up email credentials in config.yaml.",
			};
		}

		const validation = validateProviderConfig(config.email?.provider);
		if (!validation.valid) {
			return {
				ok: false,
				error: `Invalid email provider config: ${validation.errors?.join("; ")}`,
			};
		}

		try {
			const result = await provider.read({
				folder,
				limit,
				sender,
				subject,
				keyword,
				dateFrom,
				dateTo,
				label,
			});

			if (!result.ok) {
				return { ok: false, error: result.error };
			}

			return {
				ok: true,
				count: result.messages?.length || 0,
				messages: result.messages,
			};
		} catch (err) {
			return { ok: false, error: `Email read failed: ${err.message}` };
		}
	},
	{
		name: "email_read",
		description:
			"Read emails from inbox, sent, drafts, or custom folders. Supports filtering by sender, subject, keyword, date range, and label.",
		schema: z.object({
			folder: z
				.string()
				.optional()
				.describe("Mailbox folder (default: INBOX). Examples: INBOX, Sent, Drafts, [Gmail]/Trash"),
			limit: z.number().optional().default(20).describe("Maximum number of messages to return"),
			sender: z.string().optional().describe("Filter by sender email address"),
			subject: z.string().optional().describe("Filter by subject keyword"),
			keyword: z.string().optional().describe("Filter by body keyword"),
			dateFrom: z.string().optional().describe("Filter by date from (ISO 8601 string)"),
			dateTo: z.string().optional().describe("Filter by date to (ISO 8601 string)"),
			label: z.string().optional().describe("Filter by label (Gmail-specific)"),
		}),
	},
);

/**
 * Email send tool — compose and send emails.
 */
export const emailSend = tool(
	async ({ to, subject, body, bodyType, cc, bcc, attachments }) => {
		const provider = getActiveProvider(config);
		if (!provider) {
			return {
				ok: false,
				error: "No email provider configured. Set up email credentials in config.yaml.",
			};
		}

		const validation = validateProviderConfig(config.email?.provider);
		if (!validation.valid) {
			return {
				ok: false,
				error: `Invalid email provider config: ${validation.errors?.join("; ")}`,
			};
		}

		if (!to || to.length === 0) {
			return { ok: false, error: "At least one recipient (to) is required" };
		}
		if (!subject) {
			return { ok: false, error: "Subject is required" };
		}
		if (!body) {
			return { ok: false, error: "Body is required" };
		}

		try {
			const result = await provider.send({
				to,
				subject,
				body,
				bodyType,
				cc,
				bcc,
				attachments,
			});

			if (!result.ok) {
				return { ok: false, error: result.error };
			}

			return {
				ok: true,
				messageId: result.messageId,
				recipients: to,
			};
		} catch (err) {
			return { ok: false, error: `Email send failed: ${err.message}` };
		}
	},
	{
		name: "email_send",
		description:
			"Send an email with text/HTML body, attachments, CC/BCC support. Requires an email provider to be configured.",
		schema: z.object({
			to: z.array(z.string()).min(1).describe("Recipient email addresses"),
			subject: z.string().min(1).describe("Email subject line"),
			body: z.string().min(1).describe("Email body content"),
			bodyType: z
				.enum(["text", "html"])
				.optional()
				.default("text")
				.describe("Body format (default: text)"),
			cc: z.array(z.string()).optional().describe("CC email addresses"),
			bcc: z.array(z.string()).optional().describe("BCC email addresses"),
			attachments: z
				.array(
					z.object({
						filename: z.string(),
						content: z.string(),
						contentType: z.string().optional(),
					}),
				)
				.optional()
				.describe("File attachments (base64 encoded content)"),
		}),
	},
);

/**
 * Email draft save tool.
 */
export const emailDraftSave = tool(
	async ({ to, subject, body, bodyType }) => {
		const provider = getActiveProvider(config);
		if (!provider) {
			return { ok: false, error: "No email provider configured." };
		}

		if (!to || to.length === 0) {
			return { ok: false, error: "At least one recipient (to) is required" };
		}
		if (!subject) {
			return { ok: false, error: "Subject is required" };
		}
		if (!body) {
			return { ok: false, error: "Body is required" };
		}

		try {
			const result = await provider.saveDraft({ to, subject, body, bodyType });

			if (!result.ok) {
				return { ok: false, error: result.error };
			}

			return { ok: true, draftId: result.draftId };
		} catch (err) {
			return { ok: false, error: `Email draft save failed: ${err.message}` };
		}
	},
	{
		name: "email_draft_save",
		description: "Save an email as a draft. Does not send the email.",
		schema: z.object({
			to: z.array(z.string()).min(1).describe("Recipient email addresses"),
			subject: z.string().min(1).describe("Draft subject"),
			body: z.string().min(1).describe("Draft body content"),
			bodyType: z
				.enum(["text", "html"])
				.optional()
				.default("text")
				.describe("Body format (default: text)"),
		}),
	},
);

/**
 * Email draft list tool.
 */
export const emailDraftList = tool(
	async ({ limit }) => {
		const provider = getActiveProvider(config);
		if (!provider) {
			return { ok: false, error: "No email provider configured." };
		}

		try {
			const result = await provider.listDrafts({ limit });

			if (!result.ok) {
				return { ok: false, error: result.error };
			}

			return {
				ok: true,
				count: result.drafts?.length || 0,
				drafts: result.drafts,
			};
		} catch (err) {
			return { ok: false, error: `Email draft list failed: ${err.message}` };
		}
	},
	{
		name: "email_draft_list",
		description: "List saved email drafts.",
		schema: z.object({
			limit: z.number().optional().default(20).describe("Maximum number of drafts to return"),
		}),
	},
);

/**
 * Email draft update tool.
 */
export const emailDraftUpdate = tool(
	async ({ draftId, to, subject, body, bodyType }) => {
		const provider = getActiveProvider(config);
		if (!provider) {
			return { ok: false, error: "No email provider configured." };
		}

		if (!draftId) {
			return { ok: false, error: "Draft ID is required" };
		}

		try {
			const result = await provider.updateDraft(draftId, { to, subject, body, bodyType });

			if (!result.ok) {
				return { ok: false, error: result.error };
			}

			return { ok: true, draftId };
		} catch (err) {
			return { ok: false, error: `Email draft update failed: ${err.message}` };
		}
	},
	{
		name: "email_draft_update",
		description: "Update an existing email draft. Provide draftId and any fields to update.",
		schema: z.object({
			draftId: z.string().min(1).describe("Draft identifier"),
			to: z.array(z.string()).optional().describe("Recipient email addresses"),
			subject: z.string().optional().describe("Draft subject"),
			body: z.string().optional().describe("Draft body content"),
			bodyType: z.enum(["text", "html"]).optional().describe("Body format"),
		}),
	},
);

/**
 * Email draft delete tool.
 */
export const emailDraftDelete = tool(
	async ({ draftId }) => {
		const provider = getActiveProvider(config);
		if (!provider) {
			return { ok: false, error: "No email provider configured." };
		}

		if (!draftId) {
			return { ok: false, error: "Draft ID is required" };
		}

		try {
			const result = await provider.deleteDraft(draftId);

			if (!result.ok) {
				return { ok: false, error: result.error };
			}

			return { ok: true, draftId };
		} catch (err) {
			return { ok: false, error: `Email draft delete failed: ${err.message}` };
		}
	},
	{
		name: "email_draft_delete",
		description: "Delete an email draft by ID.",
		schema: z.object({
			draftId: z.string().min(1).describe("Draft identifier"),
		}),
	},
);

/**
 * Email organize tool — mark read/unread, archive, label.
 */
export const emailOrganize = tool(
	async ({ messageIds, action, label }) => {
		const provider = getActiveProvider(config);
		if (!provider) {
			return { ok: false, error: "No email provider configured." };
		}

		if (!messageIds || (Array.isArray(messageIds) && messageIds.length === 0)) {
			return { ok: false, error: "At least one message ID is required" };
		}
		if (!action) {
			return {
				ok: false,
				error: "Action is required (markRead, markUnread, archive, addLabel, removeLabel)",
			};
		}

		const validActions = ["markRead", "markUnread", "archive", "addLabel", "removeLabel"];
		if (!validActions.includes(action)) {
			return { ok: false, error: `Invalid action: ${action}. Valid: ${validActions.join(", ")}` };
		}

		if ((action === "addLabel" || action === "removeLabel") && !label) {
			return { ok: false, error: "Label is required for addLabel/removeLabel actions" };
		}

		try {
			const result = await provider.organize({ messageIds, action, label });

			if (!result.ok) {
				return { ok: false, error: result.error };
			}

			return {
				ok: true,
				action,
				messageCount: Array.isArray(messageIds) ? messageIds.length : 1,
			};
		} catch (err) {
			return { ok: false, error: `Email organize failed: ${err.message}` };
		}
	},
	{
		name: "email_organize",
		description:
			"Organize emails: mark as read/unread, archive, add/remove labels. Requires message IDs.",
		schema: z.object({
			messageIds: z
				.union([z.string(), z.array(z.string())])
				.describe("Message ID or array of message IDs"),
			action: z
				.enum(["markRead", "markUnread", "archive", "addLabel", "removeLabel"])
				.describe("Organization action"),
			label: z.string().optional().describe("Label name (required for addLabel/removeLabel)"),
		}),
	},
);

/**
 * Email search tool — search across the mailbox.
 */
export const emailSearch = tool(
	async ({ query, limit }) => {
		const provider = getActiveProvider(config);
		if (!provider) {
			return { ok: false, error: "No email provider configured." };
		}

		if (!query) {
			return { ok: false, error: "Search query is required" };
		}

		try {
			const result = await provider.search({ query, limit });

			if (!result.ok) {
				return { ok: false, error: result.error };
			}

			return {
				ok: true,
				count: result.messages?.length || 0,
				messages: result.messages,
			};
		} catch (err) {
			return { ok: false, error: `Email search failed: ${err.message}` };
		}
	},
	{
		name: "email_search",
		description: "Search emails across the mailbox using a text query.",
		schema: z.object({
			query: z.string().min(1).describe("Search query text"),
			limit: z.number().optional().default(20).describe("Maximum number of results"),
		}),
	},
);
