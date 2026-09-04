import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import { emailImpl } from "../../../../src/tools/email/tools.js";

describe("Email Tool — emailImpl", () => {
	before(() => {
		// Set env vars so GmailProvider can be instantiated
		process.env.EMAIL_GMAIL_CLIENT_ID = "test-id";
		process.env.EMAIL_GMAIL_CLIENT_SECRET = "test-secret";
		process.env.EMAIL_GMAIL_REFRESH_TOKEN = "test-token";
		process.env.EMAIL_GMAIL_ACCESS_TOKEN = "test-access-token";
	});

	after(() => {
		delete process.env.EMAIL_GMAIL_CLIENT_ID;
		delete process.env.EMAIL_GMAIL_CLIENT_SECRET;
		delete process.env.EMAIL_GMAIL_REFRESH_TOKEN;
		delete process.env.EMAIL_GMAIL_ACCESS_TOKEN;
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

	test("email read returns error when no filters provided", async () => {
		const result = await emailImpl(
			{ action: "read" },
			{ config: { email: { provider: { type: "gmail" } } } },
		);
		assert.ok(!result.ok);
		assert.ok(result.error.includes("At least one filter is required"));
	});

	test("email send returns error when no recipients", async () => {
		const result = await emailImpl(
			{ action: "send" },
			{ config: { email: { provider: { type: "gmail" } } } },
		);
		assert.ok(!result.ok);
		assert.ok(result.error.includes("At least one recipient"));
	});

	test("email send returns error when no subject", async () => {
		const result = await emailImpl(
			{ action: "send", to: ["test@test.com"] },
			{ config: { email: { provider: { type: "gmail" } } } },
		);
		assert.ok(!result.ok);
		assert.ok(result.error.includes("Subject is required"));
	});

	test("email send returns error when no body", async () => {
		const result = await emailImpl(
			{ action: "send", to: ["test@test.com"], subject: "Test" },
			{ config: { email: { provider: { type: "gmail" } } } },
		);
		assert.ok(!result.ok);
		assert.ok(result.error.includes("Body is required"));
	});

	test("email draftSave returns error when no recipients", async () => {
		const result = await emailImpl(
			{ action: "draftSave" },
			{ config: { email: { provider: { type: "gmail" } } } },
		);
		assert.ok(!result.ok);
		assert.ok(result.error.includes("At least one recipient"));
	});

	test("email draftSave returns error when no subject", async () => {
		const result = await emailImpl(
			{ action: "draftSave", to: ["test@test.com"] },
			{ config: { email: { provider: { type: "gmail" } } } },
		);
		assert.ok(!result.ok);
		assert.ok(result.error.includes("Subject is required"));
	});

	test("email draftSave returns error when no body", async () => {
		const result = await emailImpl(
			{ action: "draftSave", to: ["test@test.com"], subject: "Test" },
			{ config: { email: { provider: { type: "gmail" } } } },
		);
		assert.ok(!result.ok);
		assert.ok(result.error.includes("Body is required"));
	});

	test("email draftUpdate returns error when no draftId", async () => {
		const result = await emailImpl(
			{ action: "draftUpdate" },
			{ config: { email: { provider: { type: "gmail" } } } },
		);
		assert.ok(!result.ok);
		assert.ok(result.error.includes("Draft ID is required"));
	});

	test("email draftDelete returns error when no draftId", async () => {
		const result = await emailImpl(
			{ action: "draftDelete" },
			{ config: { email: { provider: { type: "gmail" } } } },
		);
		assert.ok(!result.ok);
		assert.ok(result.error.includes("Draft ID is required"));
	});

	test("email organize returns error when no messageIds", async () => {
		const result = await emailImpl(
			{ action: "organize" },
			{ config: { email: { provider: { type: "gmail" } } } },
		);
		assert.ok(!result.ok);
		assert.ok(result.error.includes("At least one message ID"));
	});

	test("email organize returns error when no action", async () => {
		const result = await emailImpl(
			{ action: "organize", messageIds: ["msg-1"] },
			{ config: { email: { provider: { type: "gmail" } } } },
		);
		assert.ok(!result.ok);
		assert.ok(result.error.includes("Action is required"));
	});

	test("email organize returns error for invalid action", async () => {
		const result = await emailImpl(
			{ action: "organize", messageIds: ["msg-1"], organizeAction: "invalid" },
			{ config: { email: { provider: { type: "gmail" } } } },
		);
		assert.ok(!result.ok);
		assert.ok(result.error.includes("Invalid action"));
	});

	test("email organize returns error when label missing for addLabel", async () => {
		const result = await emailImpl(
			{ action: "organize", messageIds: ["msg-1"], organizeAction: "addLabel" },
			{ config: { email: { provider: { type: "gmail" } } } },
		);
		assert.ok(!result.ok);
		assert.ok(result.error.includes("Label is required"));
	});

	test("email search returns error when no query", async () => {
		const result = await emailImpl(
			{ action: "search" },
			{ config: { email: { provider: { type: "gmail" } } } },
		);
		assert.ok(!result.ok);
		assert.ok(result.error.includes("Search query is required"));
	});
});
