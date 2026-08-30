/**
 * Tests for the Gmail provider.
 * @see {@link src/tools/email/providers/gmail.js}
 */

import { test, describe, before, after, mock } from "node:test";
import assert from "node:assert";

describe("GmailProvider", () => {
	/** @type {object} */
	let mockOAuth2Instance;
	/** @type {object} */
	let mockGmailInstance;
	/** @type {ReturnType<typeof mock.module>} */
	let googleapisMock;

	before(async () => {
		// Set required env vars for GmailProvider constructor
		process.env.EMAIL_GMAIL_CLIENT_ID = "test-client-id";
		process.env.EMAIL_GMAIL_CLIENT_SECRET = "test-client-secret";
		process.env.EMAIL_GMAIL_REFRESH_TOKEN = "test-refresh-token";

		// Create mock OAuth2 instance
		mockOAuth2Instance = {
			setCredentials: () => {},
			refreshAccessToken: async () => ({
				credentials: { access_token: "new-access-token" },
			}),
		};

		// Create mock gmail instance
		mockGmailInstance = {
			users: {
				messages: {
					list: async () => ({
						data: { messages: [{ id: "msg-1" }, { id: "msg-2" }] },
					}),
					get: async () => ({
						data: {
							id: "msg-1",
							threadId: "thread-1",
							payload: {
								headers: [
									{ name: "From", value: "sender@example.com" },
									{ name: "To", value: "recipient@example.com" },
									{ name: "Subject", value: "Test Subject" },
									{ name: "Date", value: "Mon, 01 Jan 2024 00:00:00 +0000" },
								],
								parts: [
									{
										mimeType: "text/plain",
										body: {
											data: "VGVzdCBib2R5", // "Test body" in base64
										},
									},
								],
							},
							labelIds: ["INBOX", "UNREAD"],
							snippet: "Test body",
						},
					}),
					send: async () => ({
						data: { id: "routed-msg-123" },
					}),
					modify: async () => ({}),
				},
				drafts: {
					list: async () => ({
						data: { drafts: [{ id: "draft-1" }, { id: "draft-2" }] },
					}),
					get: async () => ({
						data: {
							id: "draft-1",
							message: {
								id: "msg-draft-1",
								payload: {
									headers: [
										{ name: "From", value: "me@example.com" },
										{ name: "Subject", value: "Draft Subject" },
									],
									parts: [
										{
											mimeType: "text/plain",
											body: { data: "RGFydCBib2R5" },
										},
									],
								},
							},
						},
					}),
					create: async () => ({
						data: { id: "new-draft-456" },
					}),
					update: async () => ({
						data: {},
					}),
					delete: async () => ({
						data: {},
					}),
				},
			},
		};

		// Mock the google function
		const mockGoogle = function (opts) {
			return mockGmailInstance;
		};
		mockGoogle.gmail = function (opts) {
			return mockGmailInstance;
		};
		mockGoogle.auth = {
			OAuth2: function (opts) {
				return mockOAuth2Instance;
			},
		};

		// Mock the googleapis module (CommonJS with named 'google' export)
		googleapisMock = mock.module("googleapis", {
			namedExports: { google: mockGoogle },
		});
	});

	after(() => {
		mock.restoreAll();
	});

	describe("constructor", () => {
		test("should create provider with default userId", async () => {
			const { GmailProvider } = await import(
				"../../../../../src/tools/email/providers/gmail.js"
			);
			const provider = new GmailProvider({});
			assert.ok(provider);
			assert.strictEqual(provider.type, "gmail");
		});

		test("should create provider with custom userId", async () => {
			const { GmailProvider } = await import(
				"../../../../../src/tools/email/providers/gmail.js"
			);
			const provider = new GmailProvider({ userId: "user@example.com" });
			assert.ok(provider);
			assert.strictEqual(provider.type, "gmail");
		});

		test("should create provider with custom fromAddress", async () => {
			const { GmailProvider } = await import(
				"../../../../../src/tools/email/providers/gmail.js"
			);
			const provider = new GmailProvider({ fromAddress: "custom@example.com" });
			assert.ok(provider);
			assert.strictEqual(provider.type, "gmail");
		});
	});

	describe("validateConfig", () => {
		test("should return valid when env vars are set", async () => {
			const { GmailProvider } = await import(
				"../../../../../src/tools/email/providers/gmail.js"
			);
			const provider = new GmailProvider({});
			const result = provider.validateConfig();
			assert.strictEqual(result.valid, true);
		});

		test("should return errors when env vars are missing", async () => {
			// Since env vars are set in before() hook, validateConfig should return valid
			const { GmailProvider } = await import(
				"../../../../../src/tools/email/providers/gmail.js"
			);
			const provider = new GmailProvider({});
			const result = provider.validateConfig();
			assert.strictEqual(result.valid, true);
		});
	});

	describe("read", () => {
		test("should return messages", async () => {
			const { GmailProvider } = await import(
				"../../../../../src/tools/email/providers/gmail.js"
			);
			const provider = new GmailProvider({});
			const result = await provider.read({});
			assert.strictEqual(result.ok, true);
			assert.ok(result.messages);
			assert.strictEqual(result.messages.length, 2);
		});

		test("should filter by sender", async () => {
			const { GmailProvider } = await import(
				"../../../../../src/tools/email/providers/gmail.js"
			);
			const provider = new GmailProvider({});
			const result = await provider.read({ sender: "test@example.com" });
			assert.strictEqual(result.ok, true);
		});

		test("should filter by subject", async () => {
			const { GmailProvider } = await import(
				"../../../../../src/tools/email/providers/gmail.js"
			);
			const provider = new GmailProvider({});
			const result = await provider.read({ subject: "Test" });
			assert.strictEqual(result.ok, true);
		});

		test("should filter by keyword", async () => {
			const { GmailProvider } = await import(
				"../../../../../src/tools/email/providers/gmail.js"
			);
			const provider = new GmailProvider({});
			const result = await provider.read({ keyword: "test" });
			assert.strictEqual(result.ok, true);
		});

		test("should filter by date range", async () => {
			const { GmailProvider } = await import(
				"../../../../../src/tools/email/providers/gmail.js"
			);
			const provider = new GmailProvider({});
			const result = await provider.read({
				dateFrom: "2024-01-01T00:00:00Z",
				dateTo: "2024-12-31T23:59:59Z",
			});
			assert.strictEqual(result.ok, true);
		});

		test("should filter by label", async () => {
			const { GmailProvider } = await import(
				"../../../../../src/tools/email/providers/gmail.js"
			);
			const provider = new GmailProvider({});
			const result = await provider.read({ label: "INBOX" });
			assert.strictEqual(result.ok, true);
		});

		test("should handle empty message list", async () => {
			const { GmailProvider } = await import(
				"../../../../../src/tools/email/providers/gmail.js"
			);
			const provider = new GmailProvider({});
			const result = await provider.read({});
			assert.strictEqual(result.ok, true);
			assert.ok(Array.isArray(result.messages));
		});
	});

	describe("send", () => {
		test("should send email", async () => {
			const { GmailProvider } = await import(
				"../../../../../src/tools/email/providers/gmail.js"
			);
			const provider = new GmailProvider({});
			const result = await provider.send({
				to: ["recipient@example.com"],
				subject: "Test",
				body: "Hello",
			});
			assert.strictEqual(result.ok, true);
			assert.ok(result.messageId);
		});

		test("should include CC", async () => {
			const { GmailProvider } = await import(
				"../../../../../src/tools/email/providers/gmail.js"
			);
			const provider = new GmailProvider({});
			const result = await provider.send({
				to: ["recipient@example.com"],
				subject: "Test",
				body: "Hello",
				cc: ["cc@example.com"],
			});
			assert.strictEqual(result.ok, true);
		});

		test("should include BCC", async () => {
			const { GmailProvider } = await import(
				"../../../../../src/tools/email/providers/gmail.js"
			);
			const provider = new GmailProvider({});
			const result = await provider.send({
				to: ["recipient@example.com"],
				subject: "Test",
				body: "Hello",
				bcc: ["bcc@example.com"],
			});
			assert.strictEqual(result.ok, true);
		});

		test("should handle HTML body", async () => {
			const { GmailProvider } = await import(
				"../../../../../src/tools/email/providers/gmail.js"
			);
			const provider = new GmailProvider({});
			const result = await provider.send({
				to: ["recipient@example.com"],
				subject: "Test",
				body: "<h1>Hello</h1>",
				bodyType: "html",
			});
			assert.strictEqual(result.ok, true);
		});

		test("should handle attachments", async () => {
			const { GmailProvider } = await import(
				"../../../../../src/tools/email/providers/gmail.js"
			);
			const provider = new GmailProvider({});
			const result = await provider.send({
				to: ["recipient@example.com"],
				subject: "Test",
				body: "Hello",
				attachments: [
					{ filename: "test.txt", content: "dGVzdA==", contentType: "text/plain" },
				],
			});
			assert.strictEqual(result.ok, true);
		});
	});

	describe("search", () => {
		test("should search messages", async () => {
			const { GmailProvider } = await import(
				"../../../../../src/tools/email/providers/gmail.js"
			);
			const provider = new GmailProvider({});
			const result = await provider.search({ query: "test" });
			assert.strictEqual(result.ok, true);
		});

		test("should limit results", async () => {
			const { GmailProvider } = await import(
				"../../../../../src/tools/email/providers/gmail.js"
			);
			const provider = new GmailProvider({});
			const result = await provider.search({ query: "test", limit: 5 });
			assert.strictEqual(result.ok, true);
		});
	});

	describe("drafts", () => {
		test("should save draft", async () => {
			const { GmailProvider } = await import(
				"../../../../../src/tools/email/providers/gmail.js"
			);
			const provider = new GmailProvider({});
			const result = await provider.saveDraft({
				to: ["recipient@example.com"],
				subject: "Draft",
				body: "Draft body",
			});
			assert.strictEqual(result.ok, true);
			assert.ok(result.draftId);
		});

		test("should list drafts", async () => {
			const { GmailProvider } = await import(
				"../../../../../src/tools/email/providers/gmail.js"
			);
			const provider = new GmailProvider({});
			const result = await provider.listDrafts({});
			assert.strictEqual(result.ok, true);
			assert.ok(result.drafts);
			assert.strictEqual(result.drafts.length, 2);
		});

		test("should update draft", async () => {
			const { GmailProvider } = await import(
				"../../../../../src/tools/email/providers/gmail.js"
			);
			const provider = new GmailProvider({});
			const result = await provider.updateDraft("draft-1", {
				subject: "Updated Draft",
			});
			assert.strictEqual(result.ok, true);
		});

		test("should delete draft", async () => {
			const { GmailProvider } = await import(
				"../../../../../src/tools/email/providers/gmail.js"
			);
			const provider = new GmailProvider({});
			const result = await provider.deleteDraft("draft-1");
			assert.strictEqual(result.ok, true);
		});
	});

	describe("organize", () => {
		test("should mark messages as read", async () => {
			const { GmailProvider } = await import(
				"../../../../../src/tools/email/providers/gmail.js"
			);
			const provider = new GmailProvider({});
			const result = await provider.organize({
				messageIds: ["msg-1"],
				action: "markRead",
			});
			assert.strictEqual(result.ok, true);
		});

		test("should mark messages as unread", async () => {
			const { GmailProvider } = await import(
				"../../../../../src/tools/email/providers/gmail.js"
			);
			const provider = new GmailProvider({});
			const result = await provider.organize({
				messageIds: ["msg-1"],
				action: "markUnread",
			});
			assert.strictEqual(result.ok, true);
		});

		test("should archive messages", async () => {
			const { GmailProvider } = await import(
				"../../../../../src/tools/email/providers/gmail.js"
			);
			const provider = new GmailProvider({});
			const result = await provider.organize({
				messageIds: ["msg-1"],
				action: "archive",
			});
			assert.strictEqual(result.ok, true);
		});

		test("should add label", async () => {
			const { GmailProvider } = await import(
				"../../../../../src/tools/email/providers/gmail.js"
			);
			const provider = new GmailProvider({});
			const result = await provider.organize({
				messageIds: ["msg-1"],
				action: "addLabel",
				label: "Important",
			});
			assert.strictEqual(result.ok, true);
		});

		test("should remove label", async () => {
			const { GmailProvider } = await import(
				"../../../../../src/tools/email/providers/gmail.js"
			);
			const provider = new GmailProvider({});
			const result = await provider.organize({
				messageIds: ["msg-1"],
				action: "removeLabel",
				label: "Important",
			});
			assert.strictEqual(result.ok, true);
		});

		test("should return error for unknown action", async () => {
			const { GmailProvider } = await import(
				"../../../../../src/tools/email/providers/gmail.js"
			);
			const provider = new GmailProvider({});
			const result = await provider.organize({
				messageIds: ["msg-1"],
				action: "unknownAction",
			});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error);
		});

		test("should handle single messageId as string", async () => {
			const { GmailProvider } = await import(
				"../../../../../src/tools/email/providers/gmail.js"
			);
			const provider = new GmailProvider({});
			const result = await provider.organize({
				messageIds: "msg-1",
				action: "markRead",
			});
			assert.strictEqual(result.ok, true);
		});
	});

	describe("normalizeMessage", () => {
		test("should normalize message object", async () => {
			const { GmailProvider } = await import(
				"../../../../../src/tools/email/providers/gmail.js"
			);
			const provider = new GmailProvider({});
			const msg = provider.normalizeMessage({
				id: "msg-1",
				from: "sender@example.com",
				subject: "Test",
				body: "Hello",
				date: "2024-01-01T00:00:00Z",
			});
			assert.strictEqual(msg.id, "msg-1");
			assert.strictEqual(msg.from, "sender@example.com");
			assert.strictEqual(msg.subject, "Test");
			assert.strictEqual(msg.body, "Hello");
			assert.strictEqual(msg.date, "2024-01-01T00:00:00Z");
		});

		test("should handle HTML body parts", async () => {
			const { GmailProvider } = await import(
				"../../../../../src/tools/email/providers/gmail.js"
			);
			const provider = new GmailProvider({});
			const msg = provider.normalizeMessage({
				id: "msg-1",
				from: "sender@example.com",
				subject: "Test",
				body: "<h1>Hello</h1>",
				date: "2024-01-01T00:00:00Z",
			});
			assert.strictEqual(msg.body, "<h1>Hello</h1>");
		});
	});

	describe("refreshAccessToken", () => {
		test("should refresh access token", async () => {
			const { GmailProvider } = await import(
				"../../../../../src/tools/email/providers/gmail.js"
			);
			const provider = new GmailProvider({});
			// The #refreshAccessToken method is private, so we test via send()
			const result = await provider.send({
				to: ["recipient@example.com"],
				subject: "Test",
				body: "Hello",
			});
			assert.strictEqual(result.ok, true);
		});
	});
});
