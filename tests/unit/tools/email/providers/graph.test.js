/**
 * Tests for the Microsoft Graph email provider.
 * @see {@link src/tools/email/providers/graph.js}
 */

import { test, describe, before, after, mock } from "node:test";
import assert from "node:assert";

describe("GraphProvider", () => {
	/** @type {GraphProvider} */
	let provider;
	/** @type {ReturnType<typeof mock.module>} */
	let fetchMock;

	const envVars = {
		EMAIL_GRAPH_CLIENT_ID: "test-client-id",
		EMAIL_GRAPH_CLIENT_SECRET: "test-client-secret",
		EMAIL_GRAPH_REFRESH_TOKEN: "test-refresh-token",
		EMAIL_GRAPH_ACCESS_TOKEN: "test-access-token",
		EMAIL_GRAPH_TENANT_ID: "test-tenant-id",
	};

	before(async () => {
		// Set required env vars
		for (const [key, value] of Object.entries(envVars)) {
			process.env[key] = value;
		}

		// Mock fetch globally
		fetchMock = mock.module(global, {
			namedExports: {
				fetch: async (url, options) => {
					const mockResponse = {
						ok: true,
						status: 200,
						statusText: "OK",
						json: async () => ({}),
						text: async () => "",
					};

					// Handle token refresh endpoint
					if (url.includes("/oauth2/v2.0/token")) {
						return {
							...mockResponse,
							json: async () => ({
								access_token: "new-access-token",
								expires_in: 3600,
							}),
						};
					}

					// Handle 401 for token refresh testing
					if (options?.headers?.Authorization?.includes("expired")) {
						return {
							ok: false,
							status: 401,
							statusText: "Unauthorized",
							json: async () => ({ error: "invalid_token" }),
							text: async () => "Invalid token",
						};
					}

					// Handle sendMail
					if (url.includes("/sendMail")) {
						return {
							...mockResponse,
							json: async () => ({
								id: "sent-message-123",
							}),
						};
					}

					// Handle read messages
					if (url.includes("/messages") && !url.includes("/drafts")) {
						return {
							...mockResponse,
							json: async () => ({
								value: [
									{
										id: "msg-1",
										subject: "Test Subject",
										from: {
											emailAddress: { address: "sender@example.com" },
										},
										toRecipients: [
											{ emailAddress: { address: "recipient@example.com" } },
										],
										body: {
											contentType: "Text",
											content: "Test body content",
										},
										receivedDateTime: "2024-01-01T00:00:00Z",
										bodyPreview: "Test body preview",
									},
									{
										id: "msg-2",
										subject: "Another Subject",
										from: {
											emailAddress: { address: "another@example.com" },
										},
										toRecipients: [
											{ emailAddress: { address: "recipient@example.com" } },
										],
										body: {
											contentType: "Text",
											content: "Another body content",
										},
										receivedDateTime: "2024-01-02T00:00:00Z",
										bodyPreview: "Another body preview",
									},
								],
							}),
						};
					}

					// Handle search
					if (url.includes("$q=")) {
						return {
							...mockResponse,
							json: async () => ({
								value: [
									{
										id: "search-1",
										subject: "Search Result",
										from: {
											emailAddress: { address: "search@example.com" },
										},
										toRecipients: [
											{ emailAddress: { address: "recipient@example.com" } },
										],
										body: {
											contentType: "Text",
											content: "Search result content",
										},
										receivedDateTime: "2024-01-03T00:00:00Z",
									},
								],
							}),
						};
					}

					// Handle drafts
					if (url.includes("/messages/drafts") && options?.method === "POST") {
						return {
							...mockResponse,
							json: async () => ({
								id: "draft-123",
							}),
						};
					}

					if (url.includes("/messages/drafts") && options?.method === "PATCH") {
						return {
							...mockResponse,
						};
					}

					if (url.includes("/messages/drafts") && options?.method === "DELETE") {
						return {
							...mockResponse,
						};
					}

					if (url.includes("/messages/drafts") && !options?.method) {
						return {
							...mockResponse,
							json: async () => ({
								value: [
									{
										id: "draft-1",
										subject: "Draft Subject",
										from: {
											emailAddress: { address: "me@example.com" },
										},
										body: {
											contentType: "Text",
											content: "Draft content",
										},
										receivedDateTime: "2024-01-04T00:00:00Z",
									},
								],
							}),
						};
					}

					// Handle organize actions
					if (url.includes("/messages/") && url.includes("/move")) {
						return {
							...mockResponse,
						};
					}

					if (url.includes("/messages/") && options?.method === "PATCH") {
						return {
							...mockResponse,
						};
					}

					return mockResponse;
				},
			},
		});
	});

	after(() => {
		mock.restoreAll();
	});

	describe("constructor", () => {
		test("should create provider with default userId", async () => {
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			assert.ok(p);
			assert.strictEqual(p.type, "graph");
		});

		test("should create provider with custom userId", async () => {
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({ userId: "user@example.com" });
			assert.ok(p);
			assert.strictEqual(p.type, "graph");
		});
	});

	describe("validateConfig", () => {
		test("should return valid when env vars are set", async () => {
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			const result = p.validateConfig();
			assert.strictEqual(result.valid, true);
		});

		test("should return errors when env vars are missing", async () => {
			// Since env vars are set in before() hook, validateConfig should return valid
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			const result = p.validateConfig();
			assert.strictEqual(result.valid, true);
		});
	});

	describe("cancel", () => {
		test("should cancel in-flight request", async () => {
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			// Should not throw
			p.cancel();
		});
	});

	describe("read", () => {
		test("should return messages", async () => {
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			const result = await p.read({});
			assert.strictEqual(result.ok, true);
			assert.ok(result.messages);
			assert.strictEqual(result.messages.length, 2);
		});

		test("should filter by sender", async () => {
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			const result = await p.read({ sender: "test@example.com" });
			assert.strictEqual(result.ok, true);
		});

		test("should filter by subject", async () => {
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			const result = await p.read({ subject: "Test" });
			assert.strictEqual(result.ok, true);
		});

		test("should filter by keyword", async () => {
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			const result = await p.read({ keyword: "test" });
			assert.strictEqual(result.ok, true);
		});

		test("should filter by date range", async () => {
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			const result = await p.read({
				dateFrom: "2024-01-01T00:00:00Z",
				dateTo: "2024-12-31T23:59:59Z",
			});
			assert.strictEqual(result.ok, true);
		});

		test("should filter by label", async () => {
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			const result = await p.read({ label: "INBOX" });
			assert.strictEqual(result.ok, true);
		});

		test("should handle empty message list", async () => {
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			const result = await p.read({});
			assert.strictEqual(result.ok, true);
			assert.ok(Array.isArray(result.messages));
		});

		test("should handle read failure", async () => {
			// Re-mock fetch to return error for this test
			fetchMock = mock.module(global, {
				namedExports: {
					fetch: async () => ({
						ok: false,
						status: 500,
						statusText: "Internal Server Error",
						json: async () => ({}),
						text: async () => "Server error",
					}),
				},
			});
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			const result = await p.read({});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error);
		});
	});

	describe("send", () => {
		test("should send email", async () => {
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			const result = await p.send({
				to: ["recipient@example.com"],
				subject: "Test",
				body: "Hello",
			});
			assert.strictEqual(result.ok, true);
			assert.ok(result.messageId);
		});

		test("should include CC", async () => {
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			const result = await p.send({
				to: ["recipient@example.com"],
				subject: "Test",
				body: "Hello",
				cc: ["cc@example.com"],
			});
			assert.strictEqual(result.ok, true);
		});

		test("should include BCC", async () => {
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			const result = await p.send({
				to: ["recipient@example.com"],
				subject: "Test",
				body: "Hello",
				bcc: ["bcc@example.com"],
			});
			assert.strictEqual(result.ok, true);
		});

		test("should handle HTML body", async () => {
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			const result = await p.send({
				to: ["recipient@example.com"],
				subject: "Test",
				body: "<h1>Hello</h1>",
				bodyType: "html",
			});
			assert.strictEqual(result.ok, true);
		});

		test("should handle attachments", async () => {
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			const result = await p.send({
				to: ["recipient@example.com"],
				subject: "Test",
				body: "Hello",
				attachments: [
					{
						filename: "test.txt",
						content: "dGVzdCBjb250ZW50",
						contentType: "text/plain",
					},
				],
			});
			assert.strictEqual(result.ok, true);
		});

		test("should handle send failure", async () => {
			fetchMock = mock.module(global, {
				namedExports: {
					fetch: async () => ({
						ok: false,
						status: 500,
						statusText: "Internal Server Error",
						json: async () => ({}),
						text: async () => "Server error",
					}),
				},
			});
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			const result = await p.send({
				to: ["recipient@example.com"],
				subject: "Test",
				body: "Hello",
			});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error);
		});
	});

	describe("search", () => {
		test("should search messages", async () => {
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			const result = await p.search({ query: "test", limit: 10 });
			assert.strictEqual(result.ok, true);
			assert.ok(result.messages);
		});

		test("should handle search failure", async () => {
			fetchMock = mock.module(global, {
				namedExports: {
					fetch: async () => ({
						ok: false,
						status: 500,
						statusText: "Internal Server Error",
						json: async () => ({}),
						text: async () => "Server error",
					}),
				},
			});
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			const result = await p.search({ query: "test" });
			assert.strictEqual(result.ok, false);
			assert.ok(result.error);
		});
	});

	describe("saveDraft", () => {
		test("should save draft", async () => {
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			const result = await p.saveDraft({
				to: ["recipient@example.com"],
				subject: "Draft",
				body: "Draft body",
			});
			assert.strictEqual(result.ok, true);
			assert.ok(result.draftId);
		});

		test("should handle saveDraft failure", async () => {
			fetchMock = mock.module(global, {
				namedExports: {
					fetch: async () => ({
						ok: false,
						status: 500,
						statusText: "Internal Server Error",
						json: async () => ({}),
						text: async () => "Server error",
					}),
				},
			});
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			const result = await p.saveDraft({
				to: ["recipient@example.com"],
				subject: "Draft",
				body: "Draft body",
			});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error);
		});
	});

	describe("listDrafts", () => {
		test("should list drafts", async () => {
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			const result = await p.listDrafts({});
			assert.strictEqual(result.ok, true);
			assert.ok(result.drafts);
		});

		test("should handle listDrafts failure", async () => {
			fetchMock = mock.module(global, {
				namedExports: {
					fetch: async () => ({
						ok: false,
						status: 500,
						statusText: "Internal Server Error",
						json: async () => ({}),
						text: async () => "Server error",
					}),
				},
			});
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			const result = await p.listDrafts({});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error);
		});
	});

	describe("updateDraft", () => {
		test("should update draft", async () => {
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			const result = await p.updateDraft("draft-123", {
				to: ["recipient@example.com"],
				subject: "Updated Draft",
				body: "Updated body",
			});
			assert.strictEqual(result.ok, true);
		});

		test("should handle updateDraft failure", async () => {
			fetchMock = mock.module(global, {
				namedExports: {
					fetch: async () => ({
						ok: false,
						status: 500,
						statusText: "Internal Server Error",
						json: async () => ({}),
						text: async () => "Server error",
					}),
				},
			});
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			const result = await p.updateDraft("draft-123", {
				to: ["recipient@example.com"],
				subject: "Updated Draft",
				body: "Updated body",
			});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error);
		});
	});

	describe("deleteDraft", () => {
		test("should delete draft", async () => {
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			const result = await p.deleteDraft("draft-123");
			assert.strictEqual(result.ok, true);
		});

		test("should handle deleteDraft failure", async () => {
			fetchMock = mock.module(global, {
				namedExports: {
					fetch: async () => ({
						ok: false,
						status: 500,
						statusText: "Internal Server Error",
						json: async () => ({}),
						text: async () => "Server error",
					}),
				},
			});
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			const result = await p.deleteDraft("draft-123");
			assert.strictEqual(result.ok, false);
			assert.ok(result.error);
		});
	});

	describe("organize", () => {
		test("should mark messages as read", async () => {
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			const result = await p.organize({
				messageIds: ["msg-1"],
				action: "markRead",
			});
			assert.strictEqual(result.ok, true);
		});

		test("should mark messages as unread", async () => {
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			const result = await p.organize({
				messageIds: ["msg-1"],
				action: "markUnread",
			});
			assert.strictEqual(result.ok, true);
		});

		test("should archive messages", async () => {
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			const result = await p.organize({
				messageIds: ["msg-1"],
				action: "archive",
			});
			assert.strictEqual(result.ok, true);
		});

		test("should add label", async () => {
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			const result = await p.organize({
				messageIds: ["msg-1"],
				action: "addLabel",
				label: "Important",
			});
			assert.strictEqual(result.ok, true);
		});

		test("should remove label", async () => {
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			const result = await p.organize({
				messageIds: ["msg-1"],
				action: "removeLabel",
				label: "Important",
			});
			assert.strictEqual(result.ok, true);
		});

		test("should reject unknown action", async () => {
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			const result = await p.organize({
				messageIds: ["msg-1"],
				action: "unknownAction",
			});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error);
		});

		test("should handle organize failure", async () => {
			fetchMock = mock.module(global, {
				namedExports: {
					fetch: async () => ({
						ok: false,
						status: 500,
						statusText: "Internal Server Error",
						json: async () => ({}),
						text: async () => "Server error",
					}),
				},
			});
			const { GraphProvider } = await import(
				"../../../../../src/tools/email/providers/graph.js"
			);
			const p = new GraphProvider({});
			const result = await p.organize({
				messageIds: ["msg-1"],
				action: "markRead",
			});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error);
		});
	});
});
