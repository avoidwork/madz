import { test, describe, before, after, mock } from "node:test";
import assert from "node:assert";
import { ImapProvider } from "../../../../../src/tools/email/providers/imap.js";

describe("ImapProvider — happy paths", () => {
	let origFetch;
	let nodemailerMod;
	let imapSimpleMod;

	before(async () => {
		origFetch = globalThis.fetch;
		nodemailerMod = await import("nodemailer");
		imapSimpleMod = await import("imap-simple");
	});

	after(() => {
		globalThis.fetch = origFetch;
		mock.restore();
	});

	test("read() should fetch messages via IMAP", async () => {
		const mockConnection = {
			openBox: mock.method(async () => {}),
			search: mock.method(async () => [
				{ attributes: { uid: "uid-1" } },
				{ attributes: { uid: "uid-2" } },
			]),
			getAttributes: mock.method(async (uid) => ({
				headers: {
					subject: `Message ${uid}`,
					from: "sender@example.com",
					to: "recipient@example.com",
					date: "Mon, 01 Jan 2024 00:00:00 +0000",
				},
				body: `Body content for ${uid}`,
			})),
			closeBox: mock.method(async () => {}),
			disconnect: mock.method(async () => {}),
		};

		mock.method(imapSimpleMod, "connect", async () => mockConnection);

		const provider = new ImapProvider({
			host: "imap.example.com",
			port: 993,
			secure: true,
			user: "user",
			password: "pass",
		});

		const result = await provider.read({ limit: 5 });

		assert.strictEqual(result.ok, true);
		assert.ok(result.messages);
		assert.strictEqual(result.messages.length, 2);
		assert.strictEqual(result.messages[0].id, "uid-1");
		assert.strictEqual(result.messages[0].subject, "Message uid-1");
		assert.strictEqual(result.messages[0].body, "Body content for uid-1");
	});

	test("read() should respect limit", async () => {
		const mockConnection = {
			openBox: mock.method(async () => {}),
			search: mock.method(async () => [
				{ attributes: { uid: "uid-1" } },
				{ attributes: { uid: "uid-2" } },
				{ attributes: { uid: "uid-3" } },
			]),
			getAttributes: mock.method(async (uid) => ({
				headers: {
					subject: `Message ${uid}`,
					from: "sender@example.com",
					to: "recipient@example.com",
					date: "Mon, 01 Jan 2024 00:00:00 +0000",
				},
				body: `Body content for ${uid}`,
			})),
			closeBox: mock.method(async () => {}),
			disconnect: mock.method(async () => {}),
		};

		mock.method(imapSimpleMod, "connect", async () => mockConnection);

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		const result = await provider.read({ limit: 2 });

		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.messages.length, 2);
	});

	test("read() should use custom folder", async () => {
		const mockConnection = {
			openBox: mock.method(async () => {}),
			search: mock.method(async () => []),
			getAttributes: mock.method(async () => ({})),
			closeBox: mock.method(async () => {}),
			disconnect: mock.method(async () => {}),
		};

		mock.method(imapSimpleMod, "connect", async () => mockConnection);

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		await provider.read({ folder: "Sent" });

		const openBoxCall = mock.methodCalls(mockConnection.openBox);
		assert.strictEqual(openBoxCall[0].arguments[0], "Sent");
	});

	test("read() should filter by sender", async () => {
		const mockConnection = {
			openBox: mock.method(async () => {}),
			search: mock.method(async () => []),
			getAttributes: mock.method(async () => ({})),
			closeBox: mock.method(async () => {}),
			disconnect: mock.method(async () => {}),
		};

		mock.method(imapSimpleMod, "connect", async () => mockConnection);

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		await provider.read({ sender: "test@example.com" });

		const searchCall = mock.methodCalls(mockConnection.search);
		assert.deepStrictEqual(searchCall[0].arguments[0], [["FROM", "test@example.com"]]);
	});

	test("read() should filter by subject", async () => {
		const mockConnection = {
			openBox: mock.method(async () => {}),
			search: mock.method(async () => []),
			getAttributes: mock.method(async () => ({})),
			closeBox: mock.method(async () => {}),
			disconnect: mock.method(async () => {}),
		};

		mock.method(imapSimpleMod, "connect", async () => mockConnection);

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		await provider.read({ subject: "urgent" });

		const searchCall = mock.methodCalls(mockConnection.search);
		assert.deepStrictEqual(searchCall[0].arguments[0], [["SUBJECT", "urgent"]]);
	});

	test("read() should filter by keyword", async () => {
		const mockConnection = {
			openBox: mock.method(async () => {}),
			search: mock.method(async () => []),
			getAttributes: mock.method(async () => ({})),
			closeBox: mock.method(async () => {}),
			disconnect: mock.method(async () => {}),
		};

		mock.method(imapSimpleMod, "connect", async () => mockConnection);

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		await provider.read({ keyword: "important" });

		const searchCall = mock.methodCalls(mockConnection.search);
		assert.deepStrictEqual(searchCall[0].arguments[0], [["TEXT", "important"]]);
	});

	test("read() should filter by dateFrom", async () => {
		const mockConnection = {
			openBox: mock.method(async () => {}),
			search: mock.method(async () => []),
			getAttributes: mock.method(async () => ({})),
			closeBox: mock.method(async () => {}),
			disconnect: mock.method(async () => {}),
		};

		mock.method(imapSimpleMod, "connect", async () => mockConnection);

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		await provider.read({ dateFrom: "2024-01-01" });

		const searchCall = mock.methodCalls(mockConnection.search);
		assert.deepStrictEqual(searchCall[0].arguments[0], [["SINCE", "2024-01-01"]]);
	});

	test("read() should filter by dateTo", async () => {
		const mockConnection = {
			openBox: mock.method(async () => {}),
			search: mock.method(async () => []),
			getAttributes: mock.method(async () => ({})),
			closeBox: mock.method(async () => {}),
			disconnect: mock.method(async () => {}),
		};

		mock.method(imapSimpleMod, "connect", async () => mockConnection);

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		await provider.read({ dateTo: "2024-12-31" });

		const searchCall = mock.methodCalls(mockConnection.search);
		assert.deepStrictEqual(searchCall[0].arguments[0], [["ON", "2024-12-31"]]);
	});

	test("read() should handle empty message list", async () => {
		const mockConnection = {
			openBox: mock.method(async () => {}),
			search: mock.method(async () => []),
			getAttributes: mock.method(async () => ({})),
			closeBox: mock.method(async () => {}),
			disconnect: mock.method(async () => {}),
		};

		mock.method(imapSimpleMod, "connect", async () => mockConnection);

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		const result = await provider.read({});

		assert.strictEqual(result.ok, true);
		assert.ok(result.messages);
		assert.strictEqual(result.messages.length, 0);
	});

	test("send() should send email via SMTP", async () => {
		const mockSendMail = mock.method(async () => ({ messageId: "smtp-msg-123" }));

		mock.method(nodemailerMod, "createTransport", () => ({
			sendMail: mockSendMail,
		}));

		const provider = new ImapProvider({
			host: "smtp.example.com",
			port: 587,
			user: "user",
			password: "pass",
		});

		const result = await provider.send({
			to: ["recipient@example.com"],
			subject: "SMTP Test",
			body: "Hello from IMAP provider",
		});

		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.messageId, "smtp-msg-123");

		const sendCall = mock.methodCalls(mockSendMail);
		assert.strictEqual(sendCall[0].arguments[0].from, "user");
		assert.strictEqual(sendCall[0].arguments[0].to, "recipient@example.com");
		assert.strictEqual(sendCall[0].arguments[0].subject, "SMTP Test");
		assert.strictEqual(sendCall[0].arguments[0].text, "Hello from IMAP provider");
	});

	test("send() should handle HTML body", async () => {
		const mockSendMail = mock.method(async () => ({ messageId: "smtp-1" }));

		mock.method(nodemailerMod, "createTransport", () => ({
			sendMail: mockSendMail,
		}));

		const provider = new ImapProvider({
			host: "smtp.example.com",
			user: "user",
			password: "pass",
		});

		await provider.send({
			to: ["recipient@example.com"],
			subject: "HTML",
			body: "<p>Hello</p>",
			bodyType: "html",
		});

		const sendCall = mock.methodCalls(mockSendMail);
		assert.strictEqual(sendCall[0].arguments[0].html, "<p>Hello</p>");
		assert.strictEqual(sendCall[0].arguments[0].text, undefined);
	});

	test("send() should include CC recipients", async () => {
		const mockSendMail = mock.method(async () => ({ messageId: "smtp-1" }));

		mock.method(nodemailerMod, "createTransport", () => ({
			sendMail: mockSendMail,
		}));

		const provider = new ImapProvider({
			host: "smtp.example.com",
			user: "user",
			password: "pass",
		});

		await provider.send({
			to: ["to@example.com"],
			cc: ["cc@example.com"],
			subject: "Test",
			body: "Body",
		});

		const sendCall = mock.methodCalls(mockSendMail);
		assert.strictEqual(sendCall[0].arguments[0].cc, "cc@example.com");
	});

	test("send() should include BCC recipients", async () => {
		const mockSendMail = mock.method(async () => ({ messageId: "smtp-1" }));

		mock.method(nodemailerMod, "createTransport", () => ({
			sendMail: mockSendMail,
		}));

		const provider = new ImapProvider({
			host: "smtp.example.com",
			user: "user",
			password: "pass",
		});

		await provider.send({
			to: ["to@example.com"],
			bcc: ["bcc@example.com"],
			subject: "Test",
			body: "Body",
		});

		const sendCall = mock.methodCalls(mockSendMail);
		assert.strictEqual(sendCall[0].arguments[0].bcc, "bcc@example.com");
	});

	test("send() should handle attachments", async () => {
		const mockSendMail = mock.method(async () => ({ messageId: "smtp-1" }));

		mock.method(nodemailerMod, "createTransport", () => ({
			sendMail: mockSendMail,
		}));

		const provider = new ImapProvider({
			host: "smtp.example.com",
			user: "user",
			password: "pass",
		});

		await provider.send({
			to: ["recipient@example.com"],
			subject: "With attachment",
			body: "See attached",
			attachments: [
				{ filename: "report.pdf", content: "base64data", contentType: "application/pdf" },
			],
		});

		const sendCall = mock.methodCalls(mockSendMail);
		assert.ok(sendCall[0].arguments[0].attachments);
		assert.strictEqual(sendCall[0].arguments[0].attachments.length, 1);
		assert.strictEqual(sendCall[0].arguments[0].attachments[0].filename, "report.pdf");
		assert.strictEqual(sendCall[0].arguments[0].attachments[0].contentType, "application/pdf");
	});

	test("search() should search messages by query", async () => {
		const mockConnection = {
			openBox: mock.method(async () => {}),
			search: mock.method(async () => [{ attributes: { uid: "uid-1" } }]),
			getAttributes: mock.method(async (uid) => ({
				headers: {
					subject: `Message ${uid}`,
					from: "sender@example.com",
					to: "recipient@example.com",
					date: "Mon, 01 Jan 2024 00:00:00 +0000",
				},
				body: `Body for ${uid}`,
			})),
			closeBox: mock.method(async () => {}),
			disconnect: mock.method(async () => {}),
		};

		mock.method(imapSimpleMod, "connect", async () => mockConnection);

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		const result = await provider.search({ query: "important", limit: 10 });

		assert.strictEqual(result.ok, true);
		assert.ok(result.messages);
		assert.strictEqual(result.messages.length, 1);
		assert.strictEqual(result.messages[0].subject, "Message uid-1");
	});

	test("search() should respect limit", async () => {
		const mockConnection = {
			openBox: mock.method(async () => {}),
			search: mock.method(async () => [
				{ attributes: { uid: "uid-1" } },
				{ attributes: { uid: "uid-2" } },
				{ attributes: { uid: "uid-3" } },
			]),
			getAttributes: mock.method(async (uid) => ({
				headers: {
					subject: `Message ${uid}`,
					from: "sender@example.com",
					to: "recipient@example.com",
					date: "Mon, 01 Jan 2024 00:00:00 +0000",
				},
				body: `Body for ${uid}`,
			})),
			closeBox: mock.method(async () => {}),
			disconnect: mock.method(async () => {}),
		};

		mock.method(imapSimpleMod, "connect", async () => mockConnection);

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		const result = await provider.search({ query: "test", limit: 2 });

		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.messages.length, 2);
	});

	test("saveDraft() should send with empty envelope", async () => {
		const mockSendMail = mock.method(async () => ({ messageId: "draft-smtp-1" }));

		mock.method(nodemailerMod, "createTransport", () => ({
			sendMail: mockSendMail,
		}));

		const provider = new ImapProvider({
			host: "smtp.example.com",
			user: "user",
			password: "pass",
		});

		const result = await provider.saveDraft({
			to: ["recipient@example.com"],
			subject: "Draft Test",
			body: "Draft content",
		});

		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.draftId, "draft-smtp-1");

		const sendCall = mock.methodCalls(mockSendMail);
		assert.deepStrictEqual(sendCall[0].arguments[0].envelope, { to: [] });
	});

	test("listDrafts() should list drafts from DRAFTS folder", async () => {
		const mockConnection = {
			openBox: mock.method(async () => {}),
			search: mock.method(async () => [
				{ attributes: { uid: "draft-uid-1" } },
				{ attributes: { uid: "draft-uid-2" } },
			]),
			getAttributes: mock.method(async (uid) => ({
				headers: {
					subject: `Draft ${uid}`,
					from: "user@example.com",
					to: "recipient@example.com",
					date: "Mon, 01 Jan 2024 00:00:00 +0000",
				},
				body: `Draft body for ${uid}`,
			})),
			closeBox: mock.method(async () => {}),
			disconnect: mock.method(async () => {}),
		};

		mock.method(imapSimpleMod, "connect", async () => mockConnection);

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		const result = await provider.listDrafts({ limit: 5 });

		assert.strictEqual(result.ok, true);
		assert.ok(result.drafts);
		assert.strictEqual(result.drafts.length, 2);
		assert.strictEqual(result.drafts[0].id, "draft-uid-1");
		assert.strictEqual(result.drafts[0].subject, "Draft draft-uid-1");
	});

	test("listDrafts() should respect limit", async () => {
		const mockConnection = {
			openBox: mock.method(async () => {}),
			search: mock.method(async () => [
				{ attributes: { uid: "d-1" } },
				{ attributes: { uid: "d-2" } },
				{ attributes: { uid: "d-3" } },
			]),
			getAttributes: mock.method(async (uid) => ({
				headers: {
					subject: `Draft ${uid}`,
					from: "user@example.com",
					to: "r@example.com",
					date: "2024-01-01",
				},
				body: `Body ${uid}`,
			})),
			closeBox: mock.method(async () => {}),
			disconnect: mock.method(async () => {}),
		};

		mock.method(imapSimpleMod, "connect", async () => mockConnection);

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		const result = await provider.listDrafts({ limit: 2 });

		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.drafts.length, 2);
	});

	test("updateDraft() should send with empty envelope", async () => {
		const mockSendMail = mock.method(async () => ({ messageId: "updated-draft" }));

		mock.method(nodemailerMod, "createTransport", () => ({
			sendMail: mockSendMail,
		}));

		const provider = new ImapProvider({
			host: "smtp.example.com",
			user: "user",
			password: "pass",
		});

		const result = await provider.updateDraft("draft-uid-1", {
			subject: "Updated Draft",
			body: "Updated content",
		});

		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.draftId, "draft-uid-1");

		const sendCall = mock.methodCalls(mockSendMail);
		assert.deepStrictEqual(sendCall[0].arguments[0].envelope, { to: [] });
	});

	test("deleteDraft() should expunge the draft", async () => {
		const mockConnection = {
			openBox: mock.method(async () => {}),
			expunge: mock.method(async () => {}),
			closeBox: mock.method(async () => {}),
			disconnect: mock.method(async () => {}),
		};

		mock.method(imapSimpleMod, "connect", async () => mockConnection);

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		const result = await provider.deleteDraft("draft-uid-1");

		assert.strictEqual(result.ok, true);

		const expungeCall = mock.methodCalls(mockConnection.expunge);
		assert.deepStrictEqual(expungeCall[0].arguments[0], { uid: "draft-uid-1" });
	});

	test("organize() should mark messages as read", async () => {
		const mockConnection = {
			openBox: mock.method(async () => {}),
			setFlags: mock.method(async () => {}),
			closeBox: mock.method(async () => {}),
			disconnect: mock.method(async () => {}),
		};

		mock.method(imapSimpleMod, "connect", async () => mockConnection);

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		const result = await provider.organize({
			messageIds: ["uid-1", "uid-2"],
			action: "markRead",
		});

		assert.strictEqual(result.ok, true);

		const setFlagsCall = mock.methodCalls(mockConnection.setFlags);
		assert.deepStrictEqual(setFlagsCall[0].arguments[0], { uid: ["uid-1", "uid-2"] });
		assert.deepStrictEqual(setFlagsCall[0].arguments[1], ["\\Seen"]);
	});

	test("organize() should mark messages as unread", async () => {
		const mockConnection = {
			openBox: mock.method(async () => {}),
			setFlags: mock.method(async () => {}),
			closeBox: mock.method(async () => {}),
			disconnect: mock.method(async () => {}),
		};

		mock.method(imapSimpleMod, "connect", async () => mockConnection);

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		const result = await provider.organize({
			messageIds: ["uid-1"],
			action: "markUnread",
		});

		assert.strictEqual(result.ok, true);

		const setFlagsCall = mock.methodCalls(mockConnection.setFlags);
		assert.deepStrictEqual(setFlagsCall[0].arguments[1], ["\\Seen"]);
		assert.strictEqual(setFlagsCall[0].arguments[2].remove, true);
	});

	test("organize() should archive messages", async () => {
		const mockConnection = {
			openBox: mock.method(async () => {}),
			copy: mock.method(async () => {}),
			setFlags: mock.method(async () => {}),
			closeBox: mock.method(async () => {}),
			disconnect: mock.method(async () => {}),
		};

		mock.method(imapSimpleMod, "connect", async () => mockConnection);

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		const result = await provider.organize({
			messageIds: ["uid-1"],
			action: "archive",
		});

		assert.strictEqual(result.ok, true);

		const copyCall = mock.methodCalls(mockConnection.copy);
		assert.deepStrictEqual(copyCall[0].arguments[0], { uid: ["uid-1"] });
		assert.strictEqual(copyCall[0].arguments[1], "Archive");

		const setFlagsCall = mock.methodCalls(mockConnection.setFlags);
		assert.deepStrictEqual(setFlagsCall[0].arguments[0], { uid: ["uid-1"] });
		assert.deepStrictEqual(setFlagsCall[0].arguments[1], ["\\Deleted"]);
	});

	test("organize() should add a label (flag)", async () => {
		const mockConnection = {
			openBox: mock.method(async () => {}),
			setFlags: mock.method(async () => {}),
			closeBox: mock.method(async () => {}),
			disconnect: mock.method(async () => {}),
		};

		mock.method(imapSimpleMod, "connect", async () => mockConnection);

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		const result = await provider.organize({
			messageIds: ["uid-1"],
			action: "addLabel",
			label: "Important",
		});

		assert.strictEqual(result.ok, true);

		const setFlagsCall = mock.methodCalls(mockConnection.setFlags);
		assert.deepStrictEqual(setFlagsCall[0].arguments[1], ["\\Important"]);
	});

	test("organize() should remove a label (flag)", async () => {
		const mockConnection = {
			openBox: mock.method(async () => {}),
			setFlags: mock.method(async () => {}),
			closeBox: mock.method(async () => {}),
			disconnect: mock.method(async () => {}),
		};

		mock.method(imapSimpleMod, "connect", async () => mockConnection);

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		const result = await provider.organize({
			messageIds: ["uid-1"],
			action: "removeLabel",
			label: "Important",
		});

		assert.strictEqual(result.ok, true);

		const setFlagsCall = mock.methodCalls(mockConnection.setFlags);
		assert.deepStrictEqual(setFlagsCall[0].arguments[1], ["\\Important"]);
		assert.strictEqual(setFlagsCall[0].arguments[2].remove, true);
	});

	test("organize() should return error for unknown action", async () => {
		const mockConnection = {
			openBox: mock.method(async () => {}),
			closeBox: mock.method(async () => {}),
			disconnect: mock.method(async () => {}),
		};

		mock.method(imapSimpleMod, "connect", async () => mockConnection);

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		const result = await provider.organize({
			messageIds: ["uid-1"],
			action: "unknownAction",
		});

		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Unknown organize action"));
	});

	test("organize() should handle single messageId as string", async () => {
		const mockConnection = {
			openBox: mock.method(async () => {}),
			setFlags: mock.method(async () => {}),
			closeBox: mock.method(async () => {}),
			disconnect: mock.method(async () => {}),
		};

		mock.method(imapSimpleMod, "connect", async () => mockConnection);

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		const result = await provider.organize({
			messageIds: "uid-1",
			action: "markRead",
		});

		assert.strictEqual(result.ok, true);

		const setFlagsCall = mock.methodCalls(mockConnection.setFlags);
		assert.deepStrictEqual(setFlagsCall[0].arguments[0], { uid: ["uid-1"] });
	});

	test("IMAP config should use default port when secure is true", async () => {
		const mockConnection = {
			openBox: mock.method(async () => {}),
			search: mock.method(async () => []),
			getAttributes: mock.method(async () => ({})),
			closeBox: mock.method(async () => {}),
			disconnect: mock.method(async () => {}),
		};

		mock.method(imapSimpleMod, "connect", async () => mockConnection);

		const provider = new ImapProvider({
			host: "imap.example.com",
			secure: true,
			user: "user",
			password: "pass",
		});

		await provider.read({});

		const connectCall = mock.methodCalls(imapSimpleMod.connect);
		assert.strictEqual(connectCall[0].arguments[0].port, 993);
	});

	test("IMAP config should use default port when secure is false", async () => {
		const mockConnection = {
			openBox: mock.method(async () => {}),
			search: mock.method(async () => []),
			getAttributes: mock.method(async () => ({})),
			closeBox: mock.method(async () => {}),
			disconnect: mock.method(async () => {}),
		};

		mock.method(imapSimpleMod, "connect", async () => mockConnection);

		const provider = new ImapProvider({
			host: "imap.example.com",
			secure: false,
			user: "user",
			password: "pass",
		});

		await provider.read({});

		const connectCall = mock.methodCalls(imapSimpleMod.connect);
		assert.strictEqual(connectCall[0].arguments[0].port, 143);
	});

	test("IMAP config should use explicit port when provided", async () => {
		const mockConnection = {
			openBox: mock.method(async () => {}),
			search: mock.method(async () => []),
			getAttributes: mock.method(async () => ({})),
			closeBox: mock.method(async () => {}),
			disconnect: mock.method(async () => {}),
		};

		mock.method(imapSimpleMod, "connect", async () => mockConnection);

		const provider = new ImapProvider({
			host: "imap.example.com",
			port: 9993,
			secure: true,
			user: "user",
			password: "pass",
		});

		await provider.read({});

		const connectCall = mock.methodCalls(imapSimpleMod.connect);
		assert.strictEqual(connectCall[0].arguments[0].port, 9993);
	});

	test("SMTP send should use explicit port when provided", async () => {
		const mockSendMail = mock.method(async () => ({ messageId: "smtp-1" }));

		mock.method(nodemailerMod, "createTransport", () => ({
			sendMail: mockSendMail,
		}));

		const provider = new ImapProvider({
			host: "smtp.example.com",
			port: 587,
			user: "user",
			password: "pass",
		});

		await provider.send({
			to: ["recipient@example.com"],
			subject: "Test",
			body: "Body",
		});

		const transportCall = mock.methodCalls(nodemailerMod.createTransport);
		assert.strictEqual(transportCall[0].arguments[0].port, 587);
	});

	test("normalizeMessage() should handle IMAP message format", async () => {
		const mockConnection = {
			openBox: mock.method(async () => {}),
			search: mock.method(async () => [{ attributes: { uid: "uid-normalize" } }]),
			getAttributes: mock.method(async (_uid) => ({
				headers: {
					subject: "Normalize Test",
					from: "from@example.com",
					to: "to@example.com",
					date: "2024-06-15T12:00:00Z",
				},
				body: "IMAP body content",
			})),
			closeBox: mock.method(async () => {}),
			disconnect: mock.method(async () => {}),
		};

		mock.method(imapSimpleMod, "connect", async () => mockConnection);

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		const result = await provider.read({});

		assert.strictEqual(result.ok, true);
		const msg = result.messages[0];
		assert.strictEqual(msg.id, "uid-normalize");
		assert.strictEqual(msg.uid, "uid-normalize");
		assert.strictEqual(msg.subject, "Normalize Test");
		assert.strictEqual(msg.body, "IMAP body content");
		assert.strictEqual(msg.from, "from@example.com");
		assert.strictEqual(msg.to, "to@example.com");
	});

	test("read() should close box and disconnect after use", async () => {
		const mockConnection = {
			openBox: mock.method(async () => {}),
			search: mock.method(async () => []),
			getAttributes: mock.method(async () => ({})),
			closeBox: mock.method(async () => {}),
			disconnect: mock.method(async () => {}),
		};

		mock.method(imapSimpleMod, "connect", async () => mockConnection);

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		await provider.read({});

		const closeBoxCall = mock.methodCalls(mockConnection.closeBox);
		assert.strictEqual(closeBoxCall.length, 1);

		const disconnectCall = mock.methodCalls(mockConnection.disconnect);
		assert.strictEqual(disconnectCall.length, 1);
	});

	test("search() should close box and disconnect after use", async () => {
		const mockConnection = {
			openBox: mock.method(async () => {}),
			search: mock.method(async () => []),
			getAttributes: mock.method(async () => ({})),
			closeBox: mock.method(async () => {}),
			disconnect: mock.method(async () => {}),
		};

		mock.method(imapSimpleMod, "connect", async () => mockConnection);

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		await provider.search({ query: "test" });

		const closeBoxCall = mock.methodCalls(mockConnection.closeBox);
		assert.strictEqual(closeBoxCall.length, 1);

		const disconnectCall = mock.methodCalls(mockConnection.disconnect);
		assert.strictEqual(disconnectCall.length, 1);
	});

	test("listDrafts() should open DRAFTS box and close/disconnect", async () => {
		const mockConnection = {
			openBox: mock.method(async () => {}),
			search: mock.method(async () => []),
			getAttributes: mock.method(async () => ({})),
			closeBox: mock.method(async () => {}),
			disconnect: mock.method(async () => {}),
		};

		mock.method(imapSimpleMod, "connect", async () => mockConnection);

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		await provider.listDrafts({});

		const openBoxCall = mock.methodCalls(mockConnection.openBox);
		assert.strictEqual(openBoxCall[0].arguments[0], "DRAFTS");

		const closeBoxCall = mock.methodCalls(mockConnection.closeBox);
		assert.strictEqual(closeBoxCall.length, 1);
	});

	test("deleteDraft() should open DRAFTS box and expunge", async () => {
		const mockConnection = {
			openBox: mock.method(async () => {}),
			expunge: mock.method(async () => {}),
			closeBox: mock.method(async () => {}),
			disconnect: mock.method(async () => {}),
		};

		mock.method(imapSimpleMod, "connect", async () => mockConnection);

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		await provider.deleteDraft("draft-uid-999");

		const openBoxCall = mock.methodCalls(mockConnection.openBox);
		assert.strictEqual(openBoxCall[0].arguments[0], "DRAFTS");

		const expungeCall = mock.methodCalls(mockConnection.expunge);
		assert.deepStrictEqual(expungeCall[0].arguments[0], { uid: "draft-uid-999" });
	});

	test("organize() should open INBOX box and close/disconnect", async () => {
		const mockConnection = {
			openBox: mock.method(async () => {}),
			setFlags: mock.method(async () => {}),
			closeBox: mock.method(async () => {}),
			disconnect: mock.method(async () => {}),
		};

		mock.method(imapSimpleMod, "connect", async () => mockConnection);

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		await provider.organize({
			messageIds: ["uid-1"],
			action: "markRead",
		});

		const openBoxCall = mock.methodCalls(mockConnection.openBox);
		assert.strictEqual(openBoxCall[0].arguments[0], "INBOX");

		const closeBoxCall = mock.methodCalls(mockConnection.closeBox);
		assert.strictEqual(closeBoxCall.length, 1);
	});
});
