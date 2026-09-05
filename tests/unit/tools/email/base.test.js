import { describe, it } from "node:test";
import assert from "node:assert";
import { EmailProvider } from "../../../../src/tools/email/providers/base.js";

describe("EmailProvider base class", () => {
	it("sets name, type, and timeoutMs from config", () => {
		const p = new EmailProvider({ name: "test", type: "gmail", timeoutMs: 5000 });
		assert.strictEqual(p.name, "test");
		assert.strictEqual(p.type, "gmail");
		assert.strictEqual(p.timeoutMs, 5000);
	});

	it("uses defaults when config fields are missing", () => {
		const p = new EmailProvider({});
		assert.strictEqual(p.name, "unnamed");
		assert.strictEqual(p.type, "unknown");
		assert.strictEqual(p.timeoutMs, 30000);
	});

	it("send() throws not implemented error", async () => {
		const p = new EmailProvider({ type: "test" });
		await assert.rejects(() => p.send({}), /send\(\) not implemented for test provider/);
	});

	it("read() throws not implemented error", async () => {
		const p = new EmailProvider({ type: "test" });
		await assert.rejects(() => p.read({}), /read\(\) not implemented for test provider/);
	});

	it("search() throws not implemented error", async () => {
		const p = new EmailProvider({ type: "test" });
		await assert.rejects(() => p.search({}), /search\(\) not implemented for test provider/);
	});

	it("saveDraft() throws not implemented error", async () => {
		const p = new EmailProvider({ type: "test" });
		await assert.rejects(() => p.saveDraft({}), /saveDraft\(\) not implemented for test provider/);
	});

	it("listDrafts() throws not implemented error", async () => {
		const p = new EmailProvider({ type: "test" });
		await assert.rejects(() => p.listDrafts({}), /listDrafts\(\) not implemented for test provider/);
	});

	it("updateDraft() throws not implemented error", async () => {
		const p = new EmailProvider({ type: "test" });
		await assert.rejects(() => p.updateDraft("id", {}), /updateDraft\(\) not implemented for test provider/);
	});

	it("deleteDraft() throws not implemented error", async () => {
		const p = new EmailProvider({ type: "test" });
		await assert.rejects(() => p.deleteDraft("id"), /deleteDraft\(\) not implemented for test provider/);
	});

	it("organize() throws not implemented error", async () => {
		const p = new EmailProvider({ type: "test" });
		await assert.rejects(() => p.organize({}), /organize\(\) not implemented for test provider/);
	});

	it("validateConfig() returns valid by default", () => {
		const p = new EmailProvider({});
		const result = p.validateConfig();
		assert.deepStrictEqual(result, { valid: true });
	});
});
