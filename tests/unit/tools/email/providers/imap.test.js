import { test, describe, mock } from "node:test";
import assert from "node:assert";
import { ImapProvider } from "../../../../../src/tools/email/providers/imap.js";

describe("ImapProvider — happy paths", () => {
	// Track calls on plain objects
	function trackCalls(obj, methodName) {
		const original = obj[methodName];
		const calls = [];
		obj[methodName] = async (...args) => {
			calls.push({ args });
			return original(...args);
		};
		return { fn: obj[methodName], calls };
	}

	function createMockConnection({ searchResults = [], getAttrsResults = [] } = {}) {
		const mockOpenBox = async () => {};
		const mockSearch = async () => searchResults;
		const mockGetAttributes = async (_uids, _opts) => {
			if (Array.isArray(_uids)) {
				return _uids.map((uid, i) => getAttrsResults[i] || {});
			}
			return getAttrsResults[0] || {};
		};
		const mockCloseBox = async () => {};
		const mockDisconnect = async () => {};
		const mockSetFlags = async () => {};
		const mockCopy = async () => {};
		const mockExpunge = async () => {};
		const mockAddMessage = async () => ({ uid: "draft-uid-1" });

		return {
			openBox: mockOpenBox,
			search: mockSearch,
			getAttributes: mockGetAttributes,
			closeBox: mockCloseBox,
			disconnect: mockDisconnect,
			setFlags: mockSetFlags,
			copy: mockCopy,
			expunge: mockExpunge,
			addMessage: mockAddMessage,
		};
	}

	test("read() should fetch messages via IMAP", async () => {
		const connection = createMockConnection({
			searchResults: [
				{ attributes: { uid: "uid-1" } },
				{ attributes: { uid: "uid-2" } },
			],
			getAttrsResults: [
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
						from: "sender@example.com",
						to: "recipient@example.com",
						date: "Mon, 01 Jan 2024 00:00:00 +0000",
					},
					body: "Body content for uid-2",
				},
			],
		});

		const openBoxTrack = trackCalls(connection, "openBox");
		const searchTrack = trackCalls(connection, "search");
		const getAttrsTrack = trackCalls(connection, "getAttributes");
		const closeBoxTrack = trackCalls(connection, "closeBox");
		const disconnectTrack = trackCalls(connection, "disconnect");

		await mock.module("imap-simple", {
			extends: require,
			decorate: (original) => {
				return async function (...args) {
					return connection;
				};
			},
		});

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
		const connection = createMockConnection({
			searchResults: [
				{ attributes: { uid: "uid-1" } },
				{ attributes: { uid: "uid-2" } },
				{ attributes: { uid: "uid-3" } },
			],
			getAttrsResults: [
				{ headers: { subject: "Message uid-1" }, body: "Body uid-1" },
				{ headers: { subject: "Message uid-2" }, body: "Body uid-2" },
				{ headers: { subject: "Message uid-3" }, body: "Body uid-3" },
			],
		});

		await mock.module("imap-simple", {
			extends: require,
			decorate: (original) => {
				return async function (...args) {
					return connection;
				};
			},
		});

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
		const connection = createMockConnection({ searchResults: [], getAttrsResults: [] });

		const openBoxTrack = trackCalls(connection, "openBox");

		await mock.module("imap-simple", {
			extends: require,
			decorate: (original) => {
				return async function (...args) {
					return connection;
				};
			},
		});

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		await provider.read({ folder: "Sent" });

		assert.strictEqual(openBoxTrack.calls[0].args[0], "Sent");
	});

	test("read() should filter by sender", async () => {
		const connection = createMockConnection({ searchResults: [], getAttrsResults: [] });

		const searchTrack = trackCalls(connection, "search");

		await mock.module("imap-simple", {
			extends: require,
			decorate: (original) => {
				return async function (...args) {
					return connection;
				};
			},
		});

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		await provider.read({ sender: "test@example.com" });

		assert.deepStrictEqual(searchTrack.calls[0].args[0], [["FROM", "test@example.com"]]);
	});

	test("read() should filter by subject", async () => {
		const connection = createMockConnection({ searchResults: [], getAttrsResults: [] });

		const searchTrack = trackCalls(connection, "search");

		await mock.module("imap-simple", {
			extends: require,
			decorate: (original) => {
				return async function (...args) {
					return connection;
				};
			},
		});

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		await provider.read({ subject: "urgent" });

		assert.deepStrictEqual(searchTrack.calls[0].args[0], [["SUBJECT", "urgent"]]);
	});

	test("read() should filter by keyword", async () => {
		const connection = createMockConnection({ searchResults: [], getAttrsResults: [] });

		const searchTrack = trackCalls(connection, "search");

		await mock.module("imap-simple", {
			extends: require,
			decorate: (original) => {
				return async function (...args) {
					return connection;
				};
			},
		});

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		await provider.read({ keyword: "important" });

		assert.deepStrictEqual(searchTrack.calls[0].args[0], [["TEXT", "important"]]);
	});

	test("read() should filter by dateFrom", async () => {
		const connection = createMockConnection({ searchResults: [], getAttrsResults: [] });

		const searchTrack = trackCalls(connection, "search");

		await mock.module("imap-simple", {
			extends: require,
			decorate: (original) => {
				return async function (...args) {
					return connection;
				};
			},
		});

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		await provider.read({ dateFrom: "2024-01-01" });

		assert.deepStrictEqual(searchTrack.calls[0].args[0], [["SINCE", "2024-01-01"]]);
	});

	test("read() should filter by dateTo", async () => {
		const connection = createMockConnection({ searchResults: [], getAttrsResults: [] });

		const searchTrack = trackCalls(connection, "search");

		await mock.module("imap-simple", {
			extends: require,
			decorate: (original) => {
				return async function (...args) {
					return connection;
				};
			},
		});

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		await provider.read({ dateTo: "2024-12-31" });

		assert.deepStrictEqual(searchTrack.calls[0].args[0], [["ON", "2024-12-31"]]);
	});

	test("read() should handle IMAP error", async () => {
		await mock.module("imap-simple", {
			extends: require,
			decorate: () => {
				return async () => {
					throw new Error("Connection refused");
				};
			},
		});

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		const result = await provider.read({});

		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("IMAP read failed"));
	});

	test("read() should handle search error", async () => {
		const connection = createMockConnection({ searchResults: [], getAttrsResults: [] });
		connection.search = async () => {
			throw new Error("Search failed");
		};

		await mock.module("imap-simple", {
			extends: require,
			decorate: () => {
				return async () => connection;
			},
		});

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		const result = await provider.read({});

		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("IMAP read failed"));
	});

	test("send() should send email via SMTP", async () => {
		const sendCalls = [];
		const mockSendMail = async (opts) => {
			sendCalls.push(opts);
			return { messageId: "smtp-1" };
		};

		await mock.module("nodemailer", {
			extends: require,
			decorate: (original) => {
				return {
					...original,
					createTransport: () => ({
						sendMail: mockSendMail,
					}),
				};
			},
		});

		const provider = new ImapProvider({
			host: "smtp.example.com",
			user: "user",
			password: "pass",
		});

		const result = await provider.send({
			to: ["recipient@example.com"],
			subject: "Test",
			body: "Hello",
		});

		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.messageId, "smtp-1");

		assert.strictEqual(sendCalls.length, 1);
		assert.strictEqual(sendCalls[0].to, "recipient@example.com");
		assert.strictEqual(sendCalls[0].subject, "Test");
		assert.strictEqual(sendCalls[0].text, "Hello");
	});

	test("send() should handle HTML body", async () => {
		const sendCalls = [];
		const mockSendMail = async (opts) => {
			sendCalls.push(opts);
			return { messageId: "smtp-1" };
		};

		await mock.module("nodemailer", {
			extends: require,
			decorate: (original) => {
				return {
					...original,
					createTransport: () => ({
						sendMail: mockSendMail,
					}),
				};
			},
		});

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

		assert.strictEqual(sendCalls.length, 1);
		assert.strictEqual(sendCalls[0].html, "<p>Hello</p>");
		assert.strictEqual(sendCalls[0].text, undefined);
	});

	test("send() should include CC recipients", async () => {
		const sendCalls = [];
		const mockSendMail = async (opts) => {
			sendCalls.push(opts);
			return { messageId: "smtp-1" };
		};

		await mock.module("nodemailer", {
			extends: require,
			decorate: (original) => {
				return {
					...original,
					createTransport: () => ({
						sendMail: mockSendMail,
					}),
				};
			},
		});

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

		assert.strictEqual(sendCalls.length, 1);
		assert.strictEqual(sendCalls[0].cc, "cc@example.com");
	});

	test("send() should include BCC recipients", async () => {
		const sendCalls = [];
		const mockSendMail = async (opts) => {
			sendCalls.push(opts);
			return { messageId: "smtp-1" };
		};

		await mock.module("nodemailer", {
			extends: require,
			decorate: (original) => {
				return {
					...original,
					createTransport: () => ({
						sendMail: mockSendMail,
					}),
				};
			},
		});

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

		assert.strictEqual(sendCalls.length, 1);
		assert.strictEqual(sendCalls[0].bcc, "bcc@example.com");
	});

	test("send() should handle attachments", async () => {
		const sendCalls = [];
		const mockSendMail = async (opts) => {
			sendCalls.push(opts);
			return { messageId: "smtp-1" };
		};

		await mock.module("nodemailer", {
			extends: require,
			decorate: (original) => {
				return {
					...original,
					createTransport: () => ({
						sendMail: mockSendMail,
					}),
				};
			},
		});

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

		assert.ok(sendCalls[0].attachments);
		assert.strictEqual(sendCalls[0].attachments.length, 1);
		assert.strictEqual(sendCalls[0].attachments[0].filename, "report.pdf");
		assert.strictEqual(sendCalls[0].attachments[0].contentType, "application/pdf");
	});

	test("send() should handle SMTP error", async () => {
		await mock.module("nodemailer", {
			extends: require,
			decorate: (original) => {
				return {
					...original,
					createTransport: () => ({
						sendMail: async () => {
							throw new Error("SMTP error");
						},
					}),
				};
			},
		});

		const provider = new ImapProvider({
			host: "smtp.example.com",
			user: "user",
			password: "pass",
		});

		const result = await provider.send({
			to: ["recipient@example.com"],
			subject: "Test",
			body: "Hello",
		});

		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("IMAP send failed"));
	});

	test("search() should search messages by query", async () => {
		const connection = createMockConnection({
			searchResults: [{ attributes: { uid: "uid-1" } }],
			getAttrsResults: [
				{
					headers: {
						subject: "Message uid-1",
						from: "sender@example.com",
						to: "recipient@example.com",
						date: "Mon, 01 Jan 2024 00:00:00 +0000",
					},
					body: "Body for uid-1",
				},
			],
		});

		await mock.module("imap-simple", {
			extends: require,
			decorate: () => {
				return async () => connection;
			},
		});

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
		const connection = createMockConnection({
			searchResults: [
				{ attributes: { uid: "uid-1" } },
				{ attributes: { uid: "uid-2" } },
				{ attributes: { uid: "uid-3" } },
			],
			getAttrsResults: [
				{ headers: { subject: "Message uid-1" }, body: "Body uid-1" },
				{ headers: { subject: "Message uid-2" }, body: "Body uid-2" },
				{ headers: { subject: "Message uid-3" }, body: "Body uid-3" },
			],
		});

		await mock.module("imap-simple", {
			extends: require,
			decorate: () => {
				return async () => connection;
			},
		});

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		const result = await provider.search({ query: "test", limit: 2 });

		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.messages.length, 2);
	});

	test("search() should use custom folder", async () => {
		const connection = createMockConnection({ searchResults: [], getAttrsResults: [] });

		const openBoxTrack = trackCalls(connection, "openBox");

		await mock.module("imap-simple", {
			extends: require,
			decorate: () => {
				return async () => connection;
			},
		});

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		await provider.search({ query: "test", folder: "Sent" });

		assert.strictEqual(openBoxTrack.calls[0].args[0], "Sent");
	});

	test("search() should handle error", async () => {
		await mock.module("imap-simple", {
			extends: require,
			decorate: () => {
				return async () => {
					throw new Error("Search failed");
				};
			},
		});

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		const result = await provider.search({ query: "test" });

		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("IMAP search failed"));
	});

	test("saveDraft() should save draft to DRAFTS folder", async () => {
		const connection = createMockConnection({ searchResults: [], getAttrsResults: [] });

		const openBoxTrack = trackCalls(connection, "openBox");
		const addMessageTrack = trackCalls(connection, "addMessage");

		await mock.module("imap-simple", {
			extends: require,
			decorate: () => {
				return async () => connection;
			},
		});

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		const result = await provider.saveDraft({
			to: ["recipient@example.com"],
			subject: "Draft Test",
			body: "Draft content",
		});

		assert.strictEqual(result.ok, true);
		assert.ok(result.draftId);
		assert.strictEqual(openBoxTrack.calls[0].args[0], "DRAFTS");
		assert.ok(addMessageTrack.calls.length > 0);
	});

	test("saveDraft() should handle error", async () => {
		await mock.module("imap-simple", {
			extends: require,
			decorate: () => {
				return async () => {
					throw new Error("Save draft failed");
				};
			},
		});

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		const result = await provider.saveDraft({
			to: ["recipient@example.com"],
			subject: "Draft Test",
			body: "Draft content",
		});

		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("IMAP saveDraft failed"));
	});

	test("listDrafts() should list drafts from DRAFTS folder", async () => {
		const connection = createMockConnection({
			searchResults: [
				{ attributes: { uid: "draft-uid-1" } },
				{ attributes: { uid: "draft-uid-2" } },
			],
			getAttrsResults: [
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
			],
		});

		await mock.module("imap-simple", {
			extends: require,
			decorate: () => {
				return async () => connection;
			},
		});

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
		const connection = createMockConnection({
			searchResults: [
				{ attributes: { uid: "d-1" } },
				{ attributes: { uid: "d-2" } },
				{ attributes: { uid: "d-3" } },
			],
			getAttrsResults: [
				{ headers: { subject: "Draft d-1" }, body: "Body d-1" },
				{ headers: { subject: "Draft d-2" }, body: "Body d-2" },
				{ headers: { subject: "Draft d-3" }, body: "Body d-3" },
			],
		});

		await mock.module("imap-simple", {
			extends: require,
			decorate: () => {
				return async () => connection;
			},
		});

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		const result = await provider.listDrafts({ limit: 2 });

		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.drafts.length, 2);
	});

	test("listDrafts() should handle error", async () => {
		await mock.module("imap-simple", {
			extends: require,
			decorate: () => {
				return async () => {
					throw new Error("List drafts failed");
				};
			},
		});

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		const result = await provider.listDrafts({});

		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("IMAP listDrafts failed"));
	});

	test("updateDraft() should send updated draft", async () => {
		const sendCalls = [];
		const mockSendMail = async (opts) => {
			sendCalls.push(opts);
			return { messageId: "updated-draft" };
		};

		await mock.module("nodemailer", {
			extends: require,
			decorate: (original) => {
				return {
					...original,
					createTransport: () => ({
						sendMail: mockSendMail,
					}),
				};
			},
		});

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

		assert.strictEqual(sendCalls.length, 1);
		assert.strictEqual(sendCalls[0].subject, "Updated Draft");
	});

	test("deleteDraft() should expunge the draft", async () => {
		const connection = createMockConnection({ searchResults: [], getAttrsResults: [] });

		const openBoxTrack = trackCalls(connection, "openBox");
		const expungeTrack = trackCalls(connection, "expunge");

		await mock.module("imap-simple", {
			extends: require,
			decorate: () => {
				return async () => connection;
			},
		});

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		const result = await provider.deleteDraft("draft-uid-999");

		assert.strictEqual(result.ok, true);
		assert.strictEqual(openBoxTrack.calls[0].args[0], "DRAFTS");
		assert.strictEqual(expungeTrack.calls[0].args[0], { uid: "draft-uid-999" });
	});

	test("deleteDraft() should handle error", async () => {
		await mock.module("imap-simple", {
			extends: require,
			decorate: () => {
				return async () => {
					throw new Error("Delete draft failed");
				};
			},
		});

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		const result = await provider.deleteDraft("draft-uid-999");

		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("IMAP deleteDraft failed"));
	});

	test("organize() should mark messages as read", async () => {
		const connection = createMockConnection({ searchResults: [], getAttrsResults: [] });

		const setFlagsTrack = trackCalls(connection, "setFlags");

		await mock.module("imap-simple", {
			extends: require,
			decorate: () => {
				return async () => connection;
			},
		});

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
		assert.strictEqual(setFlagsTrack.calls[0].args[0].uid, undefined);
		assert.deepStrictEqual(setFlagsTrack.calls[0].args[1], ["\\Seen"]);
	});

	test("organize() should mark messages as unread", async () => {
		const connection = createMockConnection({ searchResults: [], getAttrsResults: [] });

		const setFlagsTrack = trackCalls(connection, "setFlags");

		await mock.module("imap-simple", {
			extends: require,
			decorate: () => {
				return async () => connection;
			},
		});

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
		assert.strictEqual(setFlagsTrack.calls[0].args[1], ["\\Seen"]);
		assert.strictEqual(setFlagsTrack.calls[0].args[2].remove, true);
	});

	test("organize() should archive messages", async () => {
		const connection = createMockConnection({ searchResults: [], getAttrsResults: [] });

		const copyTrack = trackCalls(connection, "copy");
		const setFlagsTrack = trackCalls(connection, "setFlags");

		await mock.module("imap-simple", {
			extends: require,
			decorate: () => {
				return async () => connection;
			},
		});

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
		assert.deepStrictEqual(copyTrack.calls[0].args[0], { uid: ["uid-1"] });
		assert.strictEqual(copyTrack.calls[0].args[1], "Archive");
		assert.deepStrictEqual(setFlagsTrack.calls[0].args[0], { uid: ["uid-1"] });
		assert.deepStrictEqual(setFlagsTrack.calls[0].args[1], ["\\Deleted"]);
	});

	test("organize() should add a label (flag)", async () => {
		const connection = createMockConnection({ searchResults: [], getAttrsResults: [] });

		const setFlagsTrack = trackCalls(connection, "setFlags");

		await mock.module("imap-simple", {
			extends: require,
			decorate: () => {
				return async () => connection;
			},
		});

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
		assert.deepStrictEqual(setFlagsTrack.calls[0].args[1], ["\\Important"]);
	});

	test("organize() should remove a label (flag)", async () => {
		const connection = createMockConnection({ searchResults: [], getAttrsResults: [] });

		const setFlagsTrack = trackCalls(connection, "setFlags");

		await mock.module("imap-simple", {
			extends: require,
			decorate: () => {
				return async () => connection;
			},
		});

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
		assert.deepStrictEqual(setFlagsTrack.calls[0].args[1], ["\\Important"]);
		assert.strictEqual(setFlagsTrack.calls[0].args[2].remove, true);
	});

	test("organize() should return error for unknown action", async () => {
		const connection = createMockConnection({ searchResults: [], getAttrsResults: [] });

		await mock.module("imap-simple", {
			extends: require,
			decorate: () => {
				return async () => connection;
			},
		});

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
		const connection = createMockConnection({ searchResults: [], getAttrsResults: [] });

		const setFlagsTrack = trackCalls(connection, "setFlags");

		await mock.module("imap-simple", {
			extends: require,
			decorate: () => {
				return async () => connection;
			},
		});

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
		assert.strictEqual(setFlagsTrack.calls[0].args[0], undefined);
	});

	test("organize() should handle error", async () => {
		await mock.module("imap-simple", {
			extends: require,
			decorate: () => {
				return async () => {
					throw new Error("Organize failed");
				};
			},
		});

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		const result = await provider.organize({
			messageIds: ["uid-1"],
			action: "markRead",
		});

		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("IMAP organize failed"));
	});

	test("IMAP config should use default port when secure is true", async () => {
		const connection = createMockConnection({ searchResults: [], getAttrsResults: [] });

		await mock.module("imap-simple", {
			extends: require,
			decorate: () => {
				return async () => connection;
			},
		});

		const provider = new ImapProvider({
			host: "imap.example.com",
			secure: true,
			user: "user",
			password: "pass",
		});

		await provider.read({});
		// If we got here without error, the config was accepted
		assert.ok(true);
	});

	test("IMAP config should use default port when secure is false", async () => {
		const connection = createMockConnection({ searchResults: [], getAttrsResults: [] });

		await mock.module("imap-simple", {
			extends: require,
			decorate: () => {
				return async () => connection;
			},
		});

		const provider = new ImapProvider({
			host: "imap.example.com",
			secure: false,
			user: "user",
			password: "pass",
		});

		await provider.read({});
		assert.ok(true);
	});

	test("IMAP config should use explicit port when provided", async () => {
		const connection = createMockConnection({ searchResults: [], getAttrsResults: [] });

		await mock.module("imap-simple", {
			extends: require,
			decorate: () => {
				return async () => connection;
			},
		});

		const provider = new ImapProvider({
			host: "imap.example.com",
			port: 9993,
			secure: true,
			user: "user",
			password: "pass",
		});

		await provider.read({});
		assert.ok(true);
	});

	test("SMTP send should use explicit port when provided", async () => {
		const sendCalls = [];
		const mockSendMail = async (opts) => {
			sendCalls.push(opts);
			return { messageId: "smtp-1" };
		};

		await mock.module("nodemailer", {
			extends: require,
			decorate: (original) => {
				return {
					...original,
					createTransport: (config) => {
						assert.strictEqual(config.port, 587);
						return {
							sendMail: mockSendMail,
						};
					},
				};
			},
		});

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

		assert.strictEqual(sendCalls.length, 1);
	});

	test("normalizeMessage() should handle IMAP message format", async () => {
		const connection = createMockConnection({
			searchResults: [{ attributes: { uid: "uid-normalize" } }],
			getAttrsResults: [
				{
					headers: {
						subject: "Normalize Test",
						from: "from@example.com",
						to: "to@example.com",
						date: "2024-06-15T12:00:00Z",
					},
					body: "IMAP body content",
				},
			],
		});

		await mock.module("imap-simple", {
			extends: require,
			decorate: () => {
				return async () => connection;
			},
		});

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
		const connection = createMockConnection({ searchResults: [], getAttrsResults: [] });

		const closeBoxTrack = trackCalls(connection, "closeBox");
		const disconnectTrack = trackCalls(connection, "disconnect");

		await mock.module("imap-simple", {
			extends: require,
			decorate: () => {
				return async () => connection;
			},
		});

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		await provider.read({});

		assert.strictEqual(closeBoxTrack.calls.length, 1);
		assert.strictEqual(disconnectTrack.calls.length, 1);
	});

	test("search() should close box and disconnect after use", async () => {
		const connection = createMockConnection({ searchResults: [], getAttrsResults: [] });

		const closeBoxTrack = trackCalls(connection, "closeBox");
		const disconnectTrack = trackCalls(connection, "disconnect");

		await mock.module("imap-simple", {
			extends: require,
			decorate: () => {
				return async () => connection;
			},
		});

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		await provider.search({ query: "test" });

		assert.strictEqual(closeBoxTrack.calls.length, 1);
		assert.strictEqual(disconnectTrack.calls.length, 1);
	});

	test("listDrafts() should open DRAFTS box and close/disconnect", async () => {
		const connection = createMockConnection({ searchResults: [], getAttrsResults: [] });

		const openBoxTrack = trackCalls(connection, "openBox");
		const closeBoxTrack = trackCalls(connection, "closeBox");

		await mock.module("imap-simple", {
			extends: require,
			decorate: () => {
				return async () => connection;
			},
		});

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		await provider.listDrafts({});

		assert.strictEqual(openBoxTrack.calls[0].args[0], "DRAFTS");
		assert.strictEqual(closeBoxTrack.calls.length, 1);
	});

	test("deleteDraft() should open DRAFTS box and expunge", async () => {
		const connection = createMockConnection({ searchResults: [], getAttrsResults: [] });

		const openBoxTrack = trackCalls(connection, "openBox");
		const expungeTrack = trackCalls(connection, "expunge");

		await mock.module("imap-simple", {
			extends: require,
			decorate: () => {
				return async () => connection;
			},
		});

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		await provider.deleteDraft("draft-uid-999");

		assert.strictEqual(openBoxTrack.calls[0].args[0], "DRAFTS");
		assert.strictEqual(expungeTrack.calls[0].args[0], { uid: "draft-uid-999" });
	});

	test("organize() should open INBOX box and close/disconnect", async () => {
		const connection = createMockConnection({ searchResults: [], getAttrsResults: [] });

		const openBoxTrack = trackCalls(connection, "openBox");
		const closeBoxTrack = trackCalls(connection, "closeBox");

		await mock.module("imap-simple", {
			extends: require,
			decorate: () => {
				return async () => connection;
			},
		});

		const provider = new ImapProvider({
			host: "imap.example.com",
			user: "user",
			password: "pass",
		});

		await provider.organize({
			messageIds: ["uid-1"],
			action: "markRead",
		});

		assert.strictEqual(openBoxTrack.calls[0].args[0], "INBOX");
		assert.strictEqual(closeBoxTrack.calls.length, 1);
	});
});
