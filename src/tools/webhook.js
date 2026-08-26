import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const WEBHOOKS_FILE = join(__dirname, "../../memory/tools/webhooks.json");
const WEBHOOKS_DIR = join(__dirname, "../../memory/tools");

/**
 * Ensure the webhooks directory exists.
 * @returns {Promise<void>}
 */
async function ensureWebhooksDir() {
	try {
		await access(WEBHOOKS_DIR);
	} catch {
		const { mkdir } = await import("node:fs/promises");
		await mkdir(WEBHOOKS_DIR, { recursive: true });
	}
}

/**
 * Load webhooks from persistent storage.
 * @returns {Promise<Array>} Array of webhook objects
 */
async function loadWebhooks() {
	try {
		await access(WEBHOOKS_FILE);
		const data = await readFile(WEBHOOKS_FILE, "utf-8");
		return JSON.parse(data);
	} catch {
		return [];
	}
}

/**
 * Save webhooks to persistent storage.
 * @param {Array} webhooks - Array of webhook objects
 * @returns {Promise<void>}
 */
async function saveWebhooks(webhooks) {
	await ensureWebhooksDir();
	await writeFile(WEBHOOKS_FILE, JSON.stringify(webhooks, null, 2), "utf-8");
}

/**
 * Generate a unique ID for a webhook.
 * @returns {string} Unique ID
 */
