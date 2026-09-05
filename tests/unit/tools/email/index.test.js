import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import {
	createEmailProvider,
	getActiveProvider,
	validateProviderConfig,
	EmailProvider,
	GmailProvider,
	GraphProvider,
	ImapProvider,
} from "../../../../src/tools/email/index.js";

describe("Email Tools — index exports", () => {
	test("should export createEmailProvider function", () => {
		assert.strictEqual(typeof createEmailProvider, "function");
	});

	test("should export getActiveProvider function", () => {
		assert.strictEqual(typeof getActiveProvider, "function");
	});

	test("should export validateProviderConfig function", () => {
		assert.strictEqual(typeof validateProviderConfig, "function");
	});

	test("should export EmailProvider class", () => {
		assert.strictEqual(typeof EmailProvider, "function");
	});

	test("should export GmailProvider class", () => {
		assert.strictEqual(typeof GmailProvider, "function");
	});

	test("should export GraphProvider class", () => {
		assert.strictEqual(typeof GraphProvider, "function");
	});

	test("should export ImapProvider class", () => {
		assert.strictEqual(typeof ImapProvider, "function");
	});
});

describe("createEmailProvider", () => {
	test("throws when config is missing", () => {
		assert.throws(() => createEmailProvider(), /Email provider config required/);
	});

	test("throws when config type is missing", () => {
		assert.throws(() => createEmailProvider({}), /Email provider config required/);
	});

	test("creates GmailProvider for gmail type", () => {
		process.env.EMAIL_GMAIL_CLIENT_ID = "test-id";
		process.env.EMAIL_GMAIL_CLIENT_SECRET = "test-secret";
		process.env.EMAIL_GMAIL_REFRESH_TOKEN = "test-token";
		const provider = createEmailProvider({ type: "gmail" });
		assert.ok(provider instanceof GmailProvider);
	});

	test("creates GraphProvider for graph type", () => {
		process.env.EMAIL_GRAPH_CLIENT_ID = "test-id";
		process.env.EMAIL_GRAPH_CLIENT_SECRET = "test-secret";
		process.env.EMAIL_GRAPH_REFRESH_TOKEN = "test-token";
		process.env.EMAIL_GRAPH_TENANT_ID = "test-tenant";
		const provider = createEmailProvider({ type: "graph" });
		assert.ok(provider instanceof GraphProvider);
	});

	test("creates ImapProvider for imap type", () => {
		process.env.EMAIL_IMAP_USER = "test-user";
		process.env.EMAIL_IMAP_PASSWORD = "test-pass";
		const provider = createEmailProvider({ type: "imap" });
		assert.ok(provider instanceof ImapProvider);
	});

	test("throws for unknown provider type", () => {
		assert.throws(
			() => createEmailProvider({ type: "unknown" }),
			/Unknown email provider type/,
		);
	});
});

describe("getActiveProvider", () => {
	test("returns null when config is missing", () => {
		assert.strictEqual(getActiveProvider(), null);
	});

	test("returns null when config.email is missing", () => {
		assert.strictEqual(getActiveProvider({}), null);
	});

	test("returns null when config.email.provider is missing", () => {
		assert.strictEqual(getActiveProvider({ email: {} }), null);
	});

	test("returns null when provider creation fails", () => {
		const result = getActiveProvider({ email: { provider: { type: "unknown" } } });
		assert.strictEqual(result, null);
	});

	test("returns a provider instance when config is valid", () => {
		process.env.EMAIL_GMAIL_CLIENT_ID = "test-id";
		process.env.EMAIL_GMAIL_CLIENT_SECRET = "test-secret";
		process.env.EMAIL_GMAIL_REFRESH_TOKEN = "test-token";
		const result = getActiveProvider({ email: { provider: { type: "gmail" } } });
		assert.ok(result instanceof GmailProvider);
	});
});

