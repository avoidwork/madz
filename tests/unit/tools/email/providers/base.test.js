import { test, describe } from "node:test";
import assert from "node:assert";
import { EmailProvider } from "../../../../../src/tools/email/providers/base.js";

describe("EmailProvider (base)", () => {
	test("constructor should set name, type, and timeoutMs from config", () => {
		const provider = new EmailProvider({ name: "test", type: "custom", timeoutMs: 5000 });
		assert.strictEqual(provider.name, "test");
		assert.strictEqual(provider.type, "custom");
		assert.strictEqual(provider.timeoutMs, 5000);
	});

	test("constructor should use defaults when config values are missing", () => {
		const provider = new EmailProvider({});
		assert.strictEqual(provider.name, "unnamed");
		assert.strictEqual(provider.type, "unknown");
		assert.strictEqual(provider.timeoutMs, 30000);
	});

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

	test("validateConfig() should return { valid: true } by default", () => {
		const provider = new EmailProvider({});
		const result = provider.validateConfig();
		assert.deepStrictEqual(result, { valid: true });
	});

	test("read() should accept default empty params", async () => {
		const provider = new EmailProvider({});
		await assert.rejects(() => provider.read(), Error);
	});

	test("listDrafts() should accept default empty params", async () => {
		const provider = new EmailProvider({});
		await assert.rejects(() => provider.listDrafts(), Error);
	});
});
