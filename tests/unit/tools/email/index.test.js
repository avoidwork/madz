import { test, describe } from "node:test";
import assert from "node:assert";
import { emailRead, emailSend, emailDraftSave, emailDraftList, emailDraftUpdate, emailDraftDelete, emailOrganize, emailSearch } from "../../../src/tools/email/tools.js";

describe("Email Tools", () => {
	test("emailRead should have a valid name", () => {
		assert.strictEqual(emailRead.name, "emailRead");
	});

	test("emailSend should have a valid name", () => {
		assert.strictEqual(emailSend.name, "emailSend");
	});

	test("emailDraftSave should have a valid name", () => {
		assert.strictEqual(emailDraftSave.name, "emailDraftSave");
	});

	test("emailDraftList should have a valid name", () => {
		assert.strictEqual(emailDraftList.name, "emailDraftList");
	});

	test("emailDraftUpdate should have a valid name", () => {
		assert.strictEqual(emailDraftUpdate.name, "emailDraftUpdate");
	});

	test("emailDraftDelete should have a valid name", () => {
		assert.strictEqual(emailDraftDelete.name, "emailDraftDelete");
	});

	test("emailOrganize should have a valid name", () => {
		assert.strictEqual(emailOrganize.name, "emailOrganize");
	});

	test("emailSearch should have a valid name", () => {
		assert.strictEqual(emailSearch.name, "emailSearch");
	});

	test("emailRead should return { ok: false } when no provider configured", async () => {
		const result = await emailRead("{}", {});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error);
	});

	test("emailSend should return { ok: false } when no provider configured", async () => {
		const result = await emailSend("{}", {});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error);
	});

	test("emailDraftSave should return { ok: false } when no provider configured", async () => {
		const result = await emailDraftSave("{}", {});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error);
	});

	test("emailDraftList should return { ok: false } when no provider configured", async () => {
		const result = await emailDraftList("{}", {});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error);
	});

	test("emailDraftUpdate should return { ok: false } when no provider configured", async () => {
		const result = await emailDraftUpdate("{}", {});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error);
	});

	test("emailDraftDelete should return { ok: false } when no provider configured", async () => {
		const result = await emailDraftDelete("{}", {});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error);
	});

	test("emailOrganize should return { ok: false } when no provider configured", async () => {
		const result = await emailOrganize("{}", {});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error);
	});

	test("emailSearch should return { ok: false } when no provider configured", async () => {
		const result = await emailSearch("{}", {});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error);
	});
});