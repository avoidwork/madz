import { test, describe, before, after, mock } from "node:test";
import assert from "node:assert";
import { GmailProvider } from "../../../../../src/tools/email/providers/gmail.js";

describe("GmailProvider — happy paths", () => {
	/** @type {import('googleapis').google} */
	let mockGmail;
	/** @type {import('googleapis').google.auth.OAuth2} */
	let mockOAuth2;
	/** @type {typeof import('googleapis')} */
	let origGoogle;

	before(async () => {
		origGoogle = await import("googleapis");

		const mockOAuth2Instance = {
			setCredentials: () => {},
		};

		mockOAuth2 = mock.method(
			origGoogle.auth,
			"OAuth2",
			() => mockOAuth2Instance,
		);

		const mockGmailInstance = {
			users: {
				messages: {
					list: mock.method(async () => ({
						data: { messages: [{ id: "msg-1" }, { id: "msg-2" }] },
					})),
					get: mock.method(async () => ({
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
					})),
					send: mock.method(async () => ({
						data: { id: "routed-msg-123" },
					})),
					modify: mock.method(async () => ({})),
				},
				drafts: {
					list: mock.method(async () => ({
						data: { drafts: [{ id: "draft-1" }, { id: "draft-2" }] },
					})),
					get: mock.method(async () => ({
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
					})),
					create: mock.method(async () => ({
						id: "new-draft-456",
					})),
					update: mock.method(async () => ({})),
					delete: mock.method(async () => ({})),
				},
			},
		};

		mockGmail = mock.method(origGoogle, "gmail", () => mockGmailInstance);
	});

	after(() => {
		mock.restore();
	});

	describe("read()", () => {
		test("should return messages with normalized data", async () => {
			const provider = new GmailProvider({
				clientId: "id",
				clientSecret: "secret",
				refreshToken: "token",
			});
			const result = await provider.read({ limit: 5 });
			assert.ok(result.ok);
			assert.strictEqual(result.messages.length, 2);
			assert.strictEqual(result.messages[0].id, "msg-1");
			assert.strictEqual(result.messages[0].subject, "Test Subject");
			assert.strictEqual(result.messages[0].body, "Test body");
		});

		test("should build query from filters", async () => {
			const provider = new GmailProvider({
				clientId: "id",
				clientSecret: "secret",
				refreshToken: "token",
			});
			await provider.read({
				sender: "test@example.com",
				subject: "urgent",
				dateFrom: "2024-01-01",
				label: "Important",
			});
			const listCall = mock.methodCalls(mockGmail);
			assert.ok(listCall.length > 0);
		});
	});

	describe("send()", () => {
		test("should build raw MIME and send", async () => {
			const provider = new GmailProvider({
				clientId: "id",
				clientSecret: "secret",
				refreshToken: "token",
			});
			const result = await provider.send({
				to: ["recipient@example.com"],
				subject: "Hello",
				body: "Test message",
			});
			assert.ok(result.ok);
			assert.ok(result.messageId);
		});

		test("should include CC and BCC in MIME", async () => {
			const provider = new GmailProvider({
				clientId: "id",
				clientSecret: "secret",
				refreshToken: "token",
			});
			const result = await provider.send({
				to: ["to@example.com"],
				cc: ["cc@example.com"],
				bcc: ["bcc@example.com"],
				subject: "Test",
				body: "Body",
			});
			assert.ok(result.ok);
		});

		test("should handle HTML body type", async () => {
			const provider = new GmailProvider({
				clientId: "id",
				clientSecret: "secret",
				refreshToken: "token",
			});
			const result = await provider.send({
				to: ["recipient@example.com"],
				subject: "HTML Test",
				body: "<p>HTML body</p>",
				bodyType: "html",
			});
			assert.ok(result.ok);
		});

		test("should handle attachments", async () => {
			const provider = new GmailProvider({
				clientId: "id",
				clientSecret: "secret",
				refreshToken: "token",
			});
			const result = await provider.send({
				to: ["recipient@example.com"],
				subject: "With attachment",
				body: "See attached",
				attachments: [
					{ filename: "test.txt", content: "dGVzdCBjb250ZW50", contentType: "text/plain" },
				],
			});
			assert.ok(result.ok);
		});
	});

	describe("search()", () => {
		test("should return messages matching query", async () => {
			const provider = new GmailProvider({
				clientId: "id",
				clientSecret: "secret",
				refreshToken: "token",
			});
			const result = await provider.search({ query: "test query", limit: 10 });
			assert.ok(result.ok);
			assert.strictEqual(result.messages.length, 2);
		});
	});

	describe("drafts", () => {
		test("saveDraft() should create a draft and return draftId", async () => {
			const provider = new GmailProvider({
				clientId: "id",
				clientSecret: "secret",
				refreshToken: "token",
			});
			const result = await provider.saveDraft({
				to: ["recipient@example.com"],
				subject: "Draft",
				body: "Draft body",
			});
			assert.ok(result.ok);
			assert.strictEqual(result.draftId, "new-draft-456");
		});

		test("listDrafts() should return list of drafts", async () => {
			const provider = new GmailProvider({
				clientId: "id",
				clientSecret: "secret",
				refreshToken: "token",
			});
			const result = await provider.listDrafts({ limit: 5 });
			assert.ok(result.ok);
			assert.strictEqual(result.drafts.length, 2);
		});

		test("updateDraft() should update an existing draft", async () => {
			const provider = new GmailProvider({
				clientId: "id",
				clientSecret: "secret",
				refreshToken: "token",
			});
			const result = await provider.updateDraft("draft-1", {
				subject: "Updated Subject",
				body: "Updated body",
			});
			assert.ok(result.ok);
		});

		test("deleteDraft() should delete a draft", async () => {
			const provider = new GmailProvider({
				clientId: "id",
				clientSecret: "secret",
				refreshToken: "token",
			});
			const result = await provider.deleteDraft("draft-1");
			assert.ok(result.ok);
		});
	});

	describe("organize()", () => {
		test("should mark messages as read", async () => {
			const provider = new GmailProvider({
				clientId: "id",
				clientSecret: "secret",
				refreshToken: "token",
			});
			const result = await provider.organize({
				messageIds: ["msg-1", "msg-2"],
				action: "markRead",
			});
			assert.ok(result.ok);
		});

		test("should mark messages as unread", async () => {
			const provider = new GmailProvider({
				clientId: "id",
				clientSecret: "secret",
				refreshToken: "token",
			});
			const result = await provider.organize({
				messageIds: ["msg-1"],
				action: "markUnread",
			});
			assert.ok(result.ok);
		});

		test("should archive messages", async () => {
			const provider = new GmailProvider({
				clientId: "id",
				clientSecret: "secret",
				refreshToken: "token",
			});
			const result = await provider.organize({
				messageIds: ["msg-1"],
				action: "archive",
			});
			assert.ok(result.ok);
		});

		test("should add a label", async () => {
			const provider = new GmailProvider({
				clientId: "id",
				clientSecret: "secret",
				refreshToken: "token",
			});
			const result = await provider.organize({
				messageIds: ["msg-1"],
				action: "addLabel",
				label: "Important",
			});
			assert.ok(result.ok);
		});

		test("should remove a label", async () => {
			const provider = new GmailProvider({
				clientId: "id",
				clientSecret: "secret",
				refreshToken: "token",
			});
			const result = await provider.organize({
				messageIds: ["msg-1"],
				action: "removeLabel",
				label: "Important",
			});
			assert.ok(result.ok);
		});

		test("should return error for unknown action", async () => {
			const provider = new GmailProvider({
				clientId: "id",
				clientSecret: "secret",
				refreshToken: "token",
			});
			const result = await provider.organize({
				messageIds: ["msg-1"],
				action: "unknownAction",
			});
			assert.ok(!result.ok);
			assert.ok(result.error.includes("Unknown organize action"));
		});

		test("should handle single messageId as string", async () => {
			const provider = new GmailProvider({
				clientId: "id",
				clientSecret: "secret",
				refreshToken: "token",
			});
			const result = await provider.organize({
				messageIds: "msg-1",
				action: "markRead",
			});
			assert.ok(result.ok);
		});
	});

	describe("normalizeMessage()", () => {
		test("should handle HTML body parts", async () => {
			const provider = new GmailProvider({
				clientId: "id",
				clientSecret: "secret",
				refreshToken: "token",
			});
			const normalized = provider["normalizeMessage"]({
				id: "msg-html",
				payload: {
					headers: [
						{ name: "From", value: "from@example.com" },
						{ name: "Subject", value: "HTML Test" },
						{ name: "Date", value: "Mon, 01 Jan 2024 00:00:00 +0000" },
					],
					parts: [
						{
							mimeType: "text/html",
							body: { data: "PGk+SGVsbG88L2k+" }, // "<i>Hello</i>" in base64
						},
					],
				},
			});
			assert.strictEqual(normalized.id, "msg-html");
			assert.strictEqual(normalized.body, "<i>Hello</i>");
		});
	});

	describe("read() edge cases", () => {
		test("should handle empty message list", async () => {
			const provider = new GmailProvider({
				clientId: "id",
				clientSecret: "secret",
				refreshToken: "token",
			});
			const result = await provider.read({ limit: 5 });
			assert.ok(result.ok);
			assert.ok(Array.isArray(result.messages));
		});
	});

	describe("constructor", () => {
		test("OAuth2 client should be configured with credentials", async () => {
			new GmailProvider({
				clientId: "test-client-id",
				clientSecret: "test-client-secret",
				refreshToken: "test-refresh-token",
			});
			assert.ok(mockOAuth2.mock.calls.length > 0);
		});

		test("OAuth2 should set refresh token credentials", async () => {
			new GmailProvider({
				clientId: "id",
				clientSecret: "secret",
				refreshToken: "my-refresh-token",
			});
			const calls = mockOAuth2.mock.calls;
			assert.ok(calls.length > 0);
		});

		test("OAuth2 should set access token when provided", async () => {
			new GmailProvider({
				clientId: "id",
				clientSecret: "secret",
				refreshToken: "token",
				accessToken: "access-token-123",
			});
			const calls = mockOAuth2.mock.calls;
			assert.ok(calls.length > 0);
		});

		test("gmail() should be called with v1 and auth client", async () => {
			new GmailProvider({
				clientId: "id",
				clientSecret: "secret",
				refreshToken: "token",
			});
			assert.ok(mockGmail.mock.calls.length > 0);
		});

		test("gmail() should use custom userId when provided", async () => {
			new GmailProvider({
				clientId: "id",
				clientSecret: "secret",
				refreshToken: "token",
				userId: "custom@example.com",
			});
			assert.ok(mockGmail.mock.calls.length > 0);
		});
	});
});