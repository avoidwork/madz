import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import {
	createEmailProvider,
	getActiveProvider,
	validateProviderConfig,
} from "../../../../src/tools/email/index.js";
import { GmailProvider } from "../../../../src/tools/email/providers/gmail.js";
import { GraphProvider } from "../../../../src/tools/email/providers/graph.js";
import { ImapProvider } from "../../../../src/tools/email/providers/imap.js";

// Set required env vars for provider constructors
before(() => {
	process.env.EMAIL_GMAIL_CLIENT_ID = "test-client-id";
	process.env.EMAIL_GMAIL_CLIENT_SECRET = "test-client-secret";
	process.env.EMAIL_GMAIL_REFRESH_TOKEN = "test-refresh-token";
	process.env.EMAIL_GRAPH_CLIENT_ID = "test-client-id";
	process.env.EMAIL_GRAPH_CLIENT_SECRET = "test-client-secret";
	process.env.EMAIL_GRAPH_REFRESH_TOKEN = "test-refresh-token";
	process.env.EMAIL_GRAPH_TENANT_ID = "test-tenant-id";
	process.env.EMAIL_IMAP_USER = "test-user";
	process.env.EMAIL_IMAP_PASSWORD = "test-pass";
});

after(() => {
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

describe("createEmailProvider factory", () => {
	test("should create a GmailProvider when type is gmail", () => {
		const provider = createEmailProvider({
			type: "gmail",
		});
		assert.ok(provider instanceof GmailProvider);
		assert.strictEqual(provider.type, "gmail");
	});

	test("should create a GraphProvider when type is graph", () => {
		const provider = createEmailProvider({
			type: "graph",
		});
		assert.ok(provider instanceof GraphProvider);
		assert.strictEqual(provider.type, "graph");
	});

	test("should create an ImapProvider when type is imap", () => {
		const provider = createEmailProvider({
			type: "imap",
		});
		assert.ok(provider instanceof ImapProvider);
		assert.strictEqual(provider.type, "imap");
	});

	test("should throw for unknown provider type", () => {
		assert.throws(
			() => createEmailProvider({ type: "outlook" }),
			/Unknown email provider type: outlook/,
		);
	});

	test("should throw when config is null", () => {
		assert.throws(() => createEmailProvider(null), /Email provider config required/);
	});

	test("should throw when config is undefined", () => {
		assert.throws(() => createEmailProvider(undefined), /Email provider config required/);
	});

	test("should throw when config has no type", () => {
		assert.throws(() => createEmailProvider({ clientId: "id" }), /Email provider config required/);
	});

	test("should pass userId to GmailProvider when provided", () => {
		const provider = createEmailProvider({
			type: "gmail",
			userId: "user@example.com",
		});
		assert.ok(provider instanceof GmailProvider);
	});

	test("should default userId to 'me' for GmailProvider", () => {
		const provider = createEmailProvider({
			type: "gmail",
		});
		assert.ok(provider instanceof GmailProvider);
	});

	test("should pass accessToken to GmailProvider when provided", () => {
		const provider = createEmailProvider({
			type: "gmail",
			accessToken: "access-token",
		});
		assert.ok(provider instanceof GmailProvider);
	});

	test("should pass accessToken to GraphProvider when provided", () => {
		const provider = createEmailProvider({
			type: "graph",
			accessToken: "access-token",
		});
		assert.ok(provider instanceof GraphProvider);
	});
});

describe("getActiveProvider", () => {
	test("should return null when config is null", () => {
		const result = getActiveProvider(null);
		assert.strictEqual(result, null);
	});

	test("should return null when config has no email section", () => {
		const result = getActiveProvider({});
		assert.strictEqual(result, null);
	});

	test("should return null when email config has no provider", () => {
		const result = getActiveProvider({ email: {} });
		assert.strictEqual(result, null);
	});

	test("should return null when provider config is invalid", () => {
		const result = getActiveProvider({ email: { provider: { type: "invalid" } } });
		assert.strictEqual(result, null);
	});

	test("should return a GmailProvider when config is valid", () => {
		const result = getActiveProvider({
			email: {
				provider: {
					type: "gmail",
				},
			},
		});
		assert.ok(result instanceof GmailProvider);
	});

	test("should return a GraphProvider when config is valid", () => {
		const result = getActiveProvider({
			email: {
				provider: {
					type: "graph",
				},
			},
		});
		assert.ok(result instanceof GraphProvider);
	});

	test("should return an ImapProvider when config is valid", () => {
		const result = getActiveProvider({
			email: {
				provider: {
					type: "imap",
				},
			},
		});
		assert.ok(result instanceof ImapProvider);
	});
});

describe("validateProviderConfig", () => {
	test("should return valid for complete Gmail config", () => {
		const result = validateProviderConfig({
			type: "gmail",
		});
		assert.strictEqual(result.valid, true);
		assert.strictEqual(result.errors, undefined);
	});

	test("should return valid for complete Graph config", () => {
		const result = validateProviderConfig({
			type: "graph",
		});
		assert.strictEqual(result.valid, true);
		assert.strictEqual(result.errors, undefined);
	});

	test("should return valid for complete IMAP config", () => {
		const result = validateProviderConfig({
			type: "imap",
		});
		assert.strictEqual(result.valid, true);
		assert.strictEqual(result.errors, undefined);
	});

	test("should return invalid when config is null", () => {
		const result = validateProviderConfig(null);
		assert.strictEqual(result.valid, false);
		assert.ok(result.errors);
		assert.ok(result.errors.length > 0);
	});

	test("should return invalid when config has no type", () => {
		const result = validateProviderConfig({});
		assert.strictEqual(result.valid, false);
		assert.ok(result.errors);
	});

	test("should return errors for missing Gmail env vars", () => {
		// Temporarily clear the env vars
		const origId = process.env.EMAIL_GMAIL_CLIENT_ID;
		const origSecret = process.env.EMAIL_GMAIL_CLIENT_SECRET;
		const origRefresh = process.env.EMAIL_GMAIL_REFRESH_TOKEN;
		delete process.env.EMAIL_GMAIL_CLIENT_ID;
		delete process.env.EMAIL_GMAIL_CLIENT_SECRET;
		delete process.env.EMAIL_GMAIL_REFRESH_TOKEN;

		const result = validateProviderConfig({ type: "gmail" });
		assert.strictEqual(result.valid, false);
		assert.ok(result.errors.length >= 3);

		process.env.EMAIL_GMAIL_CLIENT_ID = origId;
		process.env.EMAIL_GMAIL_CLIENT_SECRET = origSecret;
		process.env.EMAIL_GMAIL_REFRESH_TOKEN = origRefresh;
	});

	test("should return errors for missing Graph env vars", () => {
		const origId = process.env.EMAIL_GRAPH_CLIENT_ID;
		const origSecret = process.env.EMAIL_GRAPH_CLIENT_SECRET;
		const origRefresh = process.env.EMAIL_GRAPH_REFRESH_TOKEN;
		const origTenant = process.env.EMAIL_GRAPH_TENANT_ID;
		delete process.env.EMAIL_GRAPH_CLIENT_ID;
		delete process.env.EMAIL_GRAPH_CLIENT_SECRET;
		delete process.env.EMAIL_GRAPH_REFRESH_TOKEN;
		delete process.env.EMAIL_GRAPH_TENANT_ID;

		const result = validateProviderConfig({ type: "graph" });
		assert.strictEqual(result.valid, false);
		assert.ok(result.errors.length >= 4);

		process.env.EMAIL_GRAPH_CLIENT_ID = origId;
		process.env.EMAIL_GRAPH_CLIENT_SECRET = origSecret;
		process.env.EMAIL_GRAPH_REFRESH_TOKEN = origRefresh;
		process.env.EMAIL_GRAPH_TENANT_ID = origTenant;
	});

	test("should return errors for missing IMAP env vars", () => {
		const origUser = process.env.EMAIL_IMAP_USER;
		const origPass = process.env.EMAIL_IMAP_PASSWORD;
		delete process.env.EMAIL_IMAP_USER;
		delete process.env.EMAIL_IMAP_PASSWORD;

		const result = validateProviderConfig({ type: "imap" });
		assert.strictEqual(result.valid, false);
		assert.ok(result.errors.length >= 2);

		process.env.EMAIL_IMAP_USER = origUser;
		process.env.EMAIL_IMAP_PASSWORD = origPass;
	});

	test("should return error for unknown provider type", () => {
		const result = validateProviderConfig({ type: "unknown" });
		assert.strictEqual(result.valid, false);
		assert.ok(result.errors);
		assert.ok(result.errors[0].includes("Unknown provider type"));
	});
});
