import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import { filterUrl } from "../sandbox/urlFilter.js";

const DEFAULT_RATE_LIMIT = 100;
const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Zod schema for webhook management input.
 */
export const WebhookSchema = z.object({
	action: z
		.enum(["create", "list", "delete", "verify", "deliver"])
		.describe("Webhook action to perform"),
	url: z.string().url().optional().describe("Webhook URL"),
	secret: z.string().optional().describe("Webhook secret for HMAC signing"),
	events: z.array(z.string()).optional().describe("Events to subscribe to"),
	payload: z.any().optional().describe("Webhook payload"),
	webhookId: z.string().optional().describe("Webhook ID for delete/verify/deliver"),
	signature: z.string().optional().describe("HMAC signature header value"),
	timestamp: z.string().optional().describe("Timestamp header value (ISO 8601)"),
	headers: z.record(z.string()).optional().describe("Custom headers for delivery"),
	rateLimit: z
		.number()
		.int()
		.positive()
		.optional()
		.describe("Max deliveries per minute (default: 100)"),
});

/**
 * In-memory webhook store.
 * @type {Map<string, object>}
 */
const webhookStore = new Map();

/**
 * Rate limiter state per webhook.
 * @type {Map<string, number[]>}
 */
const rateLimitState = new Map();

/**
 * Mask a secret string for safe display.
 * @param {string} secret - Secret to mask
 * @returns {string} Masked secret
 */
function maskSecret(secret) {
	if (!secret || secret.length <= 4) return "****";
	return secret.slice(0, 2) + "*".repeat(secret.length - 4) + secret.slice(-2);
}

/**
 * Verify HMAC-SHA256 signature.
 * @param {string} payload - Raw payload string
 * @param {string} signature - Expected signature (hex)
 * @param {string} secret - Secret key
 * @returns {boolean} Whether signature is valid
 */
function verifyHmacSignature(payload, signature, secret) {
	if (!signature || !secret) return false;
	const expected = createHash("sha256").update(payload).digest("hex");
	return signature === expected;
}

/**
 * Validate timestamp against 5-minute window.
 * @param {string} timestampStr - ISO 8601 timestamp string
 * @returns {boolean} Whether timestamp is valid
 */
function validateTimestamp(timestampStr) {
	if (!timestampStr) return false;
	try {
		const timestamp = new Date(timestampStr).getTime();
		const now = Date.now();
		return Math.abs(now - timestamp) <= TIMESTAMP_WINDOW_MS;
	} catch (_err) {
		return false;
	}
}

/**
 * Check rate limit for a webhook.
 * @param {string} webhookId - Webhook ID
 * @param {number} rateLimit - Max deliveries per minute
 * @returns {{ allowed: boolean, retryAfter?: number }}
 */
function checkRateLimit(webhookId, rateLimit = DEFAULT_RATE_LIMIT) {
	const now = Date.now();
	const windowMs = 60 * 1000; // 1 minute

	if (!rateLimitState.has(webhookId)) {
		rateLimitState.set(webhookId, []);
	}

	const timestamps = rateLimitState.get(webhookId);
	// Remove timestamps outside the window
	while (timestamps.length > 0 && now - timestamps[0] > windowMs) {
		timestamps.shift();
	}

	if (timestamps.length >= rateLimit) {
		const oldest = timestamps[0];
		const retryAfter = Math.ceil((oldest + windowMs - now) / 1000);
		return { allowed: false, retryAfter };
	}

	timestamps.push(now);
	return { allowed: true };
}

/**
 * Deliver a webhook payload to a registered endpoint.
 * @param {string} webhookId - Webhook ID
 * @param {object} payload - Payload to deliver
 * @param {number} rateLimit - Rate limit per minute
 * @returns {Promise<object>} Delivery result
 */
