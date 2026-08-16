import { test, describe } from "node:test";
import assert from "node:assert";
import { emailRead, emailSend, emailDraftSave, emailDraftList, emailDraftUpdate, emailDraftDelete, emailOrganize, emailSearch } from "../../../src/tools/email/tools.js";

describe("Email Tools Integration", () => {
	test("emailRead returns structured error when no provider", async () => {
		const result = await emailRead("{}", {});
		assert.ok(!result.ok);
		assert.ok(result.error);
		assert.ok(typeof result.error === "string");
	});

	test("emailSend returns structured error when no provider", async () => {
		const result = await emailSend("{}", {});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("emailDraftSave returns structured error when no provider", async () => {
		const result = await emailDraftSave("{}", {});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("emailDraftList returns structured error when no provider", async () => {
		const result = await emailDraftList("{}", {});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("emailDraftUpdate returns structured error when no provider", async () => {
		const result = await emailDraftUpdate("{}", {});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("emailDraftDelete returns structured error when no provider", async () => {
		const result = await emailDraftDelete("{}", {});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("emailOrganize returns structured error when no provider", async () => {
		const result = await emailOrganize("{}", {});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("emailSearch returns structured error when no provider", async () => {
		const result = await emailSearch("{}", {});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("emailRead tool has proper metadata", () => {
		assert.ok(emailRead.name);
		assert.ok(emailRead.description);
	});

	test("emailSend tool has proper metadata", () => {
		assert.ok(emailSend.name);
		assert.ok(emailSend.description);
	});

	test("emailOrganize tool has proper metadata", () => {
		assert.ok(emailOrganize.name);
		assert.ok(emailOrganize.description);
	});
});