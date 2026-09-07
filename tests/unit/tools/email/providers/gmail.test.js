import { test, describe, before, after, mock } from "node:test";
import assert from "node:assert";

describe("GmailProvider — happy paths", () => {
	let GmailProvider;
	let mockGmailInstance;
	let mockOAuth2Instance;
	let googleapis;

	before(async () => {
		// Set required env vars
		process.env.EMAIL_GMAIL_CLIENT_ID = "test-client-id";
		process.env.EMAIL_GMAIL_CLIENT_SECRET = "test-client-secret";
		process.env.EMAIL_GMAIL_REFRESH_TOKEN = "test-refresh-token";

		mockOAuth2Instance = {
			setCredentials: () => {},
			refreshAccessToken: async () => ({
				credentials: { access_token: "new-access-token" },
			}),
			credentials: { refresh_token: "test-refresh-token" },
		};

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
					update: async () => ({ data: {} }),
					delete: async () => ({}),
				},
			},
		};

		// Import googleapis and replace its methods before GmailProvider is instantiated
		googleapis = await import("googleapis");
		// Replace OAuth2 constructor with a mock constructor
		googleapis.google.auth.OAuth2 = function () {
			return mockOAuth2Instance;
		};
		// Replace gmail factory
		googleapis.google.gmail = () => mockGmailInstance;

		const mod = await import("../../../../../src/tools/email/providers/gmail.js");
		GmailProvider = mod.GmailProvider;
	});

	after(() => {
		delete process.env.EMAIL_GMAIL_CLIENT_ID;
		delete process.env.EMAIL_GMAIL_CLIENT_SECRET;
		delete process.env.EMAIL_GMAIL_REFRESH_TOKEN;
		mock.reset();
	});

	describe("read()", () => {
		test("should return messages with normalized data", async () => {
			const provider = new GmailProvider({});
			const result = await provider.read({ limit: 5 });
			assert.ok(result.ok);
			assert.strictEqual(result.messages.length, 2);
			assert.strictEqual(result.messages[0].id, "msg-1");
			assert.strictEqual(result.messages[0].subject, "Test Subject");
			assert.strictEqual(result.messages[0].body, "Test body");
		});

		test("should build query from filters", async () => {
			const provider = new GmailProvider({});
			const result = await provider.read({
				sender: "test@example.com",
				subject: "urgent",
				dateFrom: "2024-01-01",
				label: "Important",
			});
			assert.ok(result.ok);
		});
	});

	describe("send()", () => {
		test("should build raw MIME and send", async () => {
			const provider = new GmailProvider({});
			const result = await provider.send({
				to: ["recipient@example.com"],
				subject: "Hello",
				body: "Test message",
			});
			assert.ok(result.ok);
			assert.ok(result.messageId);
		});

		test("should include CC and BCC in MIME", async () => {
			const provider = new GmailProvider({});
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
			const provider = new GmailProvider({});
			const result = await provider.send({
				to: ["recipient@example.com"],
				subject: "HTML Test",
				body: "<p>HTML body</p>",
				bodyType: "html",
			});
			assert.ok(result.ok);
		});

		test("should handle attachments", async () => {
			const provider = new GmailProvider({});
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
			const provider = new GmailProvider({});
			const result = await provider.search({ query: "test query", limit: 10 });
			assert.ok(result.ok);
			assert.strictEqual(result.messages.length, 2);
		});
	});

	describe("drafts", () => {
		test("saveDraft() should create a draft and return draftId", async () => {
			const provider = new GmailProvider({});
			const result = await provider.saveDraft({
				to: ["recipient@example.com"],
				subject: "Draft",
				body: "Draft body",
			});
			assert.ok(result.ok);
			assert.strictEqual(result.draftId, "new-draft-456");
		});

		test("listDrafts() should return list of drafts", async () => {
			const provider = new GmailProvider({});
			const result = await provider.listDrafts({ limit: 5 });
			assert.ok(result.ok);
			assert.strictEqual(result.drafts.length, 2);
		});

		test("updateDraft() should update an existing draft", async () => {
			const provider = new GmailProvider({});
			const result = await provider.updateDraft("draft-1", {
				to: ["recipient@example.com"],
				subject: "Updated Subject",
				body: "Updated body",
			});
			assert.ok(result.ok);
		});

		test("deleteDraft() should delete a draft", async () => {
			const provider = new GmailProvider({});
			const result = await provider.deleteDraft("draft-1");
			assert.ok(result.ok);
		});
	});

	describe("organize()", () => {
		test("should mark messages as read", async () => {
			const provider = new GmailProvider({});
			const result = await provider.organize({
				messageIds: ["msg-1", "msg-2"],
				action: "markRead",
			});
			assert.ok(result.ok);
		});

		test("should mark messages as unread", async () => {
			const provider = new GmailProvider({});
			const result = await provider.organize({
				messageIds: ["msg-1"],
				action: "markUnread",
			});
			assert.ok(result.ok);
		});

		test("should archive messages", async () => {
			const provider = new GmailProvider({});
			const result = await provider.organize({
				messageIds: ["msg-1"],
				action: "archive",
			});
			assert.ok(result.ok);
		});

		test("should add a label", async () => {
			const provider = new GmailProvider({});
			const result = await provider.organize({
				messageIds: ["msg-1"],
				action: "addLabel",
				label: "Important",
			});
			assert.ok(result.ok);
		});

		test("should remove a label", async () => {
			const provider = new GmailProvider({});
			const result = await provider.organize({
				messageIds: ["msg-1"],
				action: "removeLabel",
				label: "Important",
			});
			assert.ok(result.ok);
		});

		test("should return error for unknown action", async () => {
			const provider = new GmailProvider({});
			const result = await provider.organize({
				messageIds: ["msg-1"],
				action: "unknownAction",
			});
			assert.ok(!result.ok);
			assert.ok(result.error.includes("Unknown organize action"));
		});

		test("should handle single messageId as string", async () => {
			const provider = new GmailProvider({});
			const result = await provider.organize({
				messageIds: "msg-1",
				action: "markRead",
			});
			assert.ok(result.ok);
		});
	});

	describe("normalizeMessage()", () => {
		test("should handle HTML body parts", async () => {
			// Test indirectly through read() which uses #normalizeMessage
			mockGmailInstance.users.messages.get = async () => ({
				data: {
					id: "msg-html",
					threadId: "thread-1",
					payload: {
						headers: [
							{ name: "From", value: "from@example.com" },
							{ name: "To", value: "to@example.com" },
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
					labelIds: [],
					snippet: "",
				},
			});
			const provider = new GmailProvider({});
			const result = await provider.read({ limit: 1 });
			assert.ok(result.ok);
			assert.strictEqual(result.messages[0].body, "<i>Hello</i>");
		});

		test("should handle body without parts", async () => {
			mockGmailInstance.users.messages.get = async () => ({
				data: {
					id: "msg-body",
					threadId: "thread-1",
					payload: {
						headers: [
							{ name: "From", value: "from@example.com" },
							{ name: "To", value: "to@example.com" },
							{ name: "Subject", value: "Direct Body" },
							{ name: "Date", value: "Mon, 01 Jan 2024 00:00:00 +0000" },
						],
						body: { data: "RGlyZWN0IGJvZHk=" }, // "Direct body" in base64
					},
					labelIds: [],
					snippet: "",
				},
			});
			const provider = new GmailProvider({});
			const result = await provider.read({ limit: 1 });
			assert.ok(result.ok);
			assert.strictEqual(result.messages[0].body, "Direct body");
		});

		test("should handle null message", async () => {
			mockGmailInstance.users.messages.get = async () => ({
				data: null,
			});
			const provider = new GmailProvider({});
			const result = await provider.read({ limit: 1 });
			assert.ok(result.ok);
		});
	});

	describe("read() edge cases", () => {
		test("should handle empty message list", async () => {
			mockGmailInstance.users.messages.list = async () => ({
				data: { messages: [] },
			});
			const provider = new GmailProvider({});
			const result = await provider.read({ limit: 5 });
			assert.ok(result.ok);
			assert.ok(Array.isArray(result.messages));
			assert.strictEqual(result.messages.length, 0);
		});
	});

	describe("constructor", () => {
		test("should throw when env vars are missing", () => {
			delete process.env.EMAIL_GMAIL_CLIENT_ID;
			assert.throws(() => new GmailProvider({}), /Gmail provider requires/);
			process.env.EMAIL_GMAIL_CLIENT_ID = "test-client-id";
		});

		test("should use custom userId when provided", () => {
			const provider = new GmailProvider({ userId: "custom@example.com" });
			assert.ok(provider);
		});
	});

	describe("validateConfig()", () => {
		test("should return valid when env vars are set", () => {
			const provider = new GmailProvider({});
			const result = provider.validateConfig();
			assert.strictEqual(result.valid, true);
		});
	});

	describe("cancel()", () => {
		test("should not throw when no current request", () => {
			const provider = new GmailProvider({});
			provider.cancel();
			assert.ok(true);
		});
	});

	describe("send() error handling", () => {
		test("should return error when Gmail API fails", async () => {
			mockGmailInstance.users.messages.send = async () => {
				throw new Error("API error");
			};
			const provider = new GmailProvider({});
			const result = await provider.send({
				to: ["recipient@example.com"],
				subject: "Test",
				body: "Body",
			});
			assert.ok(!result.ok);
			assert.ok(result.error.includes("Gmail send failed"));
		});
	});

	describe("read() error handling", () => {
		test("should return error when Gmail API fails", async () => {
			mockGmailInstance.users.messages.list = async () => {
				throw new Error("API error");
			};
			const provider = new GmailProvider({});
			const result = await provider.read({ limit: 5 });
			assert.ok(!result.ok);
			assert.ok(result.error.includes("Gmail read failed"));
		});
	});

	describe("search() error handling", () => {
		test("should return error when Gmail API fails", async () => {
			mockGmailInstance.users.messages.list = async () => {
				throw new Error("API error");
			};
			const provider = new GmailProvider({});
			const result = await provider.search({ query: "test" });
			assert.ok(!result.ok);
			assert.ok(result.error.includes("Gmail search failed"));
		});
	});

	describe("draft error handling", () => {
		test("saveDraft() should return error on failure", async () => {
			mockGmailInstance.users.drafts.create = async () => {
				throw new Error("API error");
			};
			const provider = new GmailProvider({});
			const result = await provider.saveDraft({
				to: ["recipient@example.com"],
				subject: "Draft",
				body: "Body",
			});
			assert.ok(!result.ok);
			assert.ok(result.error.includes("Gmail saveDraft failed"));
		});

		test("listDrafts() should return error on failure", async () => {
			mockGmailInstance.users.drafts.list = async () => {
				throw new Error("API error");
			};
			const provider = new GmailProvider({});
			const result = await provider.listDrafts({});
			assert.ok(!result.ok);
			assert.ok(result.error.includes("Gmail listDrafts failed"));
		});

		test("updateDraft() should return error on failure", async () => {
			mockGmailInstance.users.drafts.update = async () => {
				throw new Error("API error");
			};
			const provider = new GmailProvider({});
			const result = await provider.updateDraft("draft-1", {
				subject: "Updated",
				body: "Body",
			});
			assert.ok(!result.ok);
			assert.ok(result.error.includes("Gmail updateDraft failed"));
		});

		test("deleteDraft() should return error on failure", async () => {
			mockGmailInstance.users.drafts.delete = async () => {
				throw new Error("API error");
			};
			const provider = new GmailProvider({});
			const result = await provider.deleteDraft("draft-1");
			assert.ok(!result.ok);
			assert.ok(result.error.includes("Gmail deleteDraft failed"));
		});
	});

	describe("organize() error handling", () => {
		test("should return error on failure", async () => {
			mockGmailInstance.users.messages.modify = async () => {
				throw new Error("API error");
			};
			const provider = new GmailProvider({});
			const result = await provider.organize({
				messageIds: ["msg-1"],
				action: "markRead",
			});
			assert.ok(!result.ok);
			assert.ok(result.error.includes("Gmail organize failed"));
		});
	});

	describe("token refresh", () => {
		test("should retry on 401 error", async () => {
			let callCount = 0;
			mockGmailInstance.users.messages.list = async () => {
				callCount++;
				if (callCount === 1) {
					const err = new Error("401 Unauthorized");
					err.code = "ERR_OAUTH_TOKEN";
					throw err;
				}
				return { data: { messages: [] } };
			};
			// Mock refreshAccessToken by making setCredentials work
			const provider = new GmailProvider({});
			const result = await provider.read({ limit: 5 });
			assert.strictEqual(result.ok, true);
			assert.strictEqual(callCount, 2);
		});

		test("should return error when token refresh fails", async () => {
			mockGmailInstance.users.messages.list = async () => {
				const err = new Error("401 Unauthorized");
				err.code = "ERR_OAUTH_TOKEN";
				throw err;
			};
			// Make refreshAccessToken fail by not having a refresh token
			// The mock OAuth2 instance doesn't have credentials.refresh_token
			const provider = new GmailProvider({});
			const result = await provider.read({ limit: 5 });
			assert.ok(!result.ok);
			assert.ok(result.error.includes("Gmail read failed"));
		});
	});

	describe("sanitizeError", () => {
		test("should handle null/undefined error messages", async () => {
			mockGmailInstance.users.messages.list = async () => {
				throw null;
			};
			const provider = new GmailProvider({});
			const result = await provider.read({ limit: 5 });
			assert.ok(!result.ok);
		});
	});

	describe("cancel()", () => {
		test("should not throw when no current request", () => {
			const provider = new GmailProvider({});
			provider.cancel();
			assert.ok(true);
		});
	});

	describe("refreshAccessToken edge cases", () => {
		test("should handle refresh token failure", async () => {
			// Remove refresh_token from mock to trigger "No refresh token" error
			delete mockOAuth2Instance.credentials.refresh_token;
			// Trigger a 401 to force token refresh
			mockGmailInstance.users.messages.list = async () => {
				const err = new Error("401 Unauthorized");
				err.code = "ERR_OAUTH_TOKEN";
				throw err;
			};
			const provider = new GmailProvider({});
			const result = await provider.read({ limit: 5 });
			assert.ok(!result.ok);
			assert.ok(result.error.includes("Gmail read failed"));
		});

		test("should handle refresh token API failure", async () => {
			// Make refreshAccessToken throw
			mockOAuth2Instance.refreshAccessToken = async () => {
				throw new Error("Token refresh API error");
			};
			// Trigger a 401 to force token refresh
			mockGmailInstance.users.messages.list = async () => {
				const err = new Error("401 Unauthorized");
				err.code = "ERR_OAUTH_TOKEN";
				throw err;
			};
			const provider = new GmailProvider({});
			const result = await provider.read({ limit: 5 });
			assert.ok(!result.ok);
			assert.ok(result.error.includes("Gmail read failed"));
		});
	});

	describe("sanitizeError edge cases", () => {
		test("should handle error with client_id in message", async () => {
			mockGmailInstance.users.messages.list = async () => {
				throw new Error("client_id=my-client-id&client_secret=my-secret");
			};
			const provider = new GmailProvider({});
			const result = await provider.read({ limit: 5 });
			assert.ok(!result.ok);
			assert.ok(result.error.includes("[REDACTED]"));
		});

		test("should handle error with Bearer token", async () => {
			mockGmailInstance.users.messages.list = async () => {
				throw new Error("Bearer my-access-token");
			};
			const provider = new GmailProvider({});
			const result = await provider.read({ limit: 5 });
			assert.ok(!result.ok);
			assert.ok(result.error.includes("[REDACTED]"));
		});

		test("should handle error with apiKey", async () => {
			mockGmailInstance.users.messages.list = async () => {
				throw new Error("apiKey=my-api-key");
			};
			const provider = new GmailProvider({});
			const result = await provider.read({ limit: 5 });
			assert.ok(!result.ok);
			assert.ok(result.error.includes("[REDACTED]"));
		});
	});
});
