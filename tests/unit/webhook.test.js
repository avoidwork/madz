import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import { createHmac } from "node:crypto";
import { access, constants, copyFile, mkdir, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	createWebhook,
	listWebhooks,
	deleteWebhook,
	verifyWebhook,
} from "../../src/tools/webhook/index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const FIXTURE_FILE = join(__dirname, "../fixtures/webhooks.json");
const WEBHOOKS_FILE = join(__dirname, "../../memory/tools/webhooks.json");

describe("webhook tool", () => {
	const cleanup = async () => {
		try {
			await access(WEBHOOKS_FILE, constants.F_OK);
			await unlink(WEBHOOKS_FILE);
		} catch {
			// File doesn't exist, nothing to clean up
		}
	};

	before(async () => {
		const dir = join(__dirname, "../../memory/tools");
		await mkdir(dir, { recursive: true });
	});

	beforeEach(async () => {
		// Seed from fixture file for each test
		await copyFile(FIXTURE_FILE, WEBHOOKS_FILE);
	});
	after(async () => {
		await cleanup();
	});

	it("creates a webhook registration", async () => {
		const result = await createWebhook("https://example.com/webhook", "my-secret", [
			"push",
			"pull_request",
		]);
		assert.strictEqual(result.ok, true);
		assert.ok(result.data.id);
		assert.strictEqual(result.data.url, "https://example.com/webhook");
	});

	it("lists all registered webhooks", async () => {
		await createWebhook("https://example.com/webhook", "my-secret", ["push"]);
		const result = await listWebhooks();
		assert.strictEqual(result.ok, true);
		assert.ok(Array.isArray(result.data));
		assert.strictEqual(result.data.length, 1);
		assert.strictEqual(result.data[0].url, "https://example.com/webhook");
	});

	it("deletes a webhook by ID", async () => {
		const createResult = await createWebhook("https://example.com/webhook", "my-secret", ["push"]);
		const id = createResult.data.id;

		const result = await deleteWebhook(id);
		assert.strictEqual(result.ok, true);

		// Verify it's gone
		const listResult = await listWebhooks();
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

	it("rejects create with empty URL", async () => {
		const result = await createWebhook("", "my-secret", ["push"]);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("URL"));
	});

	it("rejects create with empty secret", async () => {
		const result = await createWebhook("https://example.com/webhook", "", ["push"]);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Secret"));
	});

	it("rejects create with invalid URL", async () => {
		const result = await createWebhook("not-a-url", "my-secret", ["push"]);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Invalid URL"));
	});

	it("rejects delete with missing ID", async () => {
		const result = await deleteWebhook(undefined);
		assert.strictEqual(result.ok, false);
	});

	it("rejects delete with non-existent ID", async () => {
		const result = await deleteWebhook("wh_nonexistent");
		assert.strictEqual(result.ok, false);
	});

	it("persists webhooks to disk", async () => {
		await cleanup();
		await createWebhook("https://example.com/webhook", "my-secret", ["push"]);

		const content = await readFile(WEBHOOKS_FILE, "utf-8");
		const webhooks = JSON.parse(content);
		assert.ok(Array.isArray(webhooks));
		assert.strictEqual(webhooks.length, 1);
		assert.strictEqual(webhooks[0].url, "https://example.com/webhook");
	});
});
