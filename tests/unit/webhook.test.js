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

	it("lists webhooks with includeSecret=true", async () => {
		await createWebhook("https://example.com/webhook", "my-secret", ["push"]);
		const result = await listWebhooks(true);
		assert.strictEqual(result.ok, true);
		assert.ok(Array.isArray(result.data));
		assert.ok(result.data[0].secret !== undefined);
	});

	it("rejects verify with missing payload", async () => {
		const result = verifyWebhook(undefined, "sha256=abc", "my-secret");
		assert.strictEqual(result.ok, false);
	});

	it("handles verify with length mismatch (constant-time comparison)", async () => {
		const payload = JSON.stringify({ test: true });
		// Use a signature with "sha256=" prefix removed — same length as expected
		const hmac = createHmac("sha256", "my-secret");
		hmac.update(payload);
		const fullSignature = "sha256=" + hmac.digest("hex");
		// Truncate to make length mismatch
		const shortSignature = fullSignature.slice(0, 10);
		const result = verifyWebhook(payload, shortSignature, "my-secret");
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data, false);
	});

	it("creates webhook with default events when none provided", async () => {
		const result = await createWebhook("https://example.com/webhook", "my-secret");
		assert.strictEqual(result.ok, true);
		assert.deepStrictEqual(result.data.events, ["*"]);
	});
});

describe("webhookManagement (JSON string wrapper)", () => {
	beforeEach(async () => {
		const dir = join(__dirname, "../../memory/tools");
		await mkdir(dir, { recursive: true });
	});

	it("parses valid JSON input and delegates to impl", async () => {
		const { webhookManagement } = await import("../../src/tools/webhook/index.js");
		const result = await webhookManagement(JSON.stringify({
			action: "list",
		}));
		assert.strictEqual(result.ok, true);
		assert.ok(Array.isArray(result.data));
	});

	it("returns error for invalid JSON input", async () => {
		const { webhookManagement } = await import("../../src/tools/webhook/index.js");
		const result = await webhookManagement("not-json");
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Invalid JSON"));
	});
});

describe("webhookManagementImpl", () => {
	beforeEach(async () => {
		const dir = join(__dirname, "../../memory/tools");
		await mkdir(dir, { recursive: true });
	});

	it("validates input schema and returns error for invalid input", async () => {
		const { webhookManagementImpl } = await import("../../src/tools/webhook/index.js");
		const result = await webhookManagementImpl({ action: "invalid" });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Invalid input"));
	});

	it("handles create action with missing URL", async () => {
		const { webhookManagementImpl } = await import("../../src/tools/webhook/index.js");
		const result = await webhookManagementImpl({ action: "create", secret: "s" });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("URL"));
	});

	it("handles create action with missing secret", async () => {
		const { webhookManagementImpl } = await import("../../src/tools/webhook/index.js");
		const result = await webhookManagementImpl({ action: "create", url: "https://example.com/w" });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Secret"));
	});

	it("handles create action successfully", async () => {
		const { webhookManagementImpl } = await import("../../src/tools/webhook/index.js");
		const result = await webhookManagementImpl({
			action: "create",
			url: "https://example.com/webhook",
			secret: "my-secret",
			events: ["push"],
		});
		assert.strictEqual(result.ok, true);
	});

	it("handles list action", async () => {
		const { webhookManagementImpl } = await import("../../src/tools/webhook/index.js");
		const result = await webhookManagementImpl({ action: "list" });
		assert.strictEqual(result.ok, true);
		assert.ok(Array.isArray(result.data));
	});

	it("handles delete action with missing ID", async () => {
		const { webhookManagementImpl } = await import("../../src/tools/webhook/index.js");
		const result = await webhookManagementImpl({ action: "delete" });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("ID"));
	});

	it("handles delete action successfully", async () => {
		const { webhookManagementImpl } = await import("../../src/tools/webhook/index.js");
		const createResult = await webhookManagementImpl({
			action: "create",
			url: "https://example.com/webhook",
			secret: "my-secret",
		});
		const id = createResult.data.id;
		const result = await webhookManagementImpl({ action: "delete", id });
		assert.strictEqual(result.ok, true);
	});

	it("handles verify action with missing payload", async () => {
		const { webhookManagementImpl } = await import("../../src/tools/webhook/index.js");
		const result = await webhookManagementImpl({
			action: "verify",
			signature: "sha256=abc",
			secret: "my-secret",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Payload"));
	});

	it("handles verify action with missing signature", async () => {
		const { webhookManagementImpl } = await import("../../src/tools/webhook/index.js");
		const result = await webhookManagementImpl({
			action: "verify",
			payload: "test",
			secret: "my-secret",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Signature"));
	});

	it("handles verify action with missing secret", async () => {
		const { webhookManagementImpl } = await import("../../src/tools/webhook/index.js");
		const result = await webhookManagementImpl({
			action: "verify",
			payload: "test",
			signature: "sha256=abc",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Secret"));
	});

	it("handles verify action successfully", async () => {
		const { webhookManagementImpl } = await import("../../src/tools/webhook/index.js");
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
	beforeEach(async () => {
		const dir = join(__dirname, "../../memory/tools");
		await mkdir(dir, { recursive: true });
	});

	it("creates a LangChain tool with correct name and schema", async () => {
		const { createWebhookTool } = await import("../../src/tools/webhook/index.js");
		const tool = createWebhookTool();
		assert.strictEqual(tool.name, "webhook");
		assert.ok(tool.description);
		assert.ok(tool.schema);
	});

	it("invokes the tool and returns JSON result", async () => {
		const { createWebhookTool } = await import("../../src/tools/webhook/index.js");
		const tool = createWebhookTool();
		const result = await tool.invoke({ action: "list" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
	});
});
