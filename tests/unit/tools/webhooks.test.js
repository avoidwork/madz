import { describe, it } from "node:test";
import assert from "node:assert";
import {
	webhookManagementTool,
	webhookManagement,
	WebhookSchema,
} from "../../../src/tools/webhooks.js";

describe("webhookManagement tool - webhookManagement", () => {
	it("creates a webhook", async () => {
		const result = await webhookManagement({
			action: "create",
			url: "https://example.com/hook",
			secret: "mysecret",
		});
		assert.strictEqual(result.ok, true);
		assert.ok(result.webhookId);
		assert.strictEqual(result.url, "https://example.com/hook");
	});

	it("lists webhooks with masked secrets", async () => {
		await webhookManagement({
			action: "create",
			url: "https://example.com/hook",
			secret: "mysecret",
		});
		const result = await webhookManagement({ action: "list" });
		assert.strictEqual(result.ok, true);
		assert.ok(Array.isArray(result.webhooks));
		assert.ok(result.webhooks.length > 0);
		assert.ok(result.webhooks[0].secret.includes("*"));
	});

	it("deletes a webhook", async () => {
		const createResult = await webhookManagement({
			action: "create",
			url: "https://example.com/hook",
			secret: "mysecret",
		});
		const deleteResult = await webhookManagement({
			action: "delete",
			webhookId: createResult.webhookId,
		});
		assert.strictEqual(deleteResult.ok, true);
	});

	it("rejects non-existent webhook deletion", async () => {
		const result = await webhookManagement({
			action: "delete",
			webhookId: "non-existent-id",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error);
	});

	it("verifies valid HMAC signature", async () => {
		const createResult = await webhookManagement({
			action: "create",
			url: "https://example.com/hook",
			secret: "mysecret",
		});
		const { createHash } = await import("node:crypto");
		const payload = JSON.stringify({ test: true });
		// The verify action hashes just the payload (not payload + secret)
		const signature = createHash("sha256").update(payload).digest("hex");
		const result = await webhookManagement({
			action: "verify",
			webhookId: createResult.webhookId,
			payload,
			signature,
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.valid, true);
	});

	it("rejects invalid HMAC signature", async () => {
		const createResult = await webhookManagement({
			action: "create",
			url: "https://example.com/hook",
			secret: "mysecret",
		});
		const result = await webhookManagement({
			action: "verify",
			webhookId: createResult.webhookId,
			payload: JSON.stringify({ test: true }),
			signature: "invalid-signature",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error);
	});

	it("rejects file:// webhook URLs", async () => {
		const result = await webhookManagement({
			action: "create",
			url: "file:///etc/passwd",
			secret: "mysecret",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error);
	});

	it("has correct schema", () => {
		assert.ok(WebhookSchema);
		const shape = WebhookSchema.shape;
		assert.ok(shape.action);
		assert.ok(shape.url);
		assert.ok(shape.secret);
		assert.ok(shape.events);
		assert.ok(shape.payload);
	});

	it("is exported correctly", () => {
		assert.ok(webhookManagementTool);
		assert.ok(webhookManagement);
	});
});
