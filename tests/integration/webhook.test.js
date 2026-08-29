import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import { createServer } from "node:http";
import { createHmac } from "node:crypto";
import { access, constants, copyFile, mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import {
	createWebhook,
	listWebhooks,
	deleteWebhook,
	verifyWebhook,
} from "../../src/tools/webhook/index.js";
import { setTestMode } from "../../src/sandbox/urlFilter.js";

// Enable test mode to allow internal IPs in integration tests
setTestMode(true);

const __dirname = join(process.cwd(), "tests", "integration");
const FIXTURE_FILE = join(__dirname, "../fixtures/webhooks.json");
const TEST_DIR = join(process.cwd(), "memory/__test_webhooks__");
const WEBHOOKS_FILE = join(TEST_DIR, "webhooks.json");

describe("webhook integration tests", () => {
	let server;
	let port;
	let baseUrl;

	const webhookHandler = (req, res) => {
		let body = "";
		req.on("data", (chunk) => {
			body += chunk;
		});
		req.on("end", () => {
			const signature = req.headers["x-webhook-signature"];
			res.setHeader("Content-Type", "application/json");
			if (signature) {
				res.end(JSON.stringify({ received: true, signature, body }));
			} else {
				res.statusCode = 401;
				res.end(JSON.stringify({ error: "No signature" }));
			}
		});
	};

	before(async () => {
		server = createServer(webhookHandler);
		await new Promise((resolve) => {
			server.listen(0, "127.0.0.1", resolve);
		});
		const addr = server.address();
		port = addr.port;
		baseUrl = `http://127.0.0.1:${port}`;
		await mkdir(TEST_DIR, { recursive: true });
	});

	beforeEach(async () => {
		await copyFile(FIXTURE_FILE, WEBHOOKS_FILE);
	});

	after(async () => {
		await new Promise((resolve) => server.close(resolve));
		try {
			await access(WEBHOOKS_FILE, constants.F_OK);
			await unlink(WEBHOOKS_FILE);
		} catch {
			// File doesn't exist, nothing to clean up
		}
	});

	it("creates and verifies a webhook with valid signature", async () => {
		// Use impl function to bypass URL validation in integration tests
		const createResult = await createWebhook(`${baseUrl}/webhook`, "integration-secret", [
			"push",
			"pull_request",
		]);
		assert.strictEqual(createResult.ok, true);
		assert.ok(createResult.data.id);

		// Verify valid signature
		const payload = JSON.stringify({ event: "push", ref: "main" });
		const hmac = createHmac("sha256", "integration-secret");
		hmac.update(payload);
		const signature = "sha256=" + hmac.digest("hex");

		const verifyResult = verifyWebhook(payload, signature, "integration-secret");
		assert.strictEqual(verifyResult.ok, true);
		assert.strictEqual(verifyResult.data, true);
	});

	it("rejects webhook with invalid signature", async () => {
		await createWebhook(`${baseUrl}/webhook`, "integration-secret", ["push"]);

		// Verify with wrong signature
		const result = verifyWebhook(
			JSON.stringify({ event: "push" }),
			"sha256=wrong-signature",
			"integration-secret",
		);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data, false);
	});

	it("lists webhooks after creation", async () => {
		await createWebhook(`${baseUrl}/webhook`, "integration-secret", ["push"]);

		const listResult = await listWebhooks();
		assert.strictEqual(listResult.ok, true);
		assert.ok(Array.isArray(listResult.data));
		assert.ok(listResult.data.some((w) => w.url === `${baseUrl}/webhook`));
	});

	it("deletes webhook and verifies removal", async () => {
		const createResult = await createWebhook(`${baseUrl}/webhook`, "integration-secret", ["push"]);
		const id = createResult.data.id;

		const deleteResult = await deleteWebhook(id);
		assert.strictEqual(deleteResult.ok, true);

		const listResult = await listWebhooks();
		assert.strictEqual(listResult.ok, true);
		assert.ok(!listResult.data.some((w) => w.id === id));
	});
});
