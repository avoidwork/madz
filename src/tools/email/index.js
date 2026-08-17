import { GmailProvider } from "./providers/gmail.js";
import { GraphProvider } from "./providers/graph.js";
import { ImapProvider } from "./providers/imap.js";

/**
 * Email provider factory.
 * Selects the appropriate provider based on configuration.
 * @param {object} config - Provider configuration
 * @param {string} config.type - Provider type: "gmail", "graph", or "imap"
 * @returns {import("./providers/base.js").default}
 */
export function createEmailProvider(config) {
	if (!config || !config.type) {
		throw new Error("Email provider config required: { type, ... }");
	}

	switch (config.type) {
		case "gmail":
			return new GmailProvider(config);
		case "graph":
			return new GraphProvider(config);
		case "imap":
			return new ImapProvider(config);
		default:
			throw new Error(`Unknown email provider type: ${config.type}. Supported: gmail, graph, imap`);
	}
}

/**
 * Get the currently configured email provider.
 * @param {object} config - Madz application config
 * @returns {EmailProvider|null}
 */
export function getActiveProvider(config) {
	if (!config?.email) return null;

	const providerConfig = config.email.provider;
	if (!providerConfig) return null;

	try {
		return createEmailProvider(providerConfig);
	} catch {
		return null;
	}
}

/**
 * Validate email provider configuration by checking required env vars.
 * @param {object} config - Provider configuration
 * @returns {{ valid: boolean, errors?: string[] }}
 */
export function validateProviderConfig(config) {
	const errors = [];

	if (!config?.type) {
		errors.push("Provider type is required (gmail, graph, or imap)");
		return { valid: false, errors };
	}

	switch (config.type) {
		case "gmail":
			if (!process.env.EMAIL_GMAIL_CLIENT_ID) errors.push("EMAIL_GMAIL_CLIENT_ID is required");
			if (!process.env.EMAIL_GMAIL_CLIENT_SECRET)
				errors.push("EMAIL_GMAIL_CLIENT_SECRET is required");
			if (!process.env.EMAIL_GMAIL_REFRESH_TOKEN)
				errors.push("EMAIL_GMAIL_REFRESH_TOKEN is required");
			break;
		case "graph":
			if (!process.env.EMAIL_GRAPH_CLIENT_ID) errors.push("EMAIL_GRAPH_CLIENT_ID is required");
			if (!process.env.EMAIL_GRAPH_CLIENT_SECRET)
				errors.push("EMAIL_GRAPH_CLIENT_SECRET is required");
			if (!process.env.EMAIL_GRAPH_REFRESH_TOKEN)
				errors.push("EMAIL_GRAPH_REFRESH_TOKEN is required");
			if (!process.env.EMAIL_GRAPH_TENANT_ID) errors.push("EMAIL_GRAPH_TENANT_ID is required");
			break;
		case "imap":
			if (!process.env.EMAIL_IMAP_USER) errors.push("EMAIL_IMAP_USER is required");
			if (!process.env.EMAIL_IMAP_PASSWORD) errors.push("EMAIL_IMAP_PASSWORD is required");
			break;
		default:
			errors.push(`Unknown provider type: ${config.type}`);
	}

	return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
}

export { EmailProvider } from "./providers/base.js";
export { GmailProvider } from "./providers/gmail.js";
export { GraphProvider } from "./providers/graph.js";
export { ImapProvider } from "./providers/imap.js";
