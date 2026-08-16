import { test, describe } from "node:test";
import assert from "node:assert";
import { ImapProvider } from "../../../../src/tools/email/providers/imap.js";

describe("ImapProvider", () => {
	test("should throw when no credentials configured", () => {
		assert.throws(() => new ImapProvider({}), /IMAP requires credentials/);
	});

	test("should throw when user is missing", () => {
		assert.throws(() => new ImapProvider({ password: "pass" }), /user/);
	});

	test("should throw when password is missing", () => {
		assert.throws(() => new ImapProvider({ user: "user" }), /password/);
	});

	test("read() should return { ok: false } when imap-simple is not installed", async () => {
		const provider = new ImapProvider({ user: "user", password: "pass" });
		const result = await provider.read({ limit: 5 });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error);
	});

	test("send() should return { ok: false } when nodemailer is not installed", async () => {
		const provider = new ImapProvider({ user: "user", password: "pass" });
		const result = await provider.send({
			to: ["test@example.com"],
			subject: "Test",
			body: "Hello",
		});
		assert.strictEqual(result.ok, false);
	});

	test("saveDraft() should return { ok: false } when imap-simple is not installed", async () => {
		const provider = new ImapProvider({ user: "user", password: "pass" });
		const result = await provider.saveDraft({
			to: ["test@example.com"],
			subject: "Test",
			body: "Hello",
		});
		assert.strictEqual(result.ok, false);
	});

	test("listDrafts() should return { ok: false } when imap-simple is not installed", async () => {
		const provider = new ImapProvider({ user: "user", password: "pass" });
		const result = await provider.listDrafts({});
		assert.strictEqual(result.ok, false);
	});

	test("updateDraft() should return { ok: false } when imap-simple is not installed", async () => {
		const provider = new ImapProvider({ user: "user", password: "pass" });
		const result = await provider.updateDraft("draft-id", { subject: "Updated" });
		assert.strictEqual(result.ok, false);
	});

	test("deleteDraft() should return { ok: false } when imap-simple is not installed", async () => {
		const provider = new ImapProvider({ user: "user", password: "pass" });
		const result = await provider.deleteDraft("draft-id");
		assert.strictEqual(result.ok, false);
	});

	test("organize() should return { ok: false } when imap-simple is not installed", async () => {
		const provider = new ImapProvider({ user: "user", password: "pass" });
		const result = await provider.organize({ messageIds: ["msg-1"], action: "markRead" });
		assert.strictEqual(result.ok, false);
	});

	test("search() should return { ok: false } when imap-simple is not installed", async () => {
		const provider = new ImapProvider({ user: "user", password: "pass" });
		const result = await provider.search({ query: "test" });
		assert.strictEqual(result.ok, false);
	});
});
