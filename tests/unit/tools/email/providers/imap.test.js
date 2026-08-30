/**
 * Tests for the IMAP email provider.
 * @see {@link src/tools/email/providers/imap.js}
 */

import { test, describe, before, after, mock } from "node:test";
import assert from "node:assert";

describe("ImapProvider", () => {
	/** @type {ImapProvider} */
	let provider;

	const envVars = {
		EMAIL_IMAP_USER: "test@example.com",
		EMAIL_IMAP_PASSWORD: "test-password",
	};

	before(async () => {
		// Set required env vars
		for (const [key, value] of Object.entries(envVars)) {
			process.env[key] = value;
		}
	});

	after(() => {
		mock.restoreAll();
		// Clean up env vars
		for (const key of Object.keys(envVars)) {
			delete process.env[key];
		}
	});

	describe("constructor", () => {
		test("should create provider with default IMAP settings", async () => {
			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			assert.ok(p);
			assert.strictEqual(p.type, "imap");
		});

		test("should create provider with custom IMAP settings", async () => {
			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({
				imapHost: "imap.example.com",
				imapPort: 993,
				imapSecure: true,
				smtpHost: "smtp.example.com",
				smtpPort: 587,
			});
			assert.ok(p);
			assert.strictEqual(p.type, "imap");
		});

		test("should throw when required env vars are missing", async () => {
			const savedUser = process.env.EMAIL_IMAP_USER;
			const savedPassword = process.env.EMAIL_IMAP_PASSWORD;
			delete process.env.EMAIL_IMAP_USER;
			delete process.env.EMAIL_IMAP_PASSWORD;

			try {
				const { ImapProvider } = await import(
					"../../../../../src/tools/email/providers/imap.js"
				);
				assert.throws(
					() => new ImapProvider({}),
					/IMAP provider requires EMAIL_IMAP_USER/,
				);
			} finally {
				process.env.EMAIL_IMAP_USER = savedUser;
				process.env.EMAIL_IMAP_PASSWORD = savedPassword;
			}
		});

		test("should throw when only USER is missing", async () => {
			const savedUser = process.env.EMAIL_IMAP_USER;
			delete process.env.EMAIL_IMAP_USER;

			try {
				const { ImapProvider } = await import(
					"../../../../../src/tools/email/providers/imap.js"
				);
				assert.throws(
					() => new ImapProvider({}),
					/IMAP provider requires EMAIL_IMAP_USER/,
				);
			} finally {
				process.env.EMAIL_IMAP_USER = savedUser;
			}
		});

		test("should throw when only PASSWORD is missing", async () => {
			const savedPassword = process.env.EMAIL_IMAP_PASSWORD;
			delete process.env.EMAIL_IMAP_PASSWORD;

			try {
				const { ImapProvider } = await import(
					"../../../../../src/tools/email/providers/imap.js"
				);
				assert.throws(
					() => new ImapProvider({}),
					/IMAP provider requires EMAIL_IMAP_USER/,
				);
			} finally {
				process.env.EMAIL_IMAP_PASSWORD = savedPassword;
			}
		});
	});

	describe("validateConfig", () => {
		test("should return valid when env vars are set", async () => {
			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = p.validateConfig();
			assert.strictEqual(result.valid, true);
		});

		test("should return errors when env vars are missing", async () => {
			const savedUser = process.env.EMAIL_IMAP_USER;
			delete process.env.EMAIL_IMAP_USER;

			try {
				const { ImapProvider } = await import(
					"../../../../../src/tools/email/providers/imap.js"
				);
				const p = new ImapProvider({});
				const result = p.validateConfig();
				assert.strictEqual(result.valid, false);
				assert.ok(result.errors);
				assert.ok(result.errors.some((e) => e.includes("EMAIL_IMAP_USER")));
			} finally {
				process.env.EMAIL_IMAP_USER = savedUser;
			}
		});

		test("should list all missing env vars", async () => {
			const savedUser = process.env.EMAIL_IMAP_USER;
			const savedPassword = process.env.EMAIL_IMAP_PASSWORD;
			delete process.env.EMAIL_IMAP_USER;
			delete process.env.EMAIL_IMAP_PASSWORD;

			try {
				const { ImapProvider } = await import(
					"../../../../../src/tools/email/providers/imap.js"
				);
				const p = new ImapProvider({});
				const result = p.validateConfig();
				assert.strictEqual(result.valid, false);
				assert.ok(result.errors);
				assert.strictEqual(result.errors.length, 2);
			} finally {
				process.env.EMAIL_IMAP_USER = savedUser;
				process.env.EMAIL_IMAP_PASSWORD = savedPassword;
			}
		});
	});

	describe("cancel", () => {
		test("should not throw with no active request", async () => {
			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			assert.doesNotThrow(() => p.cancel());
		});
	});

	describe("send", () => {
		test("should send email via SMTP", async () => {
			const mockTransport = {
				sendMail: async () => ({ messageId: "smtp-msg-123" }),
			};

			const mockNodemailer = mock.module("nodemailer", {
				namedExports: {
					createTransport: () => mockTransport,
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.send({
				to: ["recipient@example.com"],
				subject: "Test Subject",
				body: "Test body",
			});
			assert.strictEqual(result.ok, true);
			assert.ok(result.messageId);
		});

		test("should send HTML email", async () => {
			const mockTransport = {
				sendMail: async () => ({ messageId: "smtp-msg-456" }),
			};

			mock.module("nodemailer", {
				namedExports: {
					createTransport: () => mockTransport,
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.send({
				to: ["recipient@example.com"],
				subject: "Test",
				body: "<h1>Hello</h1>",
				bodyType: "html",
			});
			assert.strictEqual(result.ok, true);
		});

		test("should include CC recipients", async () => {
			const mockTransport = {
				sendMail: async () => ({ messageId: "smtp-cc-123" }),
			};

			mock.module("nodemailer", {
				namedExports: {
					createTransport: () => mockTransport,
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.send({
				to: ["recipient@example.com"],
				subject: "Test",
				body: "Body",
				cc: ["cc@example.com"],
			});
			assert.strictEqual(result.ok, true);
		});

		test("should include BCC recipients", async () => {
			const mockTransport = {
				sendMail: async () => ({ messageId: "smtp-bcc-123" }),
			};

			mock.module("nodemailer", {
				namedExports: {
					createTransport: () => mockTransport,
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.send({
				to: ["recipient@example.com"],
				subject: "Test",
				body: "Body",
				bcc: ["bcc@example.com"],
			});
			assert.strictEqual(result.ok, true);
		});

		test("should handle attachments", async () => {
			const mockTransport = {
				sendMail: async () => ({ messageId: "smtp-att-123" }),
			};

			mock.module("nodemailer", {
				namedExports: {
					createTransport: () => mockTransport,
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.send({
				to: ["recipient@example.com"],
				subject: "Test",
				body: "Body",
				attachments: [
					{
						filename: "test.txt",
						content: "dGVzdCBjb250ZW50",
						contentType: "text/plain",
					},
				],
			});
			assert.strictEqual(result.ok, true);
		});

		test("should return error on send failure", async () => {
			mock.module("nodemailer", {
				namedExports: {
					createTransport: () => ({
						sendMail: async () => {
							throw new Error("SMTP error");
						},
					}),
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.send({
				to: ["recipient@example.com"],
				subject: "Test",
				body: "Body",
			});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error);
			assert.ok(result.error.includes("IMAP send failed"));
		});
	});

	describe("read", () => {
		test("should read messages from INBOX", async () => {
			const mockConnection = {
				openBox: async () => {},
				search: async () => [
					{ attributes: { uid: "1" } },
					{ attributes: { uid: "2" } },
				],
				getAttributes: async () => [
					{
						headers: {
							subject: "Test Subject",
							from: "sender@example.com",
							to: "recipient@example.com",
							date: "2024-01-01T00:00:00Z",
						},
						body: "Test body content",
					},
					{
						headers: {
							subject: "Another Subject",
							from: "another@example.com",
							to: "recipient@example.com",
							date: "2024-01-02T00:00:00Z",
						},
						body: "Another body",
					},
				],
				closeBox: async () => {},
				disconnect: async () => {},
			};

			mock.module("imap-simple", {
				namedExports: {
					default: {
						connect: async () => mockConnection,
					},
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.read({});
			assert.strictEqual(result.ok, true);
			assert.ok(result.messages);
			assert.strictEqual(result.messages.length, 2);
		});

		test("should filter by sender", async () => {
			const mockConnection = {
				openBox: async () => {},
				search: async () => [{ attributes: { uid: "1" } }],
				getAttributes: async () => [
					{
						headers: {
							subject: "Test",
							from: "sender@example.com",
							to: "recipient@example.com",
							date: "2024-01-01T00:00:00Z",
						},
						body: "Body",
					},
				],
				closeBox: async () => {},
				disconnect: async () => {},
			};

			mock.module("imap-simple", {
				namedExports: {
					default: {
						connect: async () => mockConnection,
					},
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.read({ sender: "sender@example.com" });
			assert.strictEqual(result.ok, true);
		});

		test("should filter by subject", async () => {
			const mockConnection = {
				openBox: async () => {},
				search: async () => [{ attributes: { uid: "1" } }],
				getAttributes: async () => [
					{
						headers: {
							subject: "Test Subject",
							from: "sender@example.com",
							to: "recipient@example.com",
							date: "2024-01-01T00:00:00Z",
						},
						body: "Body",
					},
				],
				closeBox: async () => {},
				disconnect: async () => {},
			};

			mock.module("imap-simple", {
				namedExports: {
					default: {
						connect: async () => mockConnection,
					},
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.read({ subject: "Test" });
			assert.strictEqual(result.ok, true);
		});

		test("should filter by keyword", async () => {
			const mockConnection = {
				openBox: async () => {},
				search: async () => [{ attributes: { uid: "1" } }],
				getAttributes: async () => [
					{
						headers: {
							subject: "Test",
							from: "sender@example.com",
							to: "recipient@example.com",
							date: "2024-01-01T00:00:00Z",
						},
						body: "Body with keyword",
					},
				],
				closeBox: async () => {},
				disconnect: async () => {},
			};

			mock.module("imap-simple", {
				namedExports: {
					default: {
						connect: async () => mockConnection,
					},
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.read({ keyword: "keyword" });
			assert.strictEqual(result.ok, true);
		});

		test("should filter by date range", async () => {
			const mockConnection = {
				openBox: async () => {},
				search: async () => [{ attributes: { uid: "1" } }],
				getAttributes: async () => [
					{
						headers: {
							subject: "Test",
							from: "sender@example.com",
							to: "recipient@example.com",
							date: "2024-01-01T00:00:00Z",
						},
						body: "Body",
					},
				],
				closeBox: async () => {},
				disconnect: async () => {},
			};

			mock.module("imap-simple", {
				namedExports: {
					default: {
						connect: async () => mockConnection,
					},
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.read({
				dateFrom: "2024-01-01",
				dateTo: "2024-12-31",
			});
			assert.strictEqual(result.ok, true);
		});

		test("should filter by folder", async () => {
			const mockConnection = {
				openBox: async () => {},
				search: async () => [{ attributes: { uid: "1" } }],
				getAttributes: async () => [
					{
						headers: {
							subject: "Test",
							from: "sender@example.com",
							to: "recipient@example.com",
							date: "2024-01-01T00:00:00Z",
						},
						body: "Body",
					},
				],
				closeBox: async () => {},
				disconnect: async () => {},
			};

			mock.module("imap-simple", {
				namedExports: {
					default: {
						connect: async () => mockConnection,
					},
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.read({ folder: "SentItems" });
			assert.strictEqual(result.ok, true);
		});

		test("should respect limit parameter", async () => {
			const mockConnection = {
				openBox: async () => {},
				search: async () => [
					{ attributes: { uid: "1" } },
					{ attributes: { uid: "2" } },
					{ attributes: { uid: "3" } },
				],
				getAttributes: async () => [
					{
						headers: {
							subject: "Test",
							from: "sender@example.com",
							to: "recipient@example.com",
							date: "2024-01-01T00:00:00Z",
						},
						body: "Body",
					},
				],
				closeBox: async () => {},
				disconnect: async () => {},
			};

			mock.module("imap-simple", {
				namedExports: {
					default: {
						connect: async () => mockConnection,
					},
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.read({ limit: 1 });
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.messages.length, 1);
		});

		test("should handle empty message list", async () => {
			const mockConnection = {
				openBox: async () => {},
				search: async () => [],
				getAttributes: async () => [],
				closeBox: async () => {},
				disconnect: async () => {},
			};

			mock.module("imap-simple", {
				namedExports: {
					default: {
						connect: async () => mockConnection,
					},
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.read({});
			assert.strictEqual(result.ok, true);
			assert.ok(Array.isArray(result.messages));
			assert.strictEqual(result.messages.length, 0);
		});

		test("should handle read failure", async () => {
			mock.module("imap-simple", {
				namedExports: {
					default: {
						connect: async () => {
							throw new Error("IMAP connection failed");
						},
					},
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.read({});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error);
			assert.ok(result.error.includes("IMAP read failed"));
		});
	});

	describe("search", () => {
		test("should search messages", async () => {
			const mockConnection = {
				openBox: async () => {},
				search: async () => [{ attributes: { uid: "1" } }],
				getAttributes: async () => [
					{
						headers: {
							subject: "Search Result",
							from: "sender@example.com",
							to: "recipient@example.com",
							date: "2024-01-01T00:00:00Z",
						},
						body: "Search body",
					},
				],
				closeBox: async () => {},
				disconnect: async () => {},
			};

			mock.module("imap-simple", {
				namedExports: {
					default: {
						connect: async () => mockConnection,
					},
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.search({ query: "test" });
			assert.strictEqual(result.ok, true);
			assert.ok(result.messages);
		});

		test("should respect limit parameter", async () => {
			const mockConnection = {
				openBox: async () => {},
				search: async () => [
					{ attributes: { uid: "1" } },
					{ attributes: { uid: "2" } },
				],
				getAttributes: async () => [
					{
						headers: {
							subject: "Test",
							from: "sender@example.com",
							to: "recipient@example.com",
							date: "2024-01-01T00:00:00Z",
						},
						body: "Body",
					},
				],
				closeBox: async () => {},
				disconnect: async () => {},
			};

			mock.module("imap-simple", {
				namedExports: {
					default: {
						connect: async () => mockConnection,
					},
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.search({ query: "test", limit: 1 });
			assert.strictEqual(result.ok, true);
		});

		test("should handle search failure", async () => {
			mock.module("imap-simple", {
				namedExports: {
					default: {
						connect: async () => {
							throw new Error("IMAP search failed");
						},
					},
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.search({ query: "test" });
			assert.strictEqual(result.ok, false);
			assert.ok(result.error);
		});
	});

	describe("saveDraft", () => {
		test("should save draft", async () => {
			const mockConnection = {
				openBox: async () => {},
				addMessage: async () => ({ uid: 123 }),
				closeBox: async () => {},
				disconnect: async () => {},
			};

			mock.module("imap-simple", {
				namedExports: {
					default: {
						connect: async () => mockConnection,
					},
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.saveDraft({
				to: ["recipient@example.com"],
				subject: "Draft Subject",
				body: "Draft body",
			});
			assert.strictEqual(result.ok, true);
			assert.ok(result.draftId);
		});

		test("should save HTML draft", async () => {
			const mockConnection = {
				openBox: async () => {},
				addMessage: async () => ({ uid: 456 }),
				closeBox: async () => {},
				disconnect: async () => {},
			};

			mock.module("imap-simple", {
				namedExports: {
					default: {
						connect: async () => mockConnection,
					},
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.saveDraft({
				to: ["recipient@example.com"],
				subject: "Draft",
				body: "<h1>HTML Draft</h1>",
				bodyType: "html",
			});
			assert.strictEqual(result.ok, true);
		});

		test("should handle saveDraft failure", async () => {
			mock.module("imap-simple", {
				namedExports: {
					default: {
						connect: async () => {
							throw new Error("IMAP save failed");
						},
					},
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.saveDraft({
				to: ["recipient@example.com"],
				subject: "Draft",
				body: "Body",
			});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error);
		});
	});

	describe("listDrafts", () => {
		test("should list drafts", async () => {
			const mockConnection = {
				openBox: async () => {},
				search: async () => [
					{ attributes: { uid: "1" } },
					{ attributes: { uid: "2" } },
				],
				getAttributes: async () => [
					{
						headers: {
							subject: "Draft 1",
							from: "me@example.com",
							to: "me@example.com",
							date: "2024-01-01T00:00:00Z",
						},
						body: "Draft 1 body",
					},
					{
						headers: {
							subject: "Draft 2",
							from: "me@example.com",
							to: "me@example.com",
							date: "2024-01-02T00:00:00Z",
						},
						body: "Draft 2 body",
					},
				],
				closeBox: async () => {},
				disconnect: async () => {},
			};

			mock.module("imap-simple", {
				namedExports: {
					default: {
						connect: async () => mockConnection,
					},
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.listDrafts({});
			assert.strictEqual(result.ok, true);
			assert.ok(result.drafts);
			assert.strictEqual(result.drafts.length, 2);
		});

		test("should respect limit parameter", async () => {
			const mockConnection = {
				openBox: async () => {},
				search: async () => [
					{ attributes: { uid: "1" } },
					{ attributes: { uid: "2" } },
					{ attributes: { uid: "3" } },
				],
				getAttributes: async () => [
					{
						headers: {
							subject: "Draft",
							from: "me@example.com",
							to: "me@example.com",
							date: "2024-01-01T00:00:00Z",
						},
						body: "Body",
					},
				],
				closeBox: async () => {},
				disconnect: async () => {},
			};

			mock.module("imap-simple", {
				namedExports: {
					default: {
						connect: async () => mockConnection,
					},
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.listDrafts({ limit: 1 });
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.drafts.length, 1);
		});

		test("should handle empty drafts list", async () => {
			const mockConnection = {
				openBox: async () => {},
				search: async () => [],
				getAttributes: async () => [],
				closeBox: async () => {},
				disconnect: async () => {},
			};

			mock.module("imap-simple", {
				namedExports: {
					default: {
						connect: async () => mockConnection,
					},
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.listDrafts({});
			assert.strictEqual(result.ok, true);
			assert.ok(Array.isArray(result.drafts));
			assert.strictEqual(result.drafts.length, 0);
		});

		test("should handle listDrafts failure", async () => {
			mock.module("imap-simple", {
				namedExports: {
					default: {
						connect: async () => {
							throw new Error("IMAP list failed");
						},
					},
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.listDrafts({});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error);
		});
	});

	describe("updateDraft", () => {
		test("should update draft by deleting and recreating", async () => {
			const mockConnection = {
				openBox: async () => {},
				addMessage: async () => ({ uid: 789 }),
				setFlags: async () => {},
				expunge: async () => {},
				closeBox: async () => {},
				disconnect: async () => {},
			};

			mock.module("imap-simple", {
				namedExports: {
					default: {
						connect: async () => mockConnection,
					},
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.updateDraft("draft-123", {
				subject: "Updated Subject",
				body: "Updated body",
			});
			assert.strictEqual(result.ok, true);
		});

		test("should handle updateDraft failure", async () => {
			mock.module("imap-simple", {
				namedExports: {
					default: {
						connect: async () => {
							throw new Error("IMAP update failed");
						},
					},
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.updateDraft("draft-123", {
				subject: "Updated",
				body: "Body",
			});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error);
		});
	});

	describe("deleteDraft", () => {
		test("should delete draft", async () => {
			const mockConnection = {
				openBox: async () => {},
				setFlags: async () => {},
				expunge: async () => {},
				closeBox: async () => {},
				disconnect: async () => {},
			};

			mock.module("imap-simple", {
				namedExports: {
					default: {
						connect: async () => mockConnection,
					},
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.deleteDraft("draft-123");
			assert.strictEqual(result.ok, true);
		});

		test("should handle deleteDraft failure", async () => {
			mock.module("imap-simple", {
				namedExports: {
					default: {
						connect: async () => {
							throw new Error("IMAP delete failed");
						},
					},
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.deleteDraft("draft-123");
			assert.strictEqual(result.ok, false);
			assert.ok(result.error);
		});
	});

	describe("organize", () => {
		test("should mark messages as read", async () => {
			const mockConnection = {
				openBox: async () => {},
				setFlags: async () => {},
				closeBox: async () => {},
				disconnect: async () => {},
			};

			mock.module("imap-simple", {
				namedExports: {
					default: {
						connect: async () => mockConnection,
					},
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.organize({
				messageIds: ["1", "2"],
				action: "markRead",
			});
			assert.strictEqual(result.ok, true);
		});

		test("should mark messages as unread", async () => {
			const mockConnection = {
				openBox: async () => {},
				setFlags: async () => {},
				closeBox: async () => {},
				disconnect: async () => {},
			};

			mock.module("imap-simple", {
				namedExports: {
					default: {
						connect: async () => mockConnection,
					},
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.organize({
				messageIds: "1",
				action: "markUnread",
			});
			assert.strictEqual(result.ok, true);
		});

		test("should archive messages", async () => {
			const mockConnection = {
				openBox: async () => {},
				setFlags: async () => {},
				copy: async () => {},
				closeBox: async () => {},
				disconnect: async () => {},
			};

			mock.module("imap-simple", {
				namedExports: {
					default: {
						connect: async () => mockConnection,
					},
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.organize({
				messageIds: ["1"],
				action: "archive",
			});
			assert.strictEqual(result.ok, true);
		});

		test("should add label", async () => {
			const mockConnection = {
				openBox: async () => {},
				setFlags: async () => {},
				closeBox: async () => {},
				disconnect: async () => {},
			};

			mock.module("imap-simple", {
				namedExports: {
					default: {
						connect: async () => mockConnection,
					},
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.organize({
				messageIds: ["1"],
				action: "addLabel",
				label: "Important",
			});
			assert.strictEqual(result.ok, true);
		});

		test("should remove label", async () => {
			const mockConnection = {
				openBox: async () => {},
				setFlags: async () => {},
				closeBox: async () => {},
				disconnect: async () => {},
			};

			mock.module("imap-simple", {
				namedExports: {
					default: {
						connect: async () => mockConnection,
					},
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.organize({
				messageIds: ["1"],
				action: "removeLabel",
				label: "Important",
			});
			assert.strictEqual(result.ok, true);
		});

		test("should reject unknown action", async () => {
			const mockConnection = {
				openBox: async () => {},
				closeBox: async () => {},
				disconnect: async () => {},
			};

			mock.module("imap-simple", {
				namedExports: {
					default: {
						connect: async () => mockConnection,
					},
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.organize({
				messageIds: ["1"],
				action: "unknownAction",
			});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error);
			assert.ok(result.error.includes("Unknown organize action"));
		});

		test("should handle organize failure", async () => {
			mock.module("imap-simple", {
				namedExports: {
					default: {
						connect: async () => {
							throw new Error("IMAP organize failed");
						},
					},
				},
			});

			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			const result = await p.organize({
				messageIds: ["1"],
				action: "markRead",
			});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error);
		});
	});

	describe("inheritance", () => {
		test("should inherit from EmailProvider", async () => {
			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const { EmailProvider } = await import(
				"../../../../../src/tools/email/providers/base.js"
			);
			const p = new ImapProvider({});
			assert.ok(p instanceof EmailProvider);
		});

		test("should have correct type", async () => {
			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			assert.strictEqual(p.type, "imap");
		});

		test("should have default timeout", async () => {
			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({});
			assert.strictEqual(p.timeoutMs, 30000);
		});

		test("should accept custom timeout", async () => {
			const { ImapProvider } = await import(
				"../../../../../src/tools/email/providers/imap.js"
			);
			const p = new ImapProvider({ timeoutMs: 60000 });
			assert.strictEqual(p.timeoutMs, 60000);
		});
	});
});
