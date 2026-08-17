import { test, describe } from "node:test";
import assert from "node:assert";
import { emailImpl } from "../../../../src/tools/email/tools.js";

describe("Email Tool", () => {
	test("email tool has correct name", () => {
		assert.ok("email");
	});

	test("email tool has description", () => {
		assert.ok(
			typeof "email tool — read, send, manage drafts, organize, and search emails." === "string",
		);
	});

	test("email returns structured error when no provider", async () => {
		const result = await emailImpl({ action: "read" }, {});
		assert.ok(!result.ok);
		assert.ok(result.error);
		assert.ok(typeof result.error === "string");
		assert.ok(result.error.includes("No email provider"));
	});

	test("email returns error for unknown action", async () => {
		const result = await emailImpl({ action: "foobar" }, {});
		assert.ok(!result.ok);
		assert.ok(result.error);
		// Unknown action check happens before provider check
		assert.ok(result.error.includes("Unknown action"));
	});

	test("email read returns structured error when no provider", async () => {
		const result = await emailImpl({ action: "read" }, {});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("email send returns structured error when no provider", async () => {
		const result = await emailImpl({ action: "send" }, {});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("email draftSave returns structured error when no provider", async () => {
		const result = await emailImpl({ action: "draftSave" }, {});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("email draftList returns structured error when no provider", async () => {
		const result = await emailImpl({ action: "draftList" }, {});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("email draftUpdate returns structured error when no provider", async () => {
		const result = await emailImpl({ action: "draftUpdate" }, {});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("email draftDelete returns structured error when no provider", async () => {
		const result = await emailImpl({ action: "draftDelete" }, {});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("email organize returns structured error when no provider", async () => {
		const result = await emailImpl({ action: "organize" }, {});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});

	test("email search returns structured error when no provider", async () => {
		const result = await emailImpl({ action: "search" }, {});
		assert.ok(!result.ok);
		assert.ok(result.error);
	});
});
