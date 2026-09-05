import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getActiveProvider } from "./index.js";
import { loadConfig } from "../../config/loader.js";

const config = loadConfig();

/**
 * Email tool implementation — read, send, manage drafts, organize, and search.
 * @param {object} input - Tool input with action and params
 * @param {object} options - Runtime options
 * @returns {Promise<object>} Result object
 */
export async function emailImpl(input, options) {
	const { action, ...params } = input;
	const validActions = [
		"read",
		"send",
		"draftSave",
		"draftList",
		"draftUpdate",
		"draftDelete",
		"organize",
		"search",
	];

	if (!validActions.includes(action)) {
		return {
			ok: false,
			error: `Unknown action: "${action}". Valid actions: ${validActions.join(", ")}`,
		};
	}

	const provider = options?._provider || getActiveProvider(options?.config);
	if (!provider) {
		return {
			ok: false,
			error: "No email provider configured. Set up email credentials via environment variables.",
		};
	}

	switch (action) {
		case "read": {
			if (!params.folder && !params.sender && !params.subject && !params.keyword) {
				return {
					ok: false,
					error: "At least one filter is required (folder, sender, subject, or keyword)",
				};
			}
			try {
				const result = await provider.read(params);
				if (!result.ok) return { ok: false, error: result.error };
				return { ok: true, count: result.messages?.length || 0, messages: result.messages };
			} catch (err) {
				return { ok: false, error: `Email read failed: ${err.message}` };
			}
		}

		case "send": {
			if (!params.to || params.to.length === 0) {
				return { ok: false, error: "At least one recipient (to) is required" };
			}
			if (!params.subject) {
				return { ok: false, error: "Subject is required" };
			}
			if (!params.body) {
				return { ok: false, error: "Body is required" };
			}
			try {
				const result = await provider.send(params);
				if (!result.ok) return { ok: false, error: result.error };
				return { ok: true, messageId: result.messageId, recipients: params.to };
			} catch (err) {
				return { ok: false, error: `Email send failed: ${err.message}` };
			}
		}

		case "draftSave": {
			if (!params.to || params.to.length === 0) {
				return { ok: false, error: "At least one recipient (to) is required" };
			}
			if (!params.subject) {
				return { ok: false, error: "Subject is required" };
			}
			if (!params.body) {
				return { ok: false, error: "Body is required" };
			}
			try {
				const result = await provider.saveDraft(params);
				if (!result.ok) return { ok: false, error: result.error };
				return { ok: true, draftId: result.draftId };
			} catch (err) {
				return { ok: false, error: `Email draft save failed: ${err.message}` };
			}
		}

		case "draftList": {
			try {
				const result = await provider.listDrafts(params);
				if (!result.ok) return { ok: false, error: result.error };
				return { ok: true, count: result.drafts?.length || 0, drafts: result.drafts };
			} catch (err) {
				return { ok: false, error: `Email draft list failed: ${err.message}` };
			}
		}

		case "draftUpdate": {
			if (!params.draftId) {
				return { ok: false, error: "Draft ID is required" };
			}
			try {
				const result = await provider.updateDraft(params.draftId, params);
				if (!result.ok) return { ok: false, error: result.error };
				return { ok: true, draftId: params.draftId };
			} catch (err) {
				return { ok: false, error: `Email draft update failed: ${err.message}` };
			}
		}

		case "draftDelete": {
			if (!params.draftId) {
				return { ok: false, error: "Draft ID is required" };
			}
			try {
				const result = await provider.deleteDraft(params.draftId);
				if (!result.ok) return { ok: false, error: result.error };
				return { ok: true };
			} catch (err) {
				return { ok: false, error: `Email draft delete failed: ${err.message}` };
			}
		}

		case "organize": {
			if (
				!params.messageIds ||
				(Array.isArray(params.messageIds) && params.messageIds.length === 0)
			) {
				return { ok: false, error: "At least one message ID is required" };
			}
			if (!params.organizeAction) {
				return {
					ok: false,
					error: "Action is required (markRead, markUnread, archive, addLabel, removeLabel)",
				};
			}
			const validActions = ["markRead", "markUnread", "archive", "addLabel", "removeLabel"];
			if (!validActions.includes(params.organizeAction)) {
				return {
					ok: false,
					error: `Invalid action: ${params.organizeAction}. Valid: ${validActions.join(", ")}`,
				};
			}
			if (
				(params.organizeAction === "addLabel" || params.organizeAction === "removeLabel") &&
				!params.label
			) {
				return { ok: false, error: "Label is required for addLabel/removeLabel actions" };
			}
			try {
				const result = await provider.organize({ ...params, action: params.organizeAction });
				if (!result.ok) return { ok: false, error: result.error };
				return {
					ok: true,
					action: params.organizeAction,
					messageCount: Array.isArray(params.messageIds) ? params.messageIds.length : 1,
				};
			} catch (err) {
				return { ok: false, error: `Email organize failed: ${err.message}` };
			}
		}

		case "search": {
			if (!params.query) {
				return { ok: false, error: "Search query is required" };
			}
			try {
				const result = await provider.search(params);
				if (!result.ok) return { ok: false, error: result.error };
				return { ok: true, count: result.messages?.length || 0, messages: result.messages };
			} catch (err) {
				return { ok: false, error: `Email search failed: ${err.message}` };
			}
		}


	}
}

/**
 * Email tool — read, send, manage drafts, organize, and search emails.
 * Single tool with action parameter dispatching to provider operations.
 */
export const email = tool(async (input) => emailImpl(input, { config }), {
	name: "email",
	description:
		"Read, send, manage drafts, organize, and search emails. Actions: read, send, draftSave, draftList, draftUpdate, draftDelete, organize, search.",
	schema: z.object({
		action: z
			.enum([
				"read",
				"send",
				"draftSave",
				"draftList",
				"draftUpdate",
				"draftDelete",
				"organize",
				"search",
			])
			.describe("Operation to perform"),
		folder: z
			.string()
			.optional()
			.describe("Mailbox folder (default: INBOX). Examples: INBOX, Sent, Drafts, [Gmail]/Trash"),
		limit: z.number().optional().default(20).describe("Maximum number of messages to return"),
		sender: z.string().optional().describe("Filter by sender email address"),
		subject: z.string().optional().describe("Filter by subject keyword or email subject line"),
		keyword: z.string().optional().describe("Filter by body keyword"),
		dateFrom: z.string().optional().describe("Filter by date from (ISO 8601 string)"),
		dateTo: z.string().optional().describe("Filter by date to (ISO 8601 string)"),
		label: z.string().optional().describe("Label name (required for addLabel/removeLabel)"),
		to: z.array(z.string()).optional().describe("Recipient email addresses"),
		cc: z.array(z.string()).optional().describe("CC email addresses"),
		bcc: z.array(z.string()).optional().describe("BCC email addresses"),
		body: z.string().optional().describe("Email body content"),
		bodyType: z
			.enum(["text", "html"])
			.optional()
			.default("text")
			.describe("Body format (default: text)"),
		attachments: z
			.array(
				z.object({ filename: z.string(), content: z.string(), contentType: z.string().optional() }),
			)
			.optional()
			.describe("File attachments (base64 encoded content)"),
		draftId: z.string().optional().describe("Draft identifier"),
		messageIds: z
			.union([z.string(), z.array(z.string())])
			.optional()
			.describe("Message ID or array of message IDs"),
		organizeAction: z
			.enum(["markRead", "markUnread", "archive", "addLabel", "removeLabel"])
			.optional()
			.describe("Organization action"),
		query: z.string().optional().describe("Search query text"),
	}),
});
