import { test, describe } from "node:test";
import assert from "node:assert";
import {
	GmailProviderSchema,
	GraphProviderSchema,
	ImapProviderSchema,
	EmailProviderSchema,
	EmailConfigSchema,
} from "../../../src/config/schemas/providers.js";

describe("Email Provider Config Schemas", () => {
	describe("GmailProviderSchema", () => {
		test("should validate a complete Gmail config", () => {
			const result = GmailProviderSchema.safeParse({
				type: "gmail",
				clientId: "client-id",
				clientSecret: "client-secret",
				refreshToken: "refresh-token",
			});
			assert.strictEqual(result.success, true);
		});

		test("should accept minimal Gmail config with defaults", () => {
			const result = GmailProviderSchema.safeParse({});
			assert.strictEqual(result.success, true);
			assert.strictEqual(result.data.type, "gmail");
		});

		test("should reject invalid type", () => {
			const result = GmailProviderSchema.safeParse({ type: "invalid" });
			assert.strictEqual(result.success, false);
		});
	});

	describe("GraphProviderSchema", () => {
		test("should validate a complete Graph config", () => {
			const result = GraphProviderSchema.safeParse({
				type: "graph",
				tenantId: "tenant-id",
				clientId: "client-id",
				clientSecret: "client-secret",
				refreshToken: "refresh-token",
			});
			assert.strictEqual(result.success, true);
		});

		test("should accept minimal Graph config with defaults", () => {
			const result = GraphProviderSchema.safeParse({});
			assert.strictEqual(result.success, true);
			assert.strictEqual(result.data.type, "graph");
		});

		test("should reject invalid type", () => {
			const result = GraphProviderSchema.safeParse({ type: "invalid" });
			assert.strictEqual(result.success, false);
		});
	});

	describe("ImapProviderSchema", () => {
		test("should validate a complete IMAP config", () => {
			const result = ImapProviderSchema.safeParse({
				type: "imap",
				host: "imap.gmail.com",
				port: 993,
				secure: true,
				user: "user@gmail.com",
				password: "app-password",
			});
			assert.strictEqual(result.success, true);
		});

		test("should accept minimal IMAP config with defaults", () => {
			const result = ImapProviderSchema.safeParse({
				user: "user@gmail.com",
				password: "app-password",
			});
			assert.strictEqual(result.success, true);
			assert.strictEqual(result.data.type, "imap");
			assert.strictEqual(result.data.host, "imap.gmail.com");
			assert.strictEqual(result.data.port, 993);
			assert.strictEqual(result.data.secure, true);
		});

		test("should reject IMAP config without user", () => {
			const result = ImapProviderSchema.safeParse({ password: "pass" });
			assert.strictEqual(result.success, false);
		});

		test("should reject IMAP config without password", () => {
			const result = ImapProviderSchema.safeParse({ user: "user" });
			assert.strictEqual(result.success, false);
		});
	});

	describe("EmailProviderSchema (discriminated union)", () => {
		test("should accept Gmail provider", () => {
			const result = EmailProviderSchema.safeParse({
				type: "gmail",
				clientId: "id",
				clientSecret: "secret",
				refreshToken: "token",
			});
			assert.strictEqual(result.success, true);
		});

		test("should accept Graph provider", () => {
			const result = EmailProviderSchema.safeParse({
				type: "graph",
				clientId: "id",
				clientSecret: "secret",
				refreshToken: "token",
			});
			assert.strictEqual(result.success, true);
		});

		test("should accept IMAP provider", () => {
			const result = EmailProviderSchema.safeParse({
				type: "imap",
				user: "user",
				password: "pass",
			});
			assert.strictEqual(result.success, true);
		});

		test("should reject unknown provider type", () => {
			const result = EmailProviderSchema.safeParse({ type: "unknown", user: "user" });
			assert.strictEqual(result.success, false);
		});
	});

	describe("EmailConfigSchema", () => {
		test("should validate a complete email config", () => {
			const result = EmailConfigSchema.safeParse({
				provider: { type: "gmail", clientId: "id", clientSecret: "secret", refreshToken: "token" },
				defaultFolder: "INBOX",
				maxAttachments: 10,
				maxAttachmentSize: "25mb",
			});
			assert.strictEqual(result.success, true);
		});

		test("should accept minimal email config with defaults", () => {
			const result = EmailConfigSchema.safeParse({
				provider: { type: "imap", user: "user", password: "pass" },
			});
			assert.strictEqual(result.success, true);
			assert.strictEqual(result.data.defaultFolder, "INBOX");
			assert.strictEqual(result.data.maxAttachments, 10);
		});

		test("should reject config with invalid provider", () => {
			const result = EmailConfigSchema.safeParse({
				provider: { type: "invalid" },
			});
			assert.strictEqual(result.success, false);
		});
	});
});
