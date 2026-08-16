import { test, describe } from "node:test";
import assert from "node:assert";
import { GmailProvider } from "../../../../src/tools/email/providers/gmail.js";

describe("GmailProvider", () => {
	test("should throw when no credentials configured", () => {
		assert.throws(() => new GmailProvider({}), /Gmail requires credentials/);
	});

	test("should throw when clientId is missing", () => {
		assert.throws(
			() => new GmailProvider({ clientSecret: "secret", refreshToken: "token" }),
			/clientId/,
		);
	});

	test("should throw when clientSecret is missing", () => {
		assert.throws(
			() => new GmailProvider({ clientId: "id", refreshToken: "token" }),
			/clientSecret/,
		);
	});

	test("should throw when refreshToken is missing", () => {
		assert.throws(
			() => new GmailProvider({ clientId: "id", clientSecret: "secret" }),
			/refreshToken/,
		);
	});

	test("read() should return { ok: false } when googleapis is not installed", async () => {
		const provider = new GmailProvider({
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
		});
		const result = await provider.read({ limit: 5 });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error);
	});

	test("send() should return { ok: false } when googleapis is not installed", async () => {
		const provider = new GmailProvider({
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
		});
		const result = await provider.send({
			to: ["test@example.com"],
			subject: "Test",
			body: "Hello",
		});
		assert.strictEqual(result.ok, false);
	});

	test("saveDraft() should return { ok: false } when googleapis is not installed", async () => {
		const provider = new GmailProvider({
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
		});
		const result = await provider.saveDraft({
			to: ["test@example.com"],
			subject: "Test",
			body: "Hello",
		});
		assert.strictEqual(result.ok, false);
	});

	test("listDrafts() should return { ok: false } when googleapis is not installed", async () => {
		const provider = new GmailProvider({
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
		});
		const result = await provider.listDrafts({});
		assert.strictEqual(result.ok, false);
	});

	test("updateDraft() should return { ok: false } when googleapis is not installed", async () => {
		const provider = new GmailProvider({
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
		});
		const result = await provider.updateDraft("draft-id", { subject: "Updated" });
		assert.strictEqual(result.ok, false);
	});

	test("deleteDraft() should return { ok: false } when googleapis is not installed", async () => {
		const provider = new GmailProvider({
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
		});
		const result = await provider.deleteDraft("draft-id");
		assert.strictEqual(result.ok, false);
	});

	test("organize() should return { ok: false } when googleapis is not installed", async () => {
		const provider = new GmailProvider({
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
		});
		const result = await provider.organize({ messageIds: ["msg-1"], action: "markRead" });
		assert.strictEqual(result.ok, false);
	});

	test("search() should return { ok: false } when googleapis is not installed", async () => {
		const provider = new GmailProvider({
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
		});
		const result = await provider.search({ query: "test" });
		assert.strictEqual(result.ok, false);
	});
});
