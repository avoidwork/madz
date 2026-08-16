import { test, describe } from "node:test";
import assert from "node:assert";
import {
	createEmailProvider,
	getActiveProvider,
	validateProviderConfig,
} from "../../../src/tools/email/index.js";
import { GmailProvider } from "../../../src/tools/email/providers/gmail.js";
import { GraphProvider } from "../../../src/tools/email/providers/graph.js";
import { ImapProvider } from "../../../src/tools/email/providers/imap.js";

describe("createEmailProvider factory", () => {
	test("should create a GmailProvider when type is gmail", () => {
		const provider = createEmailProvider({
			type: "gmail",
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
		});
		assert.ok(provider instanceof GmailProvider);
		assert.strictEqual(provider.type, "gmail");
	});

	test("should create a GraphProvider when type is graph", () => {
		const provider = createEmailProvider({
			type: "graph",
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
			tenantId: "tenant",
		});
		assert.ok(provider instanceof GraphProvider);
		assert.strictEqual(provider.type, "graph");
	});

	test("should create an ImapProvider when type is imap", () => {
		const provider = createEmailProvider({
			type: "imap",
			host: "imap.example.com",
			user: "user",
			password: "pass",
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
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
			userId: "user@example.com",
		});
		assert.ok(provider instanceof GmailProvider);
	});

	test("should default userId to 'me' for GmailProvider", () => {
		const provider = createEmailProvider({
			type: "gmail",
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
		});
		assert.ok(provider instanceof GmailProvider);
	});

	test("should pass accessToken to GmailProvider when provided", () => {
		const provider = createEmailProvider({
			type: "gmail",
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
			accessToken: "access-token",
		});
		assert.ok(provider instanceof GmailProvider);
	});

	test("should pass accessToken to GraphProvider when provided", () => {
		const provider = createEmailProvider({
			type: "graph",
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
			tenantId: "tenant",
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
					clientId: "id",
					clientSecret: "secret",
					refreshToken: "token",
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
					clientId: "id",
					clientSecret: "secret",
					refreshToken: "token",
					tenantId: "tenant",
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
					host: "imap.example.com",
					user: "user",
					password: "pass",
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
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
		});
		assert.strictEqual(result.valid, true);
		assert.strictEqual(result.errors, undefined);
	});

	test("should return valid for complete Graph config", () => {
		const result = validateProviderConfig({
			type: "graph",
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
			tenantId: "tenant",
		});
		assert.strictEqual(result.valid, true);
		assert.strictEqual(result.errors, undefined);
	});

	test("should return valid for complete IMAP config", () => {
		const result = validateProviderConfig({
			type: "imap",
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});
		assert.strictEqual(result.valid, true);
		assert.strictEqual(result.errors, undefined);
	});

	test("should return errors when type is missing", () => {
		const result = validateProviderConfig({ clientId: "id" });
		assert.strictEqual(result.valid, false);
		assert.ok(result.errors);
		assert.ok(result.errors.some((e) => e.includes("required")));
	});

	test("should return errors for incomplete Gmail config", () => {
		const result = validateProviderConfig({ type: "gmail", clientId: "id" });
		assert.strictEqual(result.valid, false);
		assert.ok(result.errors);
		assert.ok(result.errors.some((e) => e.includes("clientSecret")));
		assert.ok(result.errors.some((e) => e.includes("refreshToken")));
	});

	test("should return errors for incomplete Graph config", () => {
		const result = validateProviderConfig({
			type: "graph",
			clientId: "id",
			clientSecret: "secret",
		});
		assert.strictEqual(result.valid, false);
		assert.ok(result.errors);
		assert.ok(result.errors.some((e) => e.includes("tenantId")));
		assert.ok(result.errors.some((e) => e.includes("refreshToken")));
	});

	test("should return errors for incomplete IMAP config", () => {
		const result = validateProviderConfig({ type: "imap", host: "imap.example.com" });
		assert.strictEqual(result.valid, false);
		assert.ok(result.errors);
		assert.ok(result.errors.some((e) => e.includes("user")));
		assert.ok(result.errors.some((e) => e.includes("password")));
	});

	test("should return error for unknown provider type", () => {
		const result = validateProviderConfig({ type: "outlook" });
		assert.strictEqual(result.valid, false);
		assert.ok(result.errors);
		assert.ok(result.errors.some((e) => e.includes("Unknown")));
	});

	test("should return valid for Gmail config with optional fields", () => {
		const result = validateProviderConfig({
			type: "gmail",
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
			accessToken: "access",
			userId: "user@example.com",
		});
		assert.strictEqual(result.valid, true);
	});

	test("should return valid for Graph config with optional accessToken", () => {
		const result = validateProviderConfig({
			type: "graph",
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
			tenantId: "tenant",
			accessToken: "access",
		});
		assert.strictEqual(result.valid, true);
	});

	test("should return valid for IMAP config with optional fields", () => {
		const result = validateProviderConfig({
			type: "imap",
			host: "imap.example.com",
			port: 993,
			secure: true,
			user: "user",
			password: "pass",
		});
		assert.strictEqual(result.valid, true);
	});
});