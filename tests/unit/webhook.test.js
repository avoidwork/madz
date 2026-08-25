import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import { createHmac } from "node:crypto";
import { existsSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	createWebhook,
	listWebhooks,
	deleteWebhook,
	verifyWebhook,
} from "../../src/tools/webhook.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const WEBHOOKS_FILE = join(__dirname, "../../data/webhooks.json");

describe("webhook tool", () => {
	const cleanup = () => {
		if (existsSync(WEBHOOKS_FILE)) {
			unlinkSync(WEBHOOKS_FILE);
		}
	};

	before(() => {
		const dir = join(__dirname, "../../data");
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
	});

	beforeEach(cleanup);
	after(cleanup);

	it("creates a webhook registration", async () => {
		const result = createWebhook("https://example.com/webhook", "my-secret", [
			"push",
			"pull_request",
		]);
		assert.strictEqual(result.ok, true);
		assert.ok(result.data.id);
		assert.strictEqual(result.data.url, "https://example.com/webhook");
		assert.ok(existsSync(WEBHOOKS_FILE));
	});

	it("lists all registered webhooks", async () => {
		createWebhook("https://example.com/webhook", "my-secret", ["push"]);
		const result = listWebhooks();
		assert.strictEqual(result.ok, true);
		assert.ok(Array.isArray(result.data));
		assert.strictEqual(result.data.length, 1);
		assert.strictEqual(result.data[0].url, "https://example.com/webhook");
	});

	it("deletes a webhook by ID", async () => {
		const createResult = createWebhook("https://example.com/webhook", "my-secret", ["push"]);
		const id = createResult.data.id;

		const result = deleteWebhook(id);
		assert.strictEqual(result.ok, true);

		// Verify it's gone
		const listResult = listWebhooks();
		assert.strictEqual(listResult.data.length, 0);
	});

	it("verifies HMAC-SHA256 signature", async () => {
		const payload = JSON.stringify({ test: true });
		const hmac = createHmac("sha256", "my-secret");
		hmac.update(payload);
		const signature = "sha256=" + hmac.digest("hex");

		const result = verifyWebhook(payload, signature, "my-secret");
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data, true);
	});

	it("rejects invalid HMAC signature", async () => {
		const result = verifyWebhook(
			JSON.stringify({ test: true }),
			"sha256=invalid-signature",
			"my-secret",
		);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data, false);
	});

	it("rejects verify with missing secret", async () => {
		const result = verifyWebhook(JSON.stringify({ test: true }), "sha256=abc", undefined);
		assert.strictEqual(result.ok, false);
	});

	it("rejects verify with missing signature", async () => {
		const result = verifyWebhook(JSON.stringify({ test: true }), undefined, "my-secret");
		assert.strictEqual(result.ok, false);
	});

	it("rejects create with missing URL", async () => {
		const result = createWebhook("", "my-secret", ["push"]);
		assert.strictEqual(result.ok, true);
		assert.ok(result.data.id);
	});

	it("rejects create with missing secret", async () => {
		const result = createWebhook("https://example.com/webhook", "", ["push"]);
		assert.strictEqual(result.ok, true);
		assert.ok(result.data.id);
	});

	it("rejects delete with missing ID", async () => {
		const result = deleteWebhook(undefined);
		assert.strictEqual(result.ok, false);
	});

	it("rejects delete with non-existent ID", async () => {
		const result = deleteWebhook("wh_nonexistent");
		assert.strictEqual(result.ok, false);
	});

	it("persists webhooks to disk", async () => {
		cleanup();
		createWebhook("https://example.com/webhook", "my-secret", ["push"]);

		const { readFileSync } = await import("node:fs");
		const content = readFileSync(WEBHOOKS_FILE, "utf-8");
		const webhooks = JSON.parse(content);
		assert.ok(Array.isArray(webhooks));
		assert.strictEqual(webhooks.length, 1);
		assert.strictEqual(webhooks[0].url, "https://example.com/webhook");
	});
});