function generateId() {
	return `wh_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Create a webhook registration.
 * @param {string} url - Webhook URL
 * @param {string} secret - Secret for HMAC verification
 * @param {string[]} events - Event types to subscribe to
 * @returns {Promise<{ ok: boolean, data?: object, error?: string }>}
 */
export async function createWebhook(url, secret, events) {
	if (!url || typeof url !== "string" || !url.trim()) {
		return { ok: false, error: "URL is required and must be a non-empty string" };
	}
	if (!secret || typeof secret !== "string" || !secret.trim()) {
		return { ok: false, error: "Secret is required and must be a non-empty string" };
	}
	try {
		new URL(url);
	} catch {
		return { ok: false, error: `Invalid URL: ${url}` };
	}
	const webhooks = await loadWebhooks();
	const webhook = {
		id: generateId(),
		url,
		secret,
		events: events || ["*"],
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		active: true,
	};
	webhooks.push(webhook);
	await saveWebhooks(webhooks);
	return { ok: true, data: webhook };
}

/**
 * List all registered webhooks.
 * @param {boolean} [includeSecret=false] - Whether to include secrets in output
 * @returns {Promise<{ ok: boolean, data?: object[], error?: string }>}
 */
export async function listWebhooks(includeSecret = false) {
	const webhooks = await loadWebhooks();
	if (includeSecret) {
		return { ok: true, data: webhooks };
	}
	const safe = webhooks.map(({ secret: _secret, ...rest }) => rest);
	return { ok: true, data: safe };
}

/**
 * Delete a webhook by ID.
 * @param {string} id - Webhook ID
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function deleteWebhook(id) {
	const webhooks = await loadWebhooks();
	const idx = webhooks.findIndex((w) => w.id === id);
	if (idx === -1) {
		return { ok: false, error: `Webhook not found: ${id}` };
	}
	webhooks.splice(idx, 1);
	await saveWebhooks(webhooks);
	return { ok: true };
}

/**
 * Verify a webhook payload using HMAC-SHA256 signature.
 * @param {string} payload - Raw request body
 * @param {string} signature - HMAC signature from X-Hub-Signature-256 header
 * @param {string} secret - Webhook secret
 * @returns {{ ok: boolean, data?: boolean, error?: string }}
 */
export function verifyWebhook(payload, signature, secret) {
	if (!payload || !signature || !secret) {
		return { ok: false, error: "Payload, signature, and secret are required" };
	}

	const expected = createHmac("sha256", secret).update(payload).digest("hex");
	const sigWithoutPrefix = signature.startsWith("sha256=") ? signature.slice(7) : signature;

	// Constant-time comparison to prevent timing attacks
	if (expected.length !== sigWithoutPrefix.length) {
		return { ok: true, data: false };
	}
	const verified = timingSafeEqual(Buffer.from(expected), Buffer.from(sigWithoutPrefix));
	return { ok: true, data: verified };
}

/**
 * Webhook management tool — create, list, delete, and verify webhook registrations.
 * @param {string} input - JSON string with action, url, secret, events, payload
 * @returns {Promise<{ ok: boolean, data?: unknown, error?: string }>}
 */
export async function webhookManagement(input) {
	let parsed;
	try {
		parsed = JSON.parse(input);
	} catch {
		return { ok: false, error: "Invalid JSON input" };
	}
	return webhookManagementImpl(parsed);
}

/**
 * Webhook management implementation — takes a plain object.
 * @param {object} input - Parsed input object
 * @returns {Promise<{ ok: boolean, data?: unknown, error?: string }>}
 */
export async function webhookManagementImpl(input) {
	const schema = z.object({
		action: z.enum(["create", "list", "delete", "verify"]).describe("Action to perform"),
		url: z.string().url().optional().describe("Webhook URL (required for create)"),
		secret: z.string().optional().describe("Secret for HMAC verification (required for create)"),
		events: z.array(z.string()).optional().describe("Event types to subscribe to"),
		id: z.string().optional().describe("Webhook ID (required for delete)"),
		payload: z.string().optional().describe("Raw request body (required for verify)"),
		signature: z.string().optional().describe("HMAC signature (required for verify)"),
	});

	const validated = schema.safeParse(input);
	if (!validated.success) {
		return {
			ok: false,
			error: `Invalid input: ${validated.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
		};
	}

	const { action, url, secret, events, id, payload, signature } = validated.data;

	switch (action) {
		case "create": {
			if (!url) {
				return { ok: false, error: "URL is required for create action" };
			}
			if (!secret) {
				return { ok: false, error: "Secret is required for create action" };
			}
			return createWebhook(url, secret, events);
		}
		case "list": {
			return listWebhooks();
		}
		case "delete": {
			if (!id) {
				return { ok: false, error: "ID is required for delete action" };
			}
			return deleteWebhook(id);
		}
		case "verify": {
			if (!payload) {
				return { ok: false, error: "Payload is required for verify action" };
			}
			if (!signature) {
				return { ok: false, error: "Signature is required for verify action" };
			}
			if (!secret) {
				return { ok: false, error: "Secret is required for verify action" };
			}
			return verifyWebhook(payload, signature, secret);
		}
		default:
			return { ok: false, error: `Unknown action: ${action}` };
	}
}

/**
 * Create the LangChain tool wrapper for webhook management.
 * @returns {object} LangChain Tool instance
 */
export function createWebhookTool() {
	return tool(
		async (input) => {
			const result = await webhookManagementImpl(input);
			return JSON.stringify(result, null, 2);
		},
		{
			name: "webhook",
			description:
				"Manage webhook registrations. Actions: create (register webhook with URL, secret, events), list (return all webhooks), delete (remove webhook by ID), verify (HMAC-SHA256 signature verification against payload and secret). Webhooks are persisted to memory/tools/webhooks.json.",
			schema: z.object({
				action: z.enum(["create", "list", "delete", "verify"]).describe("Action to perform"),
				url: z.string().url().optional().describe("Webhook URL (required for create)"),
				secret: z
					.string()
					.optional()
					.describe("Secret for HMAC verification (required for create)"),
				events: z.array(z.string()).optional().describe("Event types to subscribe to"),
				id: z.string().optional().describe("Webhook ID (required for delete)"),
				payload: z.string().optional().describe("Raw request body (required for verify)"),
				signature: z.string().optional().describe("HMAC signature (required for verify)"),
			}),
		},
	);
}
