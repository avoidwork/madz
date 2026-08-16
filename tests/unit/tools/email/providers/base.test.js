import { test, describe } from "node:test";
import assert from "node:assert";
import { EmailProvider } from "../../../src/tools/email/providers/base.js";

describe("EmailProvider (base)", () => {
	test("should throw on read() — abstract method", async () => {
		const provider = new EmailProvider({});
		await assert.rejects(() => provider.read({}), Error);
	});

	test("should throw on send() — abstract method", async () => {
		const provider = new EmailProvider({});
		await assert.rejects(() => provider.send({}), Error);
	});

	test("should throw on saveDraft() — abstract method", async () => {
		const provider = new EmailProvider({});
		await assert.rejects(() => provider.saveDraft({}), Error);
	});

	test("should throw on listDrafts() — abstract method", async () => {
		const provider = new EmailProvider({});
		await assert.rejects(() => provider.listDrafts({}), Error);
	});

	test("should throw on updateDraft() — abstract method", async () => {
		const provider = new EmailProvider({});
		await assert.rejects(() => provider.updateDraft("draft-id", {}), Error);
	});

	test("should throw on deleteDraft() — abstract method", async () => {
		const provider = new EmailProvider({});
		await assert.rejects(() => provider.deleteDraft("draft-id"), Error);
	});

	test("should throw on organize() — abstract method", async () => {
		const provider = new EmailProvider({});
		await assert.rejects(() => provider.organize({}), Error);
	});

	test("should throw on search() — abstract method", async () => {
		const provider = new EmailProvider({});
		await assert.rejects(() => provider.search({}), Error);
	});

	test("normalizeMessage() should return a valid message object", () => {
		const provider = new EmailProvider({});
		const msg = provider.normalizeMessage({
			id: "msg-1",
			from: "test@example.com",
			subject: "Test",
			body: "Hello",
			date: "2024-01-01T00:00:00Z",
		});
		assert.strictEqual(msg.id, "msg-1");
		assert.strictEqual(msg.from, "test@example.com");
		assert.strictEqual(msg.subject, "Test");
		assert.strictEqual(msg.body, "Hello");
		assert.strictEqual(msg.date, "2024-01-01T00:00:00Z");
	});
});