describe("validateProviderConfig", () => {
	let origEnv = {};

	before(() => {
		// Save original env vars
		origEnv = {
			EMAIL_GMAIL_CLIENT_ID: process.env.EMAIL_GMAIL_CLIENT_ID,
			EMAIL_GMAIL_CLIENT_SECRET: process.env.EMAIL_GMAIL_CLIENT_SECRET,
			EMAIL_GMAIL_REFRESH_TOKEN: process.env.EMAIL_GMAIL_REFRESH_TOKEN,
			EMAIL_GRAPH_CLIENT_ID: process.env.EMAIL_GRAPH_CLIENT_ID,
			EMAIL_GRAPH_CLIENT_SECRET: process.env.EMAIL_GRAPH_CLIENT_SECRET,
			EMAIL_GRAPH_REFRESH_TOKEN: process.env.EMAIL_GRAPH_REFRESH_TOKEN,
			EMAIL_GRAPH_TENANT_ID: process.env.EMAIL_GRAPH_TENANT_ID,
			EMAIL_IMAP_USER: process.env.EMAIL_IMAP_USER,
			EMAIL_IMAP_PASSWORD: process.env.EMAIL_IMAP_PASSWORD,
		};
		// Clear all email env vars
		delete process.env.EMAIL_GMAIL_CLIENT_ID;
		delete process.env.EMAIL_GMAIL_CLIENT_SECRET;
		delete process.env.EMAIL_GMAIL_REFRESH_TOKEN;
		delete process.env.EMAIL_GRAPH_CLIENT_ID;
		delete process.env.EMAIL_GRAPH_CLIENT_SECRET;
		delete process.env.EMAIL_GRAPH_REFRESH_TOKEN;
		delete process.env.EMAIL_GRAPH_TENANT_ID;
		delete process.env.EMAIL_IMAP_USER;
		delete process.env.EMAIL_IMAP_PASSWORD;
	});

	after(() => {
		// Restore original env vars
		for (const [key, value] of Object.entries(origEnv)) {
			if (value !== undefined) {
				process.env[key] = value;
			} else {
				delete process.env[key];
			}
		}
	});

	test("returns error when config is missing", () => {
		const result = validateProviderConfig();
		assert.strictEqual(result.valid, false);
		assert.ok(result.errors.length > 0);
	});

	test("returns error when config type is missing", () => {
		const result = validateProviderConfig({});
		assert.strictEqual(result.valid, false);
		assert.ok(result.errors.length > 0);
	});

	test("returns errors for gmail when env vars are missing", () => {
		const result = validateProviderConfig({ type: "gmail" });
		assert.strictEqual(result.valid, false);
		assert.ok(result.errors.length >= 3);
		assert.ok(result.errors.some((e) => e.includes("EMAIL_GMAIL_CLIENT_ID")));
		assert.ok(result.errors.some((e) => e.includes("EMAIL_GMAIL_CLIENT_SECRET")));
		assert.ok(result.errors.some((e) => e.includes("EMAIL_GMAIL_REFRESH_TOKEN")));
	});

	test("returns errors for graph when env vars are missing", () => {
		const result = validateProviderConfig({ type: "graph" });
		assert.strictEqual(result.valid, false);
		assert.ok(result.errors.length >= 4);
		assert.ok(result.errors.some((e) => e.includes("EMAIL_GRAPH_CLIENT_ID")));
		assert.ok(result.errors.some((e) => e.includes("EMAIL_GRAPH_CLIENT_SECRET")));
		assert.ok(result.errors.some((e) => e.includes("EMAIL_GRAPH_REFRESH_TOKEN")));
		assert.ok(result.errors.some((e) => e.includes("EMAIL_GRAPH_TENANT_ID")));
	});

	test("returns errors for imap when env vars are missing", () => {
		const result = validateProviderConfig({ type: "imap" });
		assert.strictEqual(result.valid, false);
		assert.ok(result.errors.length >= 2);
		assert.ok(result.errors.some((e) => e.includes("EMAIL_IMAP_USER")));
		assert.ok(result.errors.some((e) => e.includes("EMAIL_IMAP_PASSWORD")));
	});

	test("returns error for unknown provider type", () => {
		const result = validateProviderConfig({ type: "unknown" });
		assert.strictEqual(result.valid, false);
		assert.ok(result.errors.some((e) => e.includes("Unknown provider type")));
	});

	test("returns valid for gmail when all env vars are set", () => {
		process.env.EMAIL_GMAIL_CLIENT_ID = "test-id";
		process.env.EMAIL_GMAIL_CLIENT_SECRET = "test-secret";
		process.env.EMAIL_GMAIL_REFRESH_TOKEN = "test-token";
		const result = validateProviderConfig({ type: "gmail" });
		assert.strictEqual(result.valid, true);
	});

	test("returns valid for graph when all env vars are set", () => {
		process.env.EMAIL_GRAPH_CLIENT_ID = "test-id";
		process.env.EMAIL_GRAPH_CLIENT_SECRET = "test-secret";
		process.env.EMAIL_GRAPH_REFRESH_TOKEN = "test-token";
		process.env.EMAIL_GRAPH_TENANT_ID = "test-tenant";
		const result = validateProviderConfig({ type: "graph" });
		assert.strictEqual(result.valid, true);
	});

	test("returns valid for imap when all env vars are set", () => {
		process.env.EMAIL_IMAP_USER = "test-user";
		process.env.EMAIL_IMAP_PASSWORD = "test-pass";
		const result = validateProviderConfig({ type: "imap" });
		assert.strictEqual(result.valid, true);
	});
});