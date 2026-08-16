import { test, describe, before, after, mock } from "node:test";
import assert from "node:assert";
import { GraphProvider } from "../../../../../src/tools/email/providers/graph.js";

describe("GraphProvider — happy paths", () => {
	let origFetch;

	before(() => {
		origFetch = globalThis.fetch;
	});

	after(() => {
		globalThis.fetch = origFetch;
	});

	test("read() should return messages from Graph API", async () => {
		globalThis.fetch = async (url, opts) => {
			if (url.includes("/token")) {
				return {
					ok: true,
					json: async () => ({ access_token: "fake-token" }),
				};
			}
			if (url.includes("/messages?")) {
				return {
					ok: true,
					json: async () => ({
						value: [
							{
								id: "graph-msg-1",
								subject: "Graph Test",
								from: { emailAddress: { address: "graph@example.com" } },
								toRecipients: [{ emailAddress: { address: "me@example.com" } }],
								body: { contentType: "Text", content: "Graph body" },
								receivedDateTime: "2024-01-01T00:00:00Z",
							},
						],
					}),
				};
			}
			return { ok: false, status: 404 };
		};

		const provider = new GraphProvider({
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
			tenantId: "tenant",
		});

		const result = await provider.read({ limit: 5 });

		assert.strictEqual(result.ok, true);
		assert.ok(result.messages);
		assert.strictEqual(result.messages.length, 1);
		assert.strictEqual(result.messages[0].id, "graph-msg-1");
		assert.strictEqual(result.messages[0].subject, "Graph Test");
		assert.strictEqual(result.messages[0].body, "Graph body");
	});

	test("read() should include $filter in URL when filters provided", async () => {
		const fetchCalls = [];
		globalThis.fetch = async (url, opts) => {
			fetchCalls.push(url);
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			return {
				ok: true,
				json: async () => ({ value: [] }),
			};
		};

		const provider = new GraphProvider({
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
			tenantId: "tenant",
		});

		await provider.read({
			sender: "test@example.com",
			subject: "urgent",
		});

		const messageUrl = fetchCalls.find((u) => u.includes("/messages?"));
		assert.ok(messageUrl);
		assert.ok(messageUrl.includes("from/emailAddress/address eq 'test@example.com'"));
		assert.ok(messageUrl.includes("contains(subject, 'urgent')"));
	});

	test("send() should POST to sendMail endpoint", async () => {
		let sentBody = null;
		globalThis.fetch = async (url, opts) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			if (url.includes("/sendMail")) {
				sentBody = JSON.parse(opts.body);
				return {
					ok: true,
					json: async () => ({ id: "sent-msg-123" }),
				};
			}
			return { ok: false, status: 404 };
		};

		const provider = new GraphProvider({
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
			tenantId: "tenant",
		});

		const result = await provider.send({
			to: ["recipient@example.com"],
			subject: "Send Test",
			body: "Hello from Graph",
		});

		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.messageId, "sent-msg-123");
		assert.ok(sentBody);
		assert.strictEqual(sentBody.message.subject, "Send Test");
		assert.strictEqual(sentBody.message.body.content, "Hello from Graph");
		assert.deepStrictEqual(sentBody.message.toRecipients, [
			{ emailAddress: { address: "recipient@example.com" } },
		]);
	});

	test("send() should include CC and BCC recipients", async () => {
		let sentBody = null;
		globalThis.fetch = async (url, opts) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			if (url.includes("/sendMail")) {
				sentBody = JSON.parse(opts.body);
				return { ok: true, json: async () => ({ id: "sent-1" }) };
			}
			return { ok: false, status: 404 };
		};

		const provider = new GraphProvider({
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
			tenantId: "tenant",
		});

		await provider.send({
			to: ["to@example.com"],
			cc: ["cc@example.com"],
			bcc: ["bcc@example.com"],
			subject: "Test",
			body: "Body",
		});

		assert.ok(sentBody.message.ccRecipients);
		assert.deepStrictEqual(sentBody.message.ccRecipients, [
			{ emailAddress: { address: "cc@example.com" } },
		]);
		assert.ok(sentBody.message.bccRecipients);
		assert.deepStrictEqual(sentBody.message.bccRecipients, [
			{ emailAddress: { address: "bcc@example.com" } },
		]);
	});

	test("send() should include attachments", async () => {
		let sentBody = null;
		globalThis.fetch = async (url, opts) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			if (url.includes("/sendMail")) {
				sentBody = JSON.parse(opts.body);
				return { ok: true, json: async () => ({ id: "sent-1" }) };
			}
			return { ok: false, status: 404 };
		};

		const provider = new GraphProvider({
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
			tenantId: "tenant",
		});

		await provider.send({
			to: ["recipient@example.com"],
			subject: "With attachment",
			body: "See attached",
			attachments: [
				{ filename: "report.pdf", content: "base64data", contentType: "application/pdf" },
			],
		});

		assert.ok(sentBody.message.attachments);
		assert.strictEqual(sentBody.message.attachments.length, 1);
		assert.strictEqual(sentBody.message.attachments[0].name, "report.pdf");
		assert.strictEqual(sentBody.message.attachments[0].contentType, "application/pdf");
		assert.strictEqual(sentBody.message.attachments[0]["@odata.type"], "#microsoft.graph.fileAttachment");
	});

	test("send() should handle HTML body type", async () => {
		let sentBody = null;
		globalThis.fetch = async (url, opts) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			if (url.includes("/sendMail")) {
				sentBody = JSON.parse(opts.body);
				return { ok: true, json: async () => ({ id: "sent-1" }) };
			}
			return { ok: false, status: 404 };
		};

		const provider = new GraphProvider({
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
			tenantId: "tenant",
		});

		await provider.send({
			to: ["recipient@example.com"],
			subject: "HTML",
			body: "<p>Hello</p>",
			bodyType: "html",
		});

		assert.strictEqual(sentBody.message.body.contentType, "HTML");
	});

	test("search() should query messages with $q parameter", async () => {
		const fetchCalls = [];
		globalThis.fetch = async (url, opts) => {
			fetchCalls.push(url);
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			return {
				ok: true,
				json: async () => ({ value: [] }),
			};
		};

		const provider = new GraphProvider({
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
			tenantId: "tenant",
		});

		await provider.search({ query: "important meeting", limit: 10 });

		const searchUrl = fetchCalls.find((u) => u.includes("/messages?$q="));
		assert.ok(searchUrl);
		assert.ok(searchUrl.includes("important%20meeting"));
		assert.ok(searchUrl.includes("$top=10"));
	});

	test("saveDraft() should POST to drafts endpoint", async () => {
		let sentBody = null;
		globalThis.fetch = async (url, opts) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			if (url.includes("/messages/drafts") && opts.method === "POST") {
				sentBody = JSON.parse(opts.body);
				return {
					ok: true,
					json: async () => ({ id: "draft-abc-123" }),
				};
			}
			return { ok: false, status: 404 };
		};

		const provider = new GraphProvider({
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
			tenantId: "tenant",
		});

		const result = await provider.saveDraft({
			to: ["recipient@example.com"],
			subject: "Draft Test",
			body: "Draft content",
		});

		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.draftId, "draft-abc-123");
		assert.ok(sentBody);
		assert.strictEqual(sentBody.subject, "Draft Test");
		assert.strictEqual(sentBody.body.content, "Draft content");
	});

	test("listDrafts() should return list of drafts", async () => {
		globalThis.fetch = async (url, opts) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			if (url.includes("/messages/drafts")) {
				return {
					ok: true,
					json: async () => ({
						value: [
							{
								id: "draft-1",
								subject: "Draft One",
								from: { emailAddress: { address: "me@example.com" } },
								body: { contentType: "Text", content: "Draft body 1" },
								receivedDateTime: "2024-01-01T00:00:00Z",
							},
							{
								id: "draft-2",
								subject: "Draft Two",
								from: { emailAddress: { address: "me@example.com" } },
								body: { contentType: "Text", content: "Draft body 2" },
								receivedDateTime: "2024-01-02T00:00:00Z",
							},
						],
					}),
				};
			}
			return { ok: false, status: 404 };
		};

		const provider = new GraphProvider({
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
			tenantId: "tenant",
		});

		const result = await provider.listDrafts({ limit: 5 });

		assert.strictEqual(result.ok, true);
		assert.ok(result.drafts);
		assert.strictEqual(result.drafts.length, 2);
		assert.strictEqual(result.drafts[0].id, "draft-1");
		assert.strictEqual(result.drafts[0].subject, "Draft One");
	});

	test("updateDraft() should PATCH a draft", async () => {
		let sentBody = null;
		globalThis.fetch = async (url, opts) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			if (url.includes("/messages/drafts/draft-1") && opts.method === "PATCH") {
				sentBody = JSON.parse(opts.body);
				return { ok: true };
			}
			return { ok: false, status: 404 };
		};

		const provider = new GraphProvider({
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
			tenantId: "tenant",
		});

		const result = await provider.updateDraft("draft-1", {
			subject: "Updated Draft",
			body: "Updated content",
		});

		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.draftId, "draft-1");
		assert.ok(sentBody);
		assert.strictEqual(sentBody.subject, "Updated Draft");
	});

	test("deleteDraft() should DELETE a draft", async () => {
		let deleteUrl = null;
		globalThis.fetch = async (url, opts) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			if (url.includes("/messages/drafts/draft-1")) {
				deleteUrl = url;
				return { ok: true };
			}
			return { ok: false, status: 404 };
		};

		const provider = new GraphProvider({
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
			tenantId: "tenant",
		});

		const result = await provider.deleteDraft("draft-1");

		assert.strictEqual(result.ok, true);
		assert.ok(deleteUrl);
		assert.ok(deleteUrl.includes("method: DELETE"));
	});

	test("organize() should mark messages as read (clean flag)", async () => {
		let patchBodies = [];
		globalThis.fetch = async (url, opts) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			if (url.includes("/messages/msg-1") && opts.method === "PATCH") {
				patchBodies.push(JSON.parse(opts.body));
				return { ok: true };
			}
			return { ok: false, status: 404 };
		};

		const provider = new GraphProvider({
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
			tenantId: "tenant",
		});

		const result = await provider.organize({
			messageIds: ["msg-1"],
			action: "markRead",
		});

		assert.strictEqual(result.ok, true);
		assert.strictEqual(patchBodies.length, 1);
		assert.strictEqual(patchBodies[0].Flag.flagStatus, "clean");
	});

	test("organize() should mark messages as unread (flagged)", async () => {
		let patchBodies = [];
		globalThis.fetch = async (url, opts) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			if (url.includes("/messages/msg-1") && opts.method === "PATCH") {
				patchBodies.push(JSON.parse(opts.body));
				return { ok: true };
			}
			return { ok: false, status: 404 };
		};

		const provider = new GraphProvider({
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
			tenantId: "tenant",
		});

		const result = await provider.organize({
			messageIds: ["msg-1"],
			action: "markUnread",
		});

		assert.strictEqual(result.ok, true);
		assert.strictEqual(patchBodies.length, 1);
		assert.strictEqual(patchBodies[0].Flag.flagStatus, "flagged");
	});

	test("organize() should archive by moving to deletedmessages", async () => {
		let postBodies = [];
		globalThis.fetch = async (url, opts) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			if (url.includes("/messages/msg-1/move") && opts.method === "POST") {
				postBodies.push(JSON.parse(opts.body));
				return { ok: true };
			}
			return { ok: false, status: 404 };
		};

		const provider = new GraphProvider({
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
			tenantId: "tenant",
		});

		const result = await provider.organize({
			messageIds: ["msg-1"],
			action: "archive",
		});

		assert.strictEqual(result.ok, true);
		assert.strictEqual(postBodies.length, 1);
		assert.strictEqual(postBodies[0].destinationId, "deletedmessages");
	});

	test("organize() should handle multiple messageIds", async () => {
		let patchCount = 0;
		globalThis.fetch = async (url, opts) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			if (url.includes("/messages/") && opts.method === "PATCH") {
				patchCount++;
				return { ok: true };
			}
			return { ok: false, status: 404 };
		};

		const provider = new GraphProvider({
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
			tenantId: "tenant",
		});

		await provider.organize({
			messageIds: ["msg-1", "msg-2", "msg-3"],
			action: "markRead",
		});

		assert.strictEqual(patchCount, 3);
	});

	test("organize() should handle single messageId as string", async () => {
		let patchCount = 0;
		globalThis.fetch = async (url, opts) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			if (url.includes("/messages/") && opts.method === "PATCH") {
				patchCount++;
				return { ok: true };
			}
			return { ok: false, status: 404 };
		};

		const provider = new GraphProvider({
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
			tenantId: "tenant",
		});

		const result = await provider.organize({
			messageIds: "msg-1",
			action: "markRead",
		});

		assert.strictEqual(result.ok, true);
		assert.strictEqual(patchCount, 1);
	});

	test("should use cached accessToken when provided", async () => {
		let tokenRequests = 0;
		globalThis.fetch = async (url, opts) => {
			if (url.includes("/token")) {
				tokenRequests++;
				return { ok: true, json: async () => ({ access_token: "new-token" }) };
			}
			if (url.includes("/sendMail")) {
				assert.ok(opts.headers.Authorization.startsWith("Bearer "));
				assert.strictEqual(opts.headers.Authorization, "Bearer pre-cached-token");
				return { ok: true, json: async () => ({ id: "sent-1" }) };
			}
			return { ok: false, status: 404 };
		};

		const provider = new GraphProvider({
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
			tenantId: "tenant",
			accessToken: "pre-cached-token",
		});

		await provider.send({
			to: ["recipient@example.com"],
			subject: "Test",
			body: "Body",
		});

		assert.strictEqual(tokenRequests, 0);
	});

	test("should refresh token when no accessToken provided", async () => {
		let tokenRequests = 0;
		let sentBody = null;
		globalThis.fetch = async (url, opts) => {
			if (url.includes("/token")) {
				tokenRequests++;
				assert.strictEqual(opts.method, "POST");
				const body = new URLSearchParams(opts.body);
				assert.strictEqual(body.get("grant_type"), "refresh_token");
				assert.strictEqual(body.get("client_id"), "id");
				assert.strictEqual(body.get("scope"), "https://graph.microsoft.com/.default");
				return { ok: true, json: async () => ({ access_token: "refreshed-token" }) };
			}
			if (url.includes("/sendMail")) {
				sentBody = JSON.parse(opts.body);
				return { ok: true, json: async () => ({ id: "sent-1" }) };
			}
			return { ok: false, status: 404 };
		};

		const provider = new GraphProvider({
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "my-refresh",
			tenantId: "tenant",
		});

		const result = await provider.send({
			to: ["recipient@example.com"],
			subject: "Test",
			body: "Body",
		});

		assert.strictEqual(result.ok, true);
		assert.strictEqual(tokenRequests, 1);
		assert.ok(sentBody);
	});

	test("normalizeMessage() should handle Graph message format", async () => {
		globalThis.fetch = async (url, opts) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			if (url.includes("/messages?")) {
				return {
					ok: true,
					json: async () => ({
						value: [
							{
								id: "graph-msg-normalize",
								subject: "Normalize Test",
								from: { emailAddress: { address: "from@example.com" } },
								toRecipients: [{ emailAddress: { address: "to@example.com" } }],
								body: { contentType: "HTML", content: "<p>HTML body</p>" },
								receivedDateTime: "2024-06-15T12:00:00Z",
							},
						],
					}),
				};
			}
			return { ok: false, status: 404 };
		};

		const provider = new GraphProvider({
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
			tenantId: "tenant",
		});

		const result = await provider.read({});

		assert.strictEqual(result.ok, true);
		const msg = result.messages[0];
		assert.strictEqual(msg.id, "graph-msg-normalize");
		assert.strictEqual(msg.subject, "Normalize Test");
		assert.strictEqual(msg.body, "<p>HTML body</p>");
		assert.strictEqual(msg.from, "from@example.com");
		assert.strictEqual(msg.to, "to@example.com");
	});

	test("read() should handle empty message list", async () => {
		globalThis.fetch = async (url, opts) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			return { ok: true, json: async () => ({ value: [] }) };
		};

		const provider = new GraphProvider({
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
			tenantId: "tenant",
		});

		const result = await provider.read({});

		assert.strictEqual(result.ok, true);
		assert.ok(result.messages);
		assert.strictEqual(result.messages.length, 0);
	});

	test("read() should use custom folder", async () => {
		const fetchCalls = [];
		globalThis.fetch = async (url, opts) => {
			fetchCalls.push(url);
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			return { ok: true, json: async () => ({ value: [] }) };
		};

		const provider = new GraphProvider({
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
			tenantId: "tenant",
		});

		await provider.read({ folder: "sentitems" });

		const messageUrl = fetchCalls.find((u) => u.includes("/sentitems/"));
		assert.ok(messageUrl);
	});

	test("Graph API error should return structured error", async () => {
		globalThis.fetch = async (url, opts) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			return {
				ok: false,
				status: 401,
				text: async () => "Unauthorized",
			};
		};

		const provider = new GraphProvider({
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
			tenantId: "tenant",
		});

		const result = await provider.read({});

		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("401"));
	});

	test("token refresh failure should propagate error", async () => {
		globalThis.fetch = async (url, opts) => {
			if (url.includes("/token")) {
				return {
					ok: false,
					status: 400,
					text: async () => "Invalid grant",
				};
			}
			return { ok: false, status: 404 };
		};

		const provider = new GraphProvider({
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "bad-token",
			tenantId: "tenant",
		});

		const result = await provider.send({
			to: ["recipient@example.com"],
			subject: "Test",
			body: "Body",
		});

		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("token refresh failed"));
	});

	test("GraphProvider should use custom userId", async () => {
		const fetchCalls = [];
		globalThis.fetch = async (url, opts) => {
			fetchCalls.push(url);
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			return { ok: true, json: async () => ({ value: [] }) };
		};

		const provider = new GraphProvider({
			clientId: "id",
			clientSecret: "secret",
			refreshToken: "token",
			tenantId: "tenant",
			userId: "custom@example.com",
		});

		await provider.read({});

		const messageUrl = fetchCalls.find((u) => u.includes("/custom@example.com/"));
		assert.ok(messageUrl);
	});
});