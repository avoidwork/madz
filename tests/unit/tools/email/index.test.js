import { test, describe } from "node:test";
import assert from "node:assert";
import {
	createEmailProvider,
	getActiveProvider,
	validateProviderConfig,
	EmailProvider,
	GmailProvider,
	GraphProvider,
	ImapProvider,
} from "../../../../src/tools/email/index.js";

describe("Email Tools — index exports", () => {
	test("should export createEmailProvider function", () => {
		assert.strictEqual(typeof createEmailProvider, "function");
	});

	test("should export getActiveProvider function", () => {
		assert.strictEqual(typeof getActiveProvider, "function");
	});

	test("should export validateProviderConfig function", () => {
		assert.strictEqual(typeof validateProviderConfig, "function");
	});

	test("should export EmailProvider class", () => {
		assert.strictEqual(typeof EmailProvider, "function");
	});

	test("should export GmailProvider class", () => {
		assert.strictEqual(typeof GmailProvider, "function");
	});

	test("should export GraphProvider class", () => {
		assert.strictEqual(typeof GraphProvider, "function");
	});

	test("should export ImapProvider class", () => {
		assert.strictEqual(typeof ImapProvider, "function");
	});
});
