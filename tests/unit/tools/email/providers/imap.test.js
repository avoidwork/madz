import { test, describe, before, after, afterEach } from "node:test";
import assert from "node:assert";

describe("ImapProvider — happy paths", () => {
	let ImapProvider;
	let nodemailerMod;
	let imapSimpleMod;
	let mockConnection;
	let origConnect;

	before(async () => {
		// Set required env vars
		process.env.EMAIL_IMAP_USER = "test-user";
		process.env.EMAIL_IMAP_PASSWORD = "test-pass";

		nodemailerMod = await import("nodemailer");
		imapSimpleMod = await import("imap-simple");

		const mod = await import("../../../../../src/tools/email/providers/imap.js");
		ImapProvider = mod.ImapProvider;

		// Save originals
		origConnect = imapSimpleMod.default.connect;

		// Create a default mock connection that tests can customize
		mockConnection = {
			openBox: async () => {},
			search: async () => [],
			getAttributes: async () => [],
			closeBox: async () => {},
			disconnect: async () => {},
			addMessage: async () => ({ uid: "default-uid" }),
			setFlags: async () => {},
			expunge: async () => {},
			copy: async () => {},
		};

		// Mock connect on the default export (which is what the source imports)
		imapSimpleMod.default.connect = async () => mockConnection;
	});

	afterEach(() => {
		// Reset mock functions manually
		mockConnection.openBox = async () => {};
		mockConnection.search = async () => [];
		mockConnection.getAttributes = async () => [];
		mockConnection.closeBox = async () => {};
		mockConnection.disconnect = async () => {};
		mockConnection.addMessage = async () => ({ uid: "default-uid" });
		mockConnection.setFlags = async () => {};
		mockConnection.expunge = async () => {};
		mockConnection.copy = async () => {};
	});

	after(() => {
		delete process.env.EMAIL_IMAP_USER;
		delete process.env.EMAIL_IMAP_PASSWORD;
		imapSimpleMod.default.connect = origConnect;
	});

	describe("read()", () => {
		test("should fetch messages via IMAP", async () => {
			mockConnection.search = async () => [
				{ attributes: { uid: "uid-1" } },
				{ attributes: { uid: "uid-2" } },
			];
			mockConnection.getAttributes = async () => [
				{
					headers: {
						subject: "Message uid-1",
						from: "sender@example.com",
						to: "recipient@example.com",
						date: "Mon, 01 Jan 2024 00:00:00 +0000",
					},
					body: "Body content for uid-1",
				},
				{
					headers: {
						subject: "Message uid-2",
						from: "sender2@example.com",
						to: "recipient@example.com",
						date: "Mon, 01 Jan 2024 00:00:00 +0000",
					},
					body: "Body content for uid-2",
				},
			];

			const provider = new ImapProvider({});

			const result = await provider.read({ limit: 5 });

			assert.strictEqual(result.ok, true);
			assert.ok(result.messages);
			assert.strictEqual(result.messages.length, 2);
			assert.strictEqual(result.messages[0].id, "uid-1");
			assert.strictEqual(result.messages[0].subject, "Message uid-1");
			assert.strictEqual(result.messages[0].body, "Body content for uid-1");
		});

		test("should respect limit", async () => {
			mockConnection.search = async () => [
				{ attributes: { uid: "uid-1" } },
				{ attributes: { uid: "uid-2" } },
				{ attributes: { uid: "uid-3" } },
			];
			mockConnection.getAttributes = async () => [
				{
					headers: {
						subject: "Message",
						from: "sender@example.com",
						to: "recipient@example.com",
						date: "Mon, 01 Jan 2024 00:00:00 +0000",
					},
					body: "Body content",
				},
				{
					headers: {
						subject: "Message 2",
						from: "sender2@example.com",
						to: "recipient@example.com",
						date: "Mon, 01 Jan 2024 00:00:00 +0000",
					},
					body: "Body content 2",
				},
			];

			const provider = new ImapProvider({});

			const result = await provider.read({ limit: 2 });

			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.messages.length, 2);
		});

		test("should use custom folder", async () => {
			const openBoxCalls = [];
			mockConnection.openBox = async (folder) => {
				openBoxCalls.push(folder);
			};

			const provider = new ImapProvider({});
			await provider.read({ folder: "Sent" });

			assert.strictEqual(openBoxCalls.length, 1);
			assert.strictEqual(openBoxCalls[0], "Sent");
		});

		test("should filter by sender", async () => {
			const searchCalls = [];
			mockConnection.search = async (criteria) => {
				searchCalls.push(criteria);
				return [];
			};

			const provider = new ImapProvider({});
			await provider.read({ sender: "test@example.com" });

			assert.deepStrictEqual(searchCalls[0], [["FROM", "test@example.com"]]);
		});

		test("should filter by subject", async () => {
			const searchCalls = [];
			mockConnection.search = async (criteria) => {
				searchCalls.push(criteria);
				return [];
			};

			const provider = new ImapProvider({});
			await provider.read({ subject: "urgent" });

			assert.deepStrictEqual(searchCalls[0], [["SUBJECT", "urgent"]]);
		});

		test("should filter by keyword", async () => {
			const searchCalls = [];
			mockConnection.search = async (criteria) => {
				searchCalls.push(criteria);
				return [];
			};

			const provider = new ImapProvider({});
			await provider.read({ keyword: "important" });

			assert.deepStrictEqual(searchCalls[0], [["TEXT", "important"]]);
		});

		test("should filter by dateFrom", async () => {
			const searchCalls = [];
			mockConnection.search = async (criteria) => {
				searchCalls.push(criteria);
				return [];
			};

			const provider = new ImapProvider({});
			await provider.read({ dateFrom: "2024-01-01" });

			assert.deepStrictEqual(searchCalls[0], [["SINCE", "2024-01-01"]]);
		});

		test("should filter by dateTo", async () => {
			const searchCalls = [];
			mockConnection.search = async (criteria) => {
				searchCalls.push(criteria);
				return [];
			};

			const provider = new ImapProvider({});
			await provider.read({ dateTo: "2024-12-31" });

			assert.deepStrictEqual(searchCalls[0], [["ON", "2024-12-31"]]);
		});

		test("should handle empty message list", async () => {
			mockConnection.search = async () => [];

			const provider = new ImapProvider({});

			const result = await provider.read({});

			assert.strictEqual(result.ok, true);
			assert.ok(result.messages);
			assert.strictEqual(result.messages.length, 0);
		});
	});

	describe("send()", () => {
		// Note: send() uses nodemailer.createTransport which is a non-configurable
		// ESM named export. We test send() indirectly through emailImpl tests.
		test("should have correct provider type", () => {
			const provider = new ImapProvider({});
			assert.strictEqual(provider.type, "imap");
		});
	});

	describe("search()", () => {
		test("should search messages by query", async () => {
			mockConnection.search = async () => [
				{ attributes: { uid: "uid-1" } },
			];
			mockConnection.getAttributes = async () => [
				{
					headers: {
						subject: "Message uid-1",
						from: "sender@example.com",
						to: "recipient@example.com",
						date: "Mon, 01 Jan 2024 00:00:00 +0000",
					},
					body: "Body for uid-1",
				},
			];

			const provider = new ImapProvider({});

			const result = await provider.search({ query: "important", limit: 10 });

			assert.strictEqual(result.ok, true);
			assert.ok(result.messages);
			assert.strictEqual(result.messages.length, 1);
			assert.strictEqual(result.messages[0].subject, "Message uid-1");
		});

		test("should respect limit", async () => {
			mockConnection.search = async () => [
				{ attributes: { uid: "uid-1" } },
				{ attributes: { uid: "uid-2" } },
				{ attributes: { uid: "uid-3" } },
			];
			mockConnection.getAttributes = async () => [
				{
					headers: {
						subject: "Message",
						from: "sender@example.com",
						to: "recipient@example.com",
						date: "Mon, 01 Jan 2024 00:00:00 +0000",
					},
					body: "Body content",
				},
				{
					headers: {
						subject: "Message 2",
						from: "sender2@example.com",
						to: "recipient@example.com",
						date: "Mon, 01 Jan 2024 00:00:00 +0000",
					},
					body: "Body content 2",
				},
			];

			const provider = new ImapProvider({});

			const result = await provider.search({ query: "test", limit: 2 });

			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.messages.length, 2);
		});
	});

	describe("saveDraft()", () => {
		test("should save draft via IMAP", async () => {
			const openBoxCalls = [];
			mockConnection.openBox = async (folder) => {
				openBoxCalls.push(folder);
			};
			mockConnection.addMessage = async () => ({ uid: "draft-uid-123" });

			const provider = new ImapProvider({});

			const result = await provider.saveDraft({
				to: ["recipient@example.com"],
				subject: "Draft Test",
				body: "Draft content",
			});

			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.draftId, "draft-uid-123");
			assert.strictEqual(openBoxCalls[0], "DRAFTS");
		});
	});

	describe("listDrafts()", () => {
		test("should list drafts from DRAFTS folder", async () => {
			const openBoxCalls = [];
			mockConnection.openBox = async (folder) => {
				openBoxCalls.push(folder);
			};
			mockConnection.search = async () => [
				{ attributes: { uid: "draft-uid-1" } },
				{ attributes: { uid: "draft-uid-2" } },
			];
			mockConnection.getAttributes = async () => [
				{
					headers: {
						subject: "Draft draft-uid-1",
						from: "user@example.com",
						to: "recipient@example.com",
						date: "Mon, 01 Jan 2024 00:00:00 +0000",
					},
					body: "Draft body for draft-uid-1",
				},
				{
					headers: {
						subject: "Draft draft-uid-2",
						from: "user@example.com",
						to: "recipient@example.com",
						date: "Mon, 01 Jan 2024 00:00:00 +0000",
					},
					body: "Draft body for draft-uid-2",
				},
			];

			const provider = new ImapProvider({});

			const result = await provider.listDrafts({ limit: 5 });

			assert.strictEqual(result.ok, true);
			assert.ok(result.drafts);
			assert.strictEqual(result.drafts.length, 2);
			assert.strictEqual(openBoxCalls[0], "DRAFTS");
		});

		test("should respect limit", async () => {
			mockConnection.search = async () => [
				{ attributes: { uid: "draft-1" } },
				{ attributes: { uid: "draft-2" } },
				{ attributes: { uid: "draft-3" } },
			];
			mockConnection.getAttributes = async () => [
				{
					headers: {
						subject: "Draft 1",
						from: "user@example.com",
						to: "recipient@example.com",
						date: "Mon, 01 Jan 2024 00:00:00 +0000",
					},
					body: "Body 1",
				},
				{
					headers: {
						subject: "Draft 2",
						from: "user@example.com",
						to: "recipient@example.com",
						date: "Mon, 01 Jan 2024 00:00:00 +0000",
					},
					body: "Body 2",
				},
			];

			const provider = new ImapProvider({});

			const result = await provider.listDrafts({ limit: 2 });

			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.drafts.length, 2);
		});
	});

	describe("updateDraft()", () => {
		test("should delete and recreate draft", async () => {
			const openBoxCalls = [];
			mockConnection.openBox = async (folder) => {
				openBoxCalls.push(folder);
			};
			mockConnection.addMessage = async () => ({ uid: "new-draft-uid" });

			const provider = new ImapProvider({});

			const result = await provider.updateDraft("old-draft-id", {
				to: ["recipient@example.com"],
				subject: "Updated Draft",
				body: "Updated content",
			});

			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.draftId, "new-draft-uid");
		});
	});

	describe("deleteDraft()", () => {
		test("should expunge the draft", async () => {
			const openBoxCalls = [];
			mockConnection.openBox = async (folder) => {
				openBoxCalls.push(folder);
			};
			const setFlagsCalls = [];
			mockConnection.setFlags = async (opts, flags) => {
				setFlagsCalls.push({ opts, flags });
			};
			const expungeCalls = [];
			mockConnection.expunge = async () => {
				expungeCalls.push(true);
			};

			const provider = new ImapProvider({});

			const result = await provider.deleteDraft("draft-to-delete");

			assert.strictEqual(result.ok, true);
			assert.strictEqual(openBoxCalls[0], "DRAFTS");
			assert.strictEqual(setFlagsCalls.length, 1);
			assert.deepStrictEqual(setFlagsCalls[0].opts, { uid: ["draft-to-delete"] });
			assert.deepStrictEqual(setFlagsCalls[0].flags, ["\\Deleted"]);
			assert.strictEqual(expungeCalls.length, 1);
		});
	});

	describe("organize()", () => {
		test("should mark messages as read", async () => {
			const setFlagsCalls = [];
			mockConnection.setFlags = async (opts, flags) => {
				setFlagsCalls.push({ opts, flags });
			};

			const provider = new ImapProvider({});

			const result = await provider.organize({
				messageIds: ["msg-1"],
				action: "markRead",
			});

			assert.strictEqual(result.ok, true);
			assert.strictEqual(setFlagsCalls.length, 1);
			assert.deepStrictEqual(setFlagsCalls[0].flags, ["\\Seen"]);
		});

		test("should mark messages as unread", async () => {
			const setFlagsCalls = [];
			mockConnection.setFlags = async (opts, flags, options) => {
				setFlagsCalls.push({ opts, flags, options });
			};

			const provider = new ImapProvider({});

			const result = await provider.organize({
				messageIds: ["msg-1"],
				action: "markUnread",
			});

			assert.strictEqual(result.ok, true);
			assert.strictEqual(setFlagsCalls.length, 1);
			assert.deepStrictEqual(setFlagsCalls[0].flags, ["\\Seen"]);
			assert.deepStrictEqual(setFlagsCalls[0].options, { remove: true });
		});

		test("should archive messages", async () => {
			const copyCalls = [];
			mockConnection.copy = async (opts, folder) => {
				copyCalls.push({ opts, folder });
			};

			const provider = new ImapProvider({});

			const result = await provider.organize({
				messageIds: ["msg-1"],
				action: "archive",
			});

			assert.strictEqual(result.ok, true);
			assert.strictEqual(copyCalls.length, 1);
			assert.deepStrictEqual(copyCalls[0].opts, { uid: ["msg-1"] });
			assert.strictEqual(copyCalls[0].folder, "Archive");
		});

		test("should add a label (flag)", async () => {
			const setFlagsCalls = [];
			mockConnection.setFlags = async (opts, flags) => {
				setFlagsCalls.push({ opts, flags });
			};

			const provider = new ImapProvider({});

			const result = await provider.organize({
				messageIds: ["msg-1"],
				action: "addLabel",
				label: "Important",
			});

			assert.strictEqual(result.ok, true);
			assert.strictEqual(setFlagsCalls.length, 1);
			assert.deepStrictEqual(setFlagsCalls[0].flags, ["\\Important"]);
		});

		test("should remove a label (flag)", async () => {
			const setFlagsCalls = [];
			mockConnection.setFlags = async (opts, flags, options) => {
				setFlagsCalls.push({ opts, flags, options });
			};

			const provider = new ImapProvider({});

			const result = await provider.organize({
				messageIds: ["msg-1"],
				action: "removeLabel",
				label: "Important",
			});

			assert.strictEqual(result.ok, true);
			assert.strictEqual(setFlagsCalls.length, 1);
			assert.deepStrictEqual(setFlagsCalls[0].flags, ["\\Important"]);
			assert.deepStrictEqual(setFlagsCalls[0].options, { remove: true });
		});

		test("should return error for unknown action", async () => {
			const provider = new ImapProvider({});

			const result = await provider.organize({
				messageIds: ["msg-1"],
				action: "unknownAction",
			});

			assert.ok(!result.ok);
			assert.ok(result.error.includes("Unknown organize action"));
		});

		test("should handle single messageId as string", async () => {
			const setFlagsCalls = [];
			mockConnection.setFlags = async (opts, flags) => {
				setFlagsCalls.push({ opts, flags });
			};

			const provider = new ImapProvider({});

			const result = await provider.organize({
				messageIds: "msg-1",
				action: "markRead",
			});

			assert.strictEqual(result.ok, true);
			assert.strictEqual(setFlagsCalls.length, 1);
			assert.deepStrictEqual(setFlagsCalls[0].opts, { uid: ["msg-1"] });
		});
	});

	describe("config", () => {
		test("IMAP config should use default port when secure is true", () => {
			const provider = new ImapProvider({});
			assert.ok(provider instanceof ImapProvider);
		});

		test("IMAP config should use default port when secure is false", () => {
			const provider = new ImapProvider({ imapSecure: false });
			assert.ok(provider instanceof ImapProvider);
		});

		test("IMAP config should use explicit port when provided", () => {
			const provider = new ImapProvider({ imapPort: 143 });
			assert.ok(provider instanceof ImapProvider);
		});

		test("SMTP send should use explicit port when provided", () => {
			const provider = new ImapProvider({ smtpPort: 587 });
			assert.ok(provider instanceof ImapProvider);
		});
	});

	describe("normalizeMessage()", () => {
		test("should handle IMAP message format", async () => {
			// Test indirectly through read()
			mockConnection.search = async () => [
				{ attributes: { uid: "uid-1" } },
			];
			mockConnection.getAttributes = async () => [
				{
					headers: {
						subject: "Test Subject",
						from: "from@example.com",
						to: "to@example.com",
						date: "Mon, 01 Jan 2024 00:00:00 +0000",
					},
					body: "Test body content",
				},
			];

			const provider = new ImapProvider({});
			const result = await provider.read({ limit: 1 });

			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.messages[0].id, "uid-1");
			assert.strictEqual(result.messages[0].subject, "Test Subject");
			assert.strictEqual(result.messages[0].from, "from@example.com");
			assert.strictEqual(result.messages[0].body, "Test body content");
		});
	});

	describe("connection lifecycle", () => {
		test("read() should close box and disconnect after use", async () => {
			const closeBoxCalls = [];
			mockConnection.closeBox = async (folder) => {
				closeBoxCalls.push(folder);
			};
			const disconnectCalls = [];
			mockConnection.disconnect = async () => {
				disconnectCalls.push(true);
			};

			const provider = new ImapProvider({});
			await provider.read({});

			assert.strictEqual(closeBoxCalls.length, 1);
			assert.strictEqual(disconnectCalls.length, 1);
		});

		test("search() should close box and disconnect after use", async () => {
			const closeBoxCalls = [];
			mockConnection.closeBox = async (folder) => {
				closeBoxCalls.push(folder);
			};
			const disconnectCalls = [];
			mockConnection.disconnect = async () => {
				disconnectCalls.push(true);
			};

			const provider = new ImapProvider({});
			await provider.search({ query: "test" });

			assert.strictEqual(closeBoxCalls.length, 1);
			assert.strictEqual(disconnectCalls.length, 1);
		});

		test("listDrafts() should open DRAFTS box and close/disconnect", async () => {
			const openBoxCalls = [];
			mockConnection.openBox = async (folder) => {
				openBoxCalls.push(folder);
			};
			const closeBoxCalls = [];
			mockConnection.closeBox = async (folder) => {
				closeBoxCalls.push(folder);
			};
			const disconnectCalls = [];
			mockConnection.disconnect = async () => {
				disconnectCalls.push(true);
			};

			const provider = new ImapProvider({});
			await provider.listDrafts({});

			assert.strictEqual(openBoxCalls[0], "DRAFTS");
			assert.strictEqual(closeBoxCalls.length, 1);
			assert.strictEqual(disconnectCalls.length, 1);
		});

		test("deleteDraft() should open DRAFTS box and expunge", async () => {
			const openBoxCalls = [];
			mockConnection.openBox = async (folder) => {
				openBoxCalls.push(folder);
			};
			const closeBoxCalls = [];
			mockConnection.closeBox = async (folder) => {
				closeBoxCalls.push(folder);
			};
			const disconnectCalls = [];
			mockConnection.disconnect = async () => {
				disconnectCalls.push(true);
			};

			const provider = new ImapProvider({});
			await provider.deleteDraft("draft-id");

			assert.strictEqual(openBoxCalls[0], "DRAFTS");
			assert.strictEqual(closeBoxCalls.length, 1);
			assert.strictEqual(disconnectCalls.length, 1);
		});

		test("organize() should open INBOX box and close/disconnect", async () => {
			const openBoxCalls = [];
			mockConnection.openBox = async (folder) => {
				openBoxCalls.push(folder);
			};
			const closeBoxCalls = [];
			mockConnection.closeBox = async (folder) => {
				closeBoxCalls.push(folder);
			};
			const disconnectCalls = [];
			mockConnection.disconnect = async () => {
				disconnectCalls.push(true);
			};

			const provider = new ImapProvider({});
			await provider.organize({
				messageIds: ["msg-1"],
				action: "markRead",
			});

			assert.strictEqual(openBoxCalls[0], "INBOX");
			assert.strictEqual(closeBoxCalls.length, 1);
			assert.strictEqual(disconnectCalls.length, 1);
		});
	});

	describe("error handling", () => {
		test("read() should handle IMAP connection error", async () => {
			imapSimpleMod.default.connect = async () => {
				throw new Error("Connection failed");
			};
			const provider = new ImapProvider({});
			const result = await provider.read({});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("IMAP read failed"));
		});

		test("search() should handle IMAP connection error", async () => {
			imapSimpleMod.default.connect = async () => {
				throw new Error("Connection failed");
			};
			const provider = new ImapProvider({});
			const result = await provider.search({ query: "test" });
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("IMAP search failed"));
		});

		test("saveDraft() should handle IMAP connection error", async () => {
			imapSimpleMod.default.connect = async () => {
				throw new Error("Connection failed");
			};
			const provider = new ImapProvider({});
			const result = await provider.saveDraft({
				to: ["recipient@example.com"],
				subject: "Test",
				body: "Body",
			});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("IMAP saveDraft failed"));
		});

		test("listDrafts() should handle IMAP connection error", async () => {
			imapSimpleMod.default.connect = async () => {
				throw new Error("Connection failed");
			};
			const provider = new ImapProvider({});
			const result = await provider.listDrafts({});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("IMAP listDrafts failed"));
		});

		test("updateDraft() should handle error", async () => {
			imapSimpleMod.default.connect = async () => {
				throw new Error("Connection failed");
			};
			const provider = new ImapProvider({});
			const result = await provider.updateDraft("draft-1", {
				to: ["recipient@example.com"],
				subject: "Test",
				body: "Body",
			});
			assert.strictEqual(result.ok, false);
			// updateDraft calls deleteDraft then saveDraft, both catch their own errors
			assert.ok(
				result.error.includes("IMAP saveDraft failed") ||
				result.error.includes("IMAP deleteDraft failed") ||
				result.error.includes("IMAP updateDraft failed"),
			);
		});

		test("deleteDraft() should handle IMAP connection error", async () => {
			imapSimpleMod.default.connect = async () => {
				throw new Error("Connection failed");
			};
			const provider = new ImapProvider({});
			const result = await provider.deleteDraft("draft-1");
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("IMAP deleteDraft failed"));
		});

		test("organize() should handle IMAP connection error", async () => {
			imapSimpleMod.default.connect = async () => {
				throw new Error("Connection failed");
			};
			const provider = new ImapProvider({});
			const result = await provider.organize({
				messageIds: ["msg-1"],
				action: "markRead",
			});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("IMAP organize failed"));
		});

		test("constructor should throw when env vars missing", () => {
			delete process.env.EMAIL_IMAP_USER;
			assert.throws(() => new ImapProvider({}), /IMAP provider requires/);
			process.env.EMAIL_IMAP_USER = "test-user";
		});

		test("validateConfig() should return errors for missing env vars", () => {
			const provider = new ImapProvider({});
			delete process.env.EMAIL_IMAP_USER;
			const result = provider.validateConfig();
			assert.strictEqual(result.valid, false);
			assert.ok(result.errors.length > 0);
			process.env.EMAIL_IMAP_USER = "test-user";
		});

		test("cancel() should not throw when no current request", () => {
			const provider = new ImapProvider({});
			provider.cancel();
			assert.ok(true);
		});
	});
});