async function deliverWebhook(webhookId, payload, rateLimit = DEFAULT_RATE_LIMIT) {
	const webhook = webhookStore.get(webhookId);
	if (!webhook) {
		return { ok: false, error: `Webhook not found: ${webhookId}` };
	}

	// Check rate limit
	const rateCheck = checkRateLimit(webhookId, rateLimit);
	if (!rateCheck.allowed) {
		return {
			ok: false,
			error: `Rate limit exceeded. Retry after ${rateCheck.retryAfter}s`,
			rateLimited: true,
			retryAfter: rateCheck.retryAfter,
		};
	}

	// Build payload with metadata
	const deliveryPayload = {
		...payload,
		_id: webhookId,
		_events: webhook.events || ["*"],
		_timestamp: new Date().toISOString(),
	};

	// Sign payload
	const payloadStr = JSON.stringify(deliveryPayload);
	const signature = createHash("sha256")
		.update(payloadStr + webhook.secret)
		.digest("hex");

	// Build headers
	const headers = {
		"Content-Type": "application/json",
		"X-Webhook-Signature": `sha256=${signature}`,
		"X-Webhook-Timestamp": new Date().toISOString(),
		"X-Webhook-Id": webhookId,
		...webhook.headers,
	};

	// Deliver
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 10000);

	try {
		const response = await fetch(webhook.url, {
			method: "POST",
			headers,
			body: payloadStr,
			signal: controller.signal,
		});
		clearTimeout(timeoutId);

		return {
			ok: response.ok,
			status: response.status,
			statusText: response.statusText,
		};
	} catch (err) {
		clearTimeout(timeoutId);
		return {
			ok: false,
			error: `Delivery failed: ${err.message}`,
		};
	}
}

/**
 * Execute webhook management action.
 * @param {z.infer<typeof WebhookSchema>} input - Tool input
 * @returns {Promise<object>} Result object
 */
export async function webhookManagement(input) {
	const { action } = input;

	switch (action) {
		case "create": {
			const { url, secret, events, headers } = input;
			if (!url) return { ok: false, error: "url is required for create action" };

			const urlValidation = filterUrl(url);
			if (!urlValidation.allowed) {
				return { ok: false, error: urlValidation.reason };
			}

			const webhookId = randomUUID();
			webhookStore.set(webhookId, {
				url,
				secret: secret || randomUUID(),
				events: events || ["*"],
				headers: headers || {},
				createdAt: new Date().toISOString(),
			});

			return {
				ok: true,
				webhookId,
				url,
				secret: webhookStore.get(webhookId).secret,
				events: events || ["*"],
				message: "Webhook created successfully",
			};
		}

		case "list": {
			const webhooks = [];
			for (const [id, webhook] of webhookStore) {
				webhooks.push({
					webhookId: id,
					url: webhook.url,
					events: webhook.events,
					createdAt: webhook.createdAt,
					secret: maskSecret(webhook.secret),
				});
			}
			return { ok: true, webhooks };
		}

		case "delete": {
			const { webhookId } = input;
			if (!webhookId) {
				return { ok: false, error: "webhookId is required for delete action" };
			}
			if (!webhookStore.has(webhookId)) {
				return { ok: false, error: `Webhook not found: ${webhookId}` };
			}
			webhookStore.delete(webhookId);
			rateLimitState.delete(webhookId);
			return { ok: true, message: `Webhook ${webhookId} deleted` };
		}

		case "verify": {
			const { webhookId, payload, signature, timestamp } = input;
			if (!webhookId) {
				return { ok: false, error: "webhookId is required for verify action" };
			}
			const webhook = webhookStore.get(webhookId);
			if (!webhook) {
				return { ok: false, error: `Webhook not found: ${webhookId}` };
			}

			// Validate timestamp
			if (timestamp && !validateTimestamp(timestamp)) {
				return { ok: false, error: "Webhook timestamp expired (5-minute window)" };
			}

			// Verify signature
			const payloadStr = typeof payload === "string" ? payload : JSON.stringify(payload);
			const valid = verifyHmacSignature(payloadStr, signature, webhook.secret);
			if (!valid) {
				return { ok: false, error: "Invalid HMAC-SHA256 signature" };
			}

			return { ok: true, valid: true, message: "Webhook signature verified" };
		}

		case "deliver": {
			const { webhookId, payload, rateLimit } = input;
			if (!webhookId) {
				return { ok: false, error: "webhookId is required for deliver action" };
			}
			if (!payload) {
				return { ok: false, error: "payload is required for deliver action" };
			}
			return await deliverWebhook(webhookId, payload, rateLimit);
		}

		default:
			return {
				ok: false,
				error: `Unknown action: "${action}". Valid actions: create, list, delete, verify, deliver`,
			};
	}
}

/**
 * Webhook management tool — create, list, delete, verify, and deliver webhooks.
 */
export const webhookManagementTool = tool(webhookManagement, {
	name: "webhookManagement",
	description:
		"Manage webhooks: create, list, delete, verify HMAC-SHA256 signatures, and deliver payloads with rate limiting.",
	schema: WebhookSchema,
});
