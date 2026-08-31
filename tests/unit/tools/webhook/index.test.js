/**
 * Tests for the webhook module.
 * @see {@link src/tools/webhook/index.js}
 */

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
	webhookManagement,
	webhookManagementImpl,
	createWebhookTool,
} from "../../../../src/tools/webhook/index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const FIXTURE_FILE = join(__dirname, "../../../fixtures/webhooks.json");
// Source code resolves WEBHOOKS_FILE relative to src/tools/webhook/index.js
// which is at memory/tools/webhooks.json from project root
const PROJECT_ROOT = join(__dirname, "../../../..");
const WEBHOOKS_FILE = join(PROJECT_ROOT, "memory/tools/webhooks.json");

describe("webhook module", () => {
	const cleanup = async () => {
		try {
			await access(WEBHOOKS_FILE, constants.F_OK);
			await unlink(WEBHOOKS_FILE);
		} catch {
			// File doesn't exist, nothing to clean up
		}
	};

	before(async () => {
		const dir = join(__dirname, "../../../memory/tools");
		await mkdir(dir, { recursive: true });
	});

	beforeEach(async () => {
		// Seed from fixture file for each test
		await copyFile(FIXTURE_FILE, WEBHOOKS_FILE);
	});
	after(async () => {
		await cleanup();
	});

	describe("createWebhook", () => {
		it("creates a webhook registration", async () => {
			const result = await createWebhook("https://example.com/webhook", "my-secret", [
				"push",
				"pull_request",
			]);
			assert.strictEqual(result.ok, true);
			assert.ok(result.data.id);
			assert.strictEqual(result.data.url, "https://example.com/webhook");
			assert.strictEqual(result.data.secret, "my-secret");
			assert.deepStrictEqual(result.data.events, ["push", "pull_request"]);
			assert.strictEqual(result.data.active, true);
			assert.ok(result.data.createdAt);
			assert.ok(result.data.updatedAt);
		});

		it("defaults events to ['*'] when not provided", async () => {
			const result = await createWebhook("https://example.com/webhook", "my-secret");
			assert.strictEqual(result.ok, true);
			assert.deepStrictEqual(result.data.events, ["*"]);
		});

		it("rejects create with empty URL", async () => {
			const result = await createWebhook("", "my-secret", ["push"]);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("URL"));
		});

		it("rejects create with whitespace-only URL", async () => {
			const result = await createWebhook("   ", "my-secret", ["push"]);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("URL"));
		});

		it("rejects create with empty secret", async () => {
			const result = await createWebhook("https://example.com/webhook", "", ["push"]);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("Secret"));
		});

		it("rejects create with whitespace-only secret", async () => {
			const result = await createWebhook("https://example.com/webhook", "   ", ["push"]);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("Secret"));
		});

		it("rejects create with invalid URL", async () => {
			const result = await createWebhook("not-a-url", "my-secret", ["push"]);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("Invalid URL"));
		});

		it("rejects create with non-string URL", async () => {
			const result = await createWebhook(123, "my-secret", ["push"]);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("URL"));
		});

		it("rejects create with non-string secret", async () => {
			const result = await createWebhook("https://example.com/webhook", 123, ["push"]);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("Secret"));
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

		it("generates unique IDs", async () => {
			const result1 = await createWebhook("https://example.com/webhook1", "secret1");
			const result2 = await createWebhook("https://example.com/webhook2", "secret2");
			assert.notStrictEqual(result1.data.id, result2.data.id);
		});
	});

	describe("listWebhooks", () => {
		it("lists all registered webhooks", async () => {
			await createWebhook("https://example.com/webhook", "my-secret", ["push"]);
			const result = await listWebhooks();
			assert.strictEqual(result.ok, true);
			assert.ok(Array.isArray(result.data));
			assert.strictEqual(result.data.length, 1);
			assert.strictEqual(result.data[0].url, "https://example.com/webhook");
		});

		it("excludes secrets when includeSecret is false", async () => {
			await createWebhook("https://example.com/webhook", "my-secret", ["push"]);
			const result = await listWebhooks(false);
			assert.ok(!result.data[0].hasOwnProperty("secret"));
		});

		it("includes secrets when includeSecret is true", async () => {
			await createWebhook("https://example.com/webhook", "my-secret", ["push"]);
			const result = await listWebhooks(true);
			assert.strictEqual(result.data[0].secret, "my-secret");
		});

		it("returns empty array when no webhooks exist", async () => {
			await cleanup();
			const result = await listWebhooks();
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.data.length, 0);
		});

		it("lists multiple webhooks", async () => {
			await createWebhook("https://example.com/a", "secret-a");
			await createWebhook("https://example.com/b", "secret-b");
			const result = await listWebhooks();
			assert.strictEqual(result.data.length, 2);
		});
	});

	describe("deleteWebhook", () => {
		it("deletes a webhook by ID", async () => {
			const createResult = await createWebhook("https://example.com/webhook", "my-secret", [
				"push",
			]);
			const id = createResult.data.id;

			const result = await deleteWebhook(id);
			assert.strictEqual(result.ok, true);

			// Verify it's gone
			const listResult = await listWebhooks();
			assert.strictEqual(listResult.data.length, 0);
		});

		it("rejects delete with non-existent ID", async () => {
			const result = await deleteWebhook("wh_nonexistent_12345");
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("not found"));
		});

		it("rejects delete with undefined ID", async () => {
			const result = await deleteWebhook(undefined);
			assert.strictEqual(result.ok, false);
		});

		it("rejects delete with null ID", async () => {
			const result = await deleteWebhook(null);
			assert.strictEqual(result.ok, false);
		});

		it("rejects delete with numeric ID", async () => {
			const result = await deleteWebhook(123);
			assert.strictEqual(result.ok, false);
		});
	});

	describe("verifyWebhook", () => {
		it("verifies HMAC-SHA256 signature", async () => {
			const payload = JSON.stringify({ test: true });
			const hmac = createHmac("sha256", "my-secret");
			hmac.update(payload);
			const signature = "sha256=" + hmac.digest("hex");

			const result = verifyWebhook(payload, signature, "my-secret");
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.data, true);
		});

		it("verifies HMAC-SHA256 signature without prefix", async () => {
			const payload = JSON.stringify({ test: true });
			const hmac = createHmac("sha256", "my-secret");
			hmac.update(payload);
			const signature = hmac.digest("hex");

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

		it("rejects verify with missing payload", async () => {
			const result = verifyWebhook(undefined, "sha256=abc", "my-secret");
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("required"));
		});

		it("rejects verify with missing signature", async () => {
			const result = verifyWebhook(JSON.stringify({ test: true }), undefined, "my-secret");
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("required"));
		});

		it("rejects verify with missing secret", async () => {
			const result = verifyWebhook(JSON.stringify({ test: true }), "sha256=abc", undefined);
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("required"));
		});

		it("rejects verify with empty payload", async () => {
			const result = verifyWebhook("", "sha256=abc", "my-secret");
			assert.strictEqual(result.ok, false);
		});

		it("rejects verify with empty signature", async () => {
			const result = verifyWebhook("payload", "", "my-secret");
			assert.strictEqual(result.ok, false);
		});

		it("rejects verify with empty secret", async () => {
			const result = verifyWebhook("payload", "sha256=abc", "");
			assert.strictEqual(result.ok, false);
		});

		it("returns false for length mismatch", async () => {
			// Create a signature with different length than expected
			const payload = "test payload";
			const signature = "sha256=short";
			const result = verifyWebhook(payload, signature, "my-secret");
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.data, false);
		});

		it("handles timing-safe comparison", async () => {
			const payload = JSON.stringify({ test: true });
			const hmac = createHmac("sha256", "my-secret");
			hmac.update(payload);
			const correctSig = hmac.digest("hex");

			// Use a signature of same length but different value
			const wrongSig = correctSig
				.split("")
				.map((c) => (c === "a" ? "b" : "a"))
				.join("");

			const result = verifyWebhook(payload, "sha256=" + wrongSig, "my-secret");
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.data, false);
		});
	});

	describe("webhookManagement", () => {
		it("rejects invalid JSON input", async () => {
			const result = await webhookManagement("not json");
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("Invalid JSON"));
		});

		it("delegates to webhookManagementImpl", async () => {
			const result = await webhookManagement(
				JSON.stringify({ action: "list" }),
			);
			assert.strictEqual(result.ok, true);
			assert.ok(Array.isArray(result.data));
		});
	});

	describe("webhookManagementImpl", () => {
		it("rejects invalid input schema", async () => {
			const result = await webhookManagementImpl({
				action: "create",
				url: "not-a-url",
				secret: "test",
			});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("Invalid input"));
		});

		it("rejects create with missing URL", async () => {
			const result = await webhookManagementImpl({
				action: "create",
				secret: "test",
			});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("URL is required"));
		});

		it("rejects create with missing secret", async () => {
			const result = await webhookManagementImpl({
				action: "create",
				url: "https://example.com/webhook",
			});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("Secret is required"));
		});

		it("performs create action", async () => {
			const result = await webhookManagementImpl({
				action: "create",
				url: "https://example.com/webhook",
				secret: "test-secret",
				events: ["push"],
			});
			assert.strictEqual(result.ok, true);
			assert.ok(result.data.id);
			assert.strictEqual(result.data.url, "https://example.com/webhook");
		});

		it("performs list action", async () => {
			const result = await webhookManagementImpl({ action: "list" });
			assert.strictEqual(result.ok, true);
			assert.ok(Array.isArray(result.data));
		});

		it("rejects delete with missing ID", async () => {
			const result = await webhookManagementImpl({ action: "delete" });
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("ID is required"));
		});

		it("performs delete action", async () => {
			const createResult = await createWebhook(
				"https://example.com/webhook",
				"test-secret",
			);
			const result = await webhookManagementImpl({
				action: "delete",
				id: createResult.data.id,
			});
			assert.strictEqual(result.ok, true);
		});

		it("rejects verify with missing payload", async () => {
			const result = await webhookManagementImpl({
				action: "verify",
				signature: "sha256=abc",
				secret: "test",
			});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("Payload is required"));
		});

		it("rejects verify with missing signature", async () => {
			const result = await webhookManagementImpl({
				action: "verify",
				payload: "test",
				secret: "test",
			});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("Signature is required"));
		});

		it("rejects verify with missing secret", async () => {
			const result = await webhookManagementImpl({
				action: "verify",
				payload: "test",
				signature: "sha256=abc",
			});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("Secret is required"));
		});

		it("performs verify action", async () => {
			const payload = JSON.stringify({ test: true });
			const hmac = createHmac("sha256", "my-secret");
			hmac.update(payload);
			const signature = "sha256=" + hmac.digest("hex");

			const result = await webhookManagementImpl({
				action: "verify",
				payload,
				signature,
				secret: "my-secret",
			});
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.data, true);
		});
	});

	describe("createWebhookTool", () => {
		it("returns a LangChain tool instance", () => {
			const result = createWebhookTool();
			assert.ok(result);
			assert.strictEqual(result.name, "webhook");
			assert.ok(typeof result.description === "string");
			assert.ok(result.description.length > 0);
		});

		it("has a schema with action enum", () => {
			const tool = createWebhookTool();
			assert.ok(tool.schema);
		});
	});
});
