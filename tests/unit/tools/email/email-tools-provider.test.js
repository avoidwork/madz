import { test, describe, before, after, mock } from "node:test";
import assert from "node:assert";

describe("Email Tool — emailImpl provider interaction paths", () => {
	let emailImpl;
	// Pre-define all methods so mock.method() can override them
	const mockProvider = {
		read: async () => ({ ok: false, error: "not implemented" }),
		send: async () => ({ ok: false, error: "not implemented" }),
		saveDraft: async () => ({ ok: false, error: "not implemented" }),
		listDrafts: async () => ({ ok: false, error: "not implemented" }),
		updateDraft: async () => ({ ok: false, error: "not implemented" }),
		deleteDraft: async () => ({ ok: false, error: "not implemented" }),
		organize: async () => ({ ok: false, error: "not implemented" }),
		search: async () => ({ ok: false, error: "not implemented" }),
	};

	before(async () => {
		const mod = await import("../../../../src/tools/email/tools.js");
		emailImpl = mod.emailImpl;
	});

	after(() => {
		mock.reset();
	});

	const withMock = (overrides = {}) => ({
		_provider: mockProvider,
		...overrides,
	});

	// =========================================================================
	// READ
	// =========================================================================
	test("read: returns messages on success", async () => {
		mock.method(mockProvider, "read", async () => ({
			ok: true,
			messages: [{ id: "1" }],
		}));
		const result = await emailImpl({ action: "read", folder: "INBOX" }, withMock());
		assert.ok(result.ok);
		assert.strictEqual(result.count, 1);
		assert.deepStrictEqual(result.messages, [{ id: "1" }]);
	});

	test("read: returns error when provider returns error", async () => {
		mock.method(mockProvider, "read", async () => ({
			ok: false,
			error: "read failed",
		}));
		const result = await emailImpl({ action: "read", folder: "INBOX" }, withMock());
		assert.ok(!result.ok);
		assert.ok(result.error.includes("read failed"));
	});

	test("read: returns error when provider throws", async () => {
		mock.method(mockProvider, "read", async () => {
			throw new Error("connection failed");
		});
		const result = await emailImpl({ action: "read", folder: "INBOX" }, withMock());
		assert.ok(!result.ok);
		assert.ok(result.error.includes("Email read failed"));
	});

	// =========================================================================
	// SEND
	// =========================================================================
	test("send: returns success on send", async () => {
		mock.method(mockProvider, "send", async () => ({
			ok: true,
			messageId: "sent-1",
		}));
		const result = await emailImpl(
			{
				action: "send",
				to: ["test@test.com"],
				subject: "Test",
				body: "Hello",
			},
			withMock(),
		);
		assert.ok(result.ok);
		assert.strictEqual(result.messageId, "sent-1");
		assert.deepStrictEqual(result.recipients, ["test@test.com"]);
	});

	test("send: returns error when provider returns error", async () => {
		mock.method(mockProvider, "send", async () => ({
			ok: false,
			error: "send failed",
		}));
		const result = await emailImpl(
			{
				action: "send",
				to: ["test@test.com"],
				subject: "Test",
				body: "Hello",
			},
			withMock(),
		);
		assert.ok(!result.ok);
		assert.ok(result.error.includes("send failed"));
	});

	test("send: returns error when provider throws", async () => {
		mock.method(mockProvider, "send", async () => {
			throw new Error("smtp error");
		});
		const result = await emailImpl(
			{
				action: "send",
				to: ["test@test.com"],
				subject: "Test",
				body: "Hello",
			},
			withMock(),
		);
		assert.ok(!result.ok);
		assert.ok(result.error.includes("Email send failed"));
	});

	// =========================================================================
	// DRAFT SAVE
	// =========================================================================
	test("draftSave: returns success on save", async () => {
		mock.method(mockProvider, "saveDraft", async () => ({
			ok: true,
			draftId: "draft-1",
		}));
		const result = await emailImpl(
			{
				action: "draftSave",
				to: ["test@test.com"],
				subject: "Test",
				body: "Hello",
			},
			withMock(),
		);
		assert.ok(result.ok);
		assert.strictEqual(result.draftId, "draft-1");
	});

	test("draftSave: returns error when provider returns error", async () => {
		mock.method(mockProvider, "saveDraft", async () => ({
			ok: false,
			error: "save failed",
		}));
		const result = await emailImpl(
			{
				action: "draftSave",
				to: ["test@test.com"],
				subject: "Test",
				body: "Hello",
			},
			withMock(),
		);
		assert.ok(!result.ok);
		assert.ok(result.error.includes("save failed"));
	});

	test("draftSave: returns error when provider throws", async () => {
		mock.method(mockProvider, "saveDraft", async () => {
			throw new Error("draft error");
		});
		const result = await emailImpl(
			{
				action: "draftSave",
				to: ["test@test.com"],
				subject: "Test",
				body: "Hello",
			},
			withMock(),
		);
		assert.ok(!result.ok);
		assert.ok(result.error.includes("Email draft save failed"));
	});

	// =========================================================================
	// DRAFT LIST
	// =========================================================================
	test("draftList: returns drafts on success", async () => {
		mock.method(mockProvider, "listDrafts", async () => ({
			ok: true,
			drafts: [{ id: "d-1" }],
		}));
		const result = await emailImpl({ action: "draftList" }, withMock());
		assert.ok(result.ok);
		assert.strictEqual(result.count, 1);
		assert.deepStrictEqual(result.drafts, [{ id: "d-1" }]);
	});

	test("draftList: returns error when provider returns error", async () => {
		mock.method(mockProvider, "listDrafts", async () => ({
			ok: false,
			error: "list failed",
		}));
		const result = await emailImpl({ action: "draftList" }, withMock());
		assert.ok(!result.ok);
		assert.ok(result.error.includes("list failed"));
	});

	test("draftList: returns error when provider throws", async () => {
		mock.method(mockProvider, "listDrafts", async () => {
			throw new Error("list error");
		});
		const result = await emailImpl({ action: "draftList" }, withMock());
		assert.ok(!result.ok);
		assert.ok(result.error.includes("Email draft list failed"));
	});

	// =========================================================================
	// DRAFT UPDATE
	// =========================================================================
	test("draftUpdate: returns success on update", async () => {
		mock.method(mockProvider, "updateDraft", async () => ({ ok: true }));
		const result = await emailImpl(
			{ action: "draftUpdate", draftId: "d-1", subject: "Updated" },
			withMock(),
		);
		assert.ok(result.ok);
		assert.strictEqual(result.draftId, "d-1");
	});

	test("draftUpdate: returns error when provider returns error", async () => {
		mock.method(mockProvider, "updateDraft", async () => ({
			ok: false,
			error: "update failed",
		}));
		const result = await emailImpl({ action: "draftUpdate", draftId: "d-1" }, withMock());
		assert.ok(!result.ok);
		assert.ok(result.error.includes("update failed"));
	});

	test("draftUpdate: returns error when provider throws", async () => {
		mock.method(mockProvider, "updateDraft", async () => {
			throw new Error("update error");
		});
		const result = await emailImpl({ action: "draftUpdate", draftId: "d-1" }, withMock());
		assert.ok(!result.ok);
		assert.ok(result.error.includes("Email draft update failed"));
	});

	// =========================================================================
	// DRAFT DELETE
	// =========================================================================
	test("draftDelete: returns success on delete", async () => {
		mock.method(mockProvider, "deleteDraft", async () => ({ ok: true }));
		const result = await emailImpl({ action: "draftDelete", draftId: "d-1" }, withMock());
		assert.ok(result.ok);
	});

	test("draftDelete: returns error when provider returns error", async () => {
		mock.method(mockProvider, "deleteDraft", async () => ({
			ok: false,
			error: "delete failed",
		}));
		const result = await emailImpl({ action: "draftDelete", draftId: "d-1" }, withMock());
		assert.ok(!result.ok);
		assert.ok(result.error.includes("delete failed"));
	});

	test("draftDelete: returns error when provider throws", async () => {
		mock.method(mockProvider, "deleteDraft", async () => {
			throw new Error("delete error");
		});
		const result = await emailImpl({ action: "draftDelete", draftId: "d-1" }, withMock());
		assert.ok(!result.ok);
		assert.ok(result.error.includes("Email draft delete failed"));
	});

	// =========================================================================
	// ORGANIZE
	// =========================================================================
	test("organize: returns success on organize", async () => {
		mock.method(mockProvider, "organize", async () => ({ ok: true }));
		const result = await emailImpl(
			{
				action: "organize",
				messageIds: ["msg-1"],
				organizeAction: "markRead",
			},
			withMock(),
		);
		assert.ok(result.ok);
		assert.strictEqual(result.action, "markRead");
		assert.strictEqual(result.messageCount, 1);
	});

	test("organize: returns success with multiple messageIds", async () => {
		mock.method(mockProvider, "organize", async () => ({ ok: true }));
		const result = await emailImpl(
			{
				action: "organize",
				messageIds: ["msg-1", "msg-2"],
				organizeAction: "archive",
			},
			withMock(),
		);
		assert.ok(result.ok);
		assert.strictEqual(result.action, "archive");
		assert.strictEqual(result.messageCount, 2);
	});

	test("organize: returns error when provider returns error", async () => {
		mock.method(mockProvider, "organize", async () => ({
			ok: false,
			error: "organize failed",
		}));
		const result = await emailImpl(
			{
				action: "organize",
				messageIds: ["msg-1"],
				organizeAction: "markRead",
			},
			withMock(),
		);
		assert.ok(!result.ok);
		assert.ok(result.error.includes("organize failed"));
	});

	test("organize: returns error when provider throws", async () => {
		mock.method(mockProvider, "organize", async () => {
			throw new Error("organize error");
		});
		const result = await emailImpl(
			{
				action: "organize",
				messageIds: ["msg-1"],
				organizeAction: "markRead",
			},
			withMock(),
		);
		assert.ok(!result.ok);
		assert.ok(result.error.includes("Email organize failed"));
	});

	// =========================================================================
	// SEARCH
	// =========================================================================
	test("search: returns messages on success", async () => {
		mock.method(mockProvider, "search", async () => ({
			ok: true,
			messages: [{ id: "1" }],
		}));
		const result = await emailImpl({ action: "search", query: "test" }, withMock());
		assert.ok(result.ok);
		assert.strictEqual(result.count, 1);
		assert.deepStrictEqual(result.messages, [{ id: "1" }]);
	});

	test("search: returns error when provider returns error", async () => {
		mock.method(mockProvider, "search", async () => ({
			ok: false,
			error: "search failed",
		}));
		const result = await emailImpl({ action: "search", query: "test" }, withMock());
		assert.ok(!result.ok);
		assert.ok(result.error.includes("search failed"));
	});

	test("search: returns error when provider throws", async () => {
		mock.method(mockProvider, "search", async () => {
			throw new Error("search error");
		});
		const result = await emailImpl({ action: "search", query: "test" }, withMock());
		assert.ok(!result.ok);
		assert.ok(result.error.includes("Email search failed"));
	});
});
