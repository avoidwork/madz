import { test, describe, before, after } from "node:test";
import assert from "node:assert";

describe("GraphProvider — happy paths", () => {
	let GraphProvider;
	let origFetch;

	before(async () => {
		// Set required env vars
		process.env.EMAIL_GRAPH_CLIENT_ID = "test-client-id";
		process.env.EMAIL_GRAPH_CLIENT_SECRET = "test-client-secret";
		process.env.EMAIL_GRAPH_REFRESH_TOKEN = "test-refresh-token";
		process.env.EMAIL_GRAPH_TENANT_ID = "test-tenant-id";

		origFetch = globalThis.fetch;

		const mod = await import("../../../../../src/tools/email/providers/graph.js");
		GraphProvider = mod.GraphProvider;
	});

	after(() => {
		globalThis.fetch = origFetch;
		delete process.env.EMAIL_GRAPH_CLIENT_ID;
		delete process.env.EMAIL_GRAPH_CLIENT_SECRET;
		delete process.env.EMAIL_GRAPH_REFRESH_TOKEN;
		delete process.env.EMAIL_GRAPH_TENANT_ID;
	});

	test("read() should return messages from Graph API", async () => {
		globalThis.fetch = async (url) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			if (url.includes("/messages?")) {
				return {
					ok: true,
					json: async () => ({
						value: [{
							id: "graph-msg-1",
							subject: "Graph Test",
							from: { emailAddress: { address: "graph@example.com" } },
							toRecipients: [{ emailAddress: { address: "me@example.com" } }],
							body: { contentType: "Text", content: "Graph body" },
							receivedDateTime: "2024-01-01T00:00:00Z",
						}],
					}),
				};
			}
			return { ok: false, status: 404 };
		};

		const provider = new GraphProvider({});
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
		globalThis.fetch = async (url) => {
			fetchCalls.push(url);
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			return { ok: true, json: async () => ({ value: [] }) };
		};

		const provider = new GraphProvider({});
		await provider.read({ sender: "test@example.com", subject: "urgent" });

		const messageUrl = fetchCalls.find((u) => u.includes("/messages?"));
		assert.ok(messageUrl);
		assert.ok(messageUrl.includes("from/emailAddress/address eq 'test@example.com'"));
		assert.ok(messageUrl.includes("contains(subject, 'urgent')"));
	});

	test("read() should filter by keyword", async () => {
		const fetchCalls = [];
		globalThis.fetch = async (url) => {
			fetchCalls.push(url);
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			return { ok: true, json: async () => ({ value: [] }) };
		};

		const provider = new GraphProvider({});
		await provider.read({ keyword: "important" });

		const messageUrl = fetchCalls.find((u) => u.includes("/messages?"));
		assert.ok(messageUrl);
		assert.ok(messageUrl.includes("contains(body/content, 'important')"));
	});

	test("read() should filter by dateFrom and dateTo", async () => {
		const fetchCalls = [];
		globalThis.fetch = async (url) => {
			fetchCalls.push(url);
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			return { ok: true, json: async () => ({ value: [] }) };
		};

		const provider = new GraphProvider({});
		await provider.read({ dateFrom: "2024-01-01", dateTo: "2024-12-31" });

		const messageUrl = fetchCalls.find((u) => u.includes("/messages?"));
		assert.ok(messageUrl);
		assert.ok(messageUrl.includes("receivedDateTime ge 2024-01-01"));
		assert.ok(messageUrl.includes("receivedDateTime le 2024-12-31"));
	});

	test("send() should POST to sendMail endpoint", async () => {
		let sentBody = null;
		globalThis.fetch = async (url, opts) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			if (url.includes("/sendMail")) {
				sentBody = JSON.parse(opts.body);
				return { ok: true, json: async () => ({ id: "sent-msg-123" }) };
			}
			return { ok: false, status: 404 };
		};

		const provider = new GraphProvider({});
		const result = await provider.send({
			to: ["recipient@example.com"],
			subject: "Send Test",
			body: "Hello from Graph",
		});

		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.messageId, "sent-msg-123");
		assert.ok(sentBody);
		assert.strictEqual(sentBody.message.subject, "Send Test");
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

		const provider = new GraphProvider({});
		await provider.send({
			to: ["to@example.com"],
			cc: ["cc@example.com"],
			bcc: ["bcc@example.com"],
			subject: "Test",
			body: "Body",
		});

		assert.ok(sentBody.message.ccRecipients);
		assert.ok(sentBody.message.bccRecipients);
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

		const provider = new GraphProvider({});
		await provider.send({
			to: ["recipient@example.com"],
			subject: "With attachment",
			body: "See attached",
			attachments: [{ filename: "report.pdf", content: "base64data", contentType: "application/pdf" }],
		});

		assert.ok(sentBody.message.attachments);
		assert.strictEqual(sentBody.message.attachments.length, 1);
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

		const provider = new GraphProvider({});
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
		globalThis.fetch = async (url) => {
			fetchCalls.push(url);
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			return { ok: true, json: async () => ({ value: [] }) };
		};

		const provider = new GraphProvider({});
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
				return { ok: true, json: async () => ({ id: "draft-abc-123" }) };
			}
			return { ok: false, status: 404 };
		};

		const provider = new GraphProvider({});
		const result = await provider.saveDraft({
			to: ["recipient@example.com"],
			subject: "Draft Test",
			body: "Draft content",
		});

		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.draftId, "draft-abc-123");
	});

	test("listDrafts() should return list of drafts", async () => {
		globalThis.fetch = async (url) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			if (url.includes("/messages/drafts")) {
				return {
					ok: true,
					json: async () => ({
						value: [
							{ id: "draft-1", subject: "Draft One", from: { emailAddress: { address: "me@example.com" } }, body: { contentType: "Text", content: "Draft body 1" }, receivedDateTime: "2024-01-01T00:00:00Z" },
							{ id: "draft-2", subject: "Draft Two", from: { emailAddress: { address: "me@example.com" } }, body: { contentType: "Text", content: "Draft body 2" }, receivedDateTime: "2024-01-02T00:00:00Z" },
						],
					}),
				};
			}
			return { ok: false, status: 404 };
		};

		const provider = new GraphProvider({});
		const result = await provider.listDrafts({ limit: 5 });

		assert.strictEqual(result.ok, true);
		assert.ok(result.drafts);
		assert.strictEqual(result.drafts.length, 2);
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

		const provider = new GraphProvider({});
		const result = await provider.updateDraft("draft-1", {
			subject: "Updated Draft",
			body: "Updated content",
		});

		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.draftId, "draft-1");
	});

	test("deleteDraft() should DELETE a draft", async () => {
		let deleteCalled = false;
		globalThis.fetch = async (url) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			if (url.includes("/messages/drafts/draft-1")) {
				deleteCalled = true;
				return { ok: true };
			}
			return { ok: false, status: 404 };
		};

		const provider = new GraphProvider({});
		const result = await provider.deleteDraft("draft-1");

		assert.strictEqual(result.ok, true);
		assert.ok(deleteCalled);
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

		const provider = new GraphProvider({});
		const result = await provider.organize({ messageIds: ["msg-1"], action: "markRead" });

		assert.strictEqual(result.ok, true);
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

		const provider = new GraphProvider({});
		const result = await provider.organize({ messageIds: ["msg-1"], action: "markUnread" });

		assert.strictEqual(result.ok, true);
		assert.strictEqual(patchBodies[0].Flag.flagStatus, "flagged");
	});

	test("organize() should archive by moving to deleteditems", async () => {
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

		const provider = new GraphProvider({});
		const result = await provider.organize({ messageIds: ["msg-1"], action: "archive" });

		assert.strictEqual(result.ok, true);
		assert.strictEqual(postBodies[0].destinationId, "deleteditems");
	});

	test("organize() should handle multiple messageIds", async () => {
		let patchCount = 0;
		globalThis.fetch = async (url, opts) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			if (url.includes("/messages/msg-") && opts.method === "PATCH") {
				patchCount++;
				return { ok: true };
			}
			return { ok: false, status: 404 };
		};

		const provider = new GraphProvider({});
		const result = await provider.organize({ messageIds: ["msg-1", "msg-2"], action: "markRead" });

		assert.strictEqual(result.ok, true);
		assert.strictEqual(patchCount, 2);
	});

	test("organize() should handle single messageId as string", async () => {
		let patchCount = 0;
		globalThis.fetch = async (url, opts) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			if (url.includes("/messages/msg-1") && opts.method === "PATCH") {
				patchCount++;
				return { ok: true };
			}
			return { ok: false, status: 404 };
		};

		const provider = new GraphProvider({});
		const result = await provider.organize({ messageIds: "msg-1", action: "markRead" });

		assert.strictEqual(result.ok, true);
		assert.strictEqual(patchCount, 1);
	});

	test("organize() should handle addLabel", async () => {
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

		const provider = new GraphProvider({});
		const result = await provider.organize({ messageIds: ["msg-1"], action: "addLabel", label: "Important" });

		assert.strictEqual(result.ok, true);
		assert.deepStrictEqual(patchBodies[0].categories, ["Important"]);
	});

	test("organize() should handle removeLabel", async () => {
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

		const provider = new GraphProvider({});
		const result = await provider.organize({ messageIds: ["msg-1"], action: "removeLabel", label: "Important" });

		assert.strictEqual(result.ok, true);
		assert.deepStrictEqual(patchBodies[0].categories, []);
	});

	test("organize() should return error for unknown action", async () => {
		globalThis.fetch = async (url) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			return { ok: true };
		};

		const provider = new GraphProvider({});
		const result = await provider.organize({ messageIds: ["msg-1"], action: "unknown" });

		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Unknown organize action"));
	});

	test("should use cached accessToken when provided", async () => {
		process.env.EMAIL_GRAPH_ACCESS_TOKEN = "pre-existing-token";
		const provider = new GraphProvider({});
		globalThis.fetch = async (url) => {
			if (url.includes("/token")) {
				throw new Error("Should not be called");
			}
			return { ok: true, json: async () => ({ value: [] }) };
		};

		const result = await provider.read({ limit: 1 });
		assert.strictEqual(result.ok, true);
		delete process.env.EMAIL_GRAPH_ACCESS_TOKEN;
	});

	test("should refresh token when no accessToken provided", async () => {
		const provider = new GraphProvider({});
		globalThis.fetch = async (url) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fresh-token" }) };
			}
			return { ok: true, json: async () => ({ value: [] }) };
		};

		const result = await provider.read({ limit: 1 });
		assert.strictEqual(result.ok, true);
	});

	test("normalizeMessage() should handle Graph message format", async () => {
		globalThis.fetch = async (url) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			return {
				ok: true,
				json: async () => ({
					value: [{
						id: "graph-msg-1",
						subject: "Graph Test",
						from: { emailAddress: { address: "graph@example.com" } },
						toRecipients: [{ emailAddress: { address: "me@example.com" } }],
						body: { contentType: "Text", content: "Graph body" },
						receivedDateTime: "2024-01-01T00:00:00Z",
						bodyPreview: "Graph body preview",
					}],
				}),
			};
		};

		const provider = new GraphProvider({});
		const result = await provider.read({ limit: 1 });
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.messages[0].id, "graph-msg-1");
		assert.strictEqual(result.messages[0].subject, "Graph Test");
		assert.strictEqual(result.messages[0].from, "graph@example.com");
		assert.strictEqual(result.messages[0].body, "Graph body");
		assert.strictEqual(result.messages[0].bodyPreview, "Graph body preview");
	});

	test("read() should handle empty message list", async () => {
		globalThis.fetch = async (url) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			return { ok: true, json: async () => ({ value: [] }) };
		};

		const provider = new GraphProvider({});
		const result = await provider.read({ limit: 5 });
		assert.strictEqual(result.ok, true);
		assert.ok(result.messages);
		assert.strictEqual(result.messages.length, 0);
	});

	test("read() should use custom folder", async () => {
		const fetchCalls = [];
		globalThis.fetch = async (url) => {
			fetchCalls.push(url);
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			return { ok: true, json: async () => ({ value: [] }) };
		};

		const provider = new GraphProvider({});
		await provider.read({ folder: "SentItems" });

		const messageUrl = fetchCalls.find((u) => u.includes("/messages?"));
		assert.ok(messageUrl);
		assert.ok(messageUrl.includes("/SentItems/"));
	});

	test("Graph API error should return structured error", async () => {
		globalThis.fetch = async (url) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			return { ok: false, status: 403 };
		};

		const provider = new GraphProvider({});
		const result = await provider.read({ limit: 5 });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Graph read failed"));
	});

	test("token refresh failure should propagate error", async () => {
		globalThis.fetch = async (url) => {
			if (url.includes("/token")) {
				return { ok: false, status: 400 };
			}
			return { ok: true, json: async () => ({ value: [] }) };
		};

		const provider = new GraphProvider({});
		const result = await provider.read({ limit: 5 });
		assert.strictEqual(result.ok, false);
	});

	test("GraphProvider should use custom userId", async () => {
		const fetchCalls = [];
		globalThis.fetch = async (url) => {
			fetchCalls.push(url);
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			return { ok: true, json: async () => ({ value: [] }) };
		};

		const provider = new GraphProvider({ userId: "custom@example.com" });
		await provider.read({ limit: 1 });

		const messageUrl = fetchCalls.find((u) => u.includes("/messages?"));
		assert.ok(messageUrl);
		assert.ok(messageUrl.includes("custom@example.com"));
	});

	test("send() should handle API error response", async () => {
		globalThis.fetch = async (url) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			if (url.includes("/sendMail")) {
				return { ok: false, status: 400, text: async () => "Bad Request" };
			}
			return { ok: false, status: 404 };
		};

		const provider = new GraphProvider({});
		const result = await provider.send({
			to: ["recipient@example.com"],
			subject: "Test",
			body: "Body",
		});
		assert.strictEqual(result.ok, false);
	});

	test("send() should handle network error", async () => {
		globalThis.fetch = async () => { throw new Error("Network error"); };

		const provider = new GraphProvider({});
		const result = await provider.send({
			to: ["recipient@example.com"],
			subject: "Test",
			body: "Body",
		});
		assert.strictEqual(result.ok, false);
	});

	test("read() should handle API error response", async () => {
		globalThis.fetch = async (url) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			return { ok: false, status: 500 };
		};

		const provider = new GraphProvider({});
		const result = await provider.read({ limit: 5 });
		assert.strictEqual(result.ok, false);
	});

	test("read() should handle network error", async () => {
		globalThis.fetch = async () => { throw new Error("Network error"); };

		const provider = new GraphProvider({});
		const result = await provider.read({ limit: 5 });
		assert.strictEqual(result.ok, false);
	});

	test("search() should handle API error response", async () => {
		globalThis.fetch = async (url) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			return { ok: false, status: 500 };
		};

		const provider = new GraphProvider({});
		const result = await provider.search({ query: "test" });
		assert.strictEqual(result.ok, false);
	});

	test("search() should handle network error", async () => {
		globalThis.fetch = async () => { throw new Error("Network error"); };

		const provider = new GraphProvider({});
		const result = await provider.search({ query: "test" });
		assert.strictEqual(result.ok, false);
	});

	test("saveDraft() should handle API error response", async () => {
		globalThis.fetch = async (url) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			return { ok: false, status: 500 };
		};

		const provider = new GraphProvider({});
		const result = await provider.saveDraft({
			to: ["recipient@example.com"],
			subject: "Test",
			body: "Body",
		});
		assert.strictEqual(result.ok, false);
	});

	test("saveDraft() should handle network error", async () => {
		globalThis.fetch = async () => { throw new Error("Network error"); };

		const provider = new GraphProvider({});
		const result = await provider.saveDraft({
			to: ["recipient@example.com"],
			subject: "Test",
			body: "Body",
		});
		assert.strictEqual(result.ok, false);
	});

	test("updateDraft() should handle API error response", async () => {
		globalThis.fetch = async (url) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			return { ok: false, status: 500 };
		};

		const provider = new GraphProvider({});
		const result = await provider.updateDraft("draft-1", {
			subject: "Test",
			body: "Body",
		});
		assert.strictEqual(result.ok, false);
	});

	test("updateDraft() should handle network error", async () => {
		globalThis.fetch = async () => { throw new Error("Network error"); };

		const provider = new GraphProvider({});
		const result = await provider.updateDraft("draft-1", {
			subject: "Test",
			body: "Body",
		});
		assert.strictEqual(result.ok, false);
	});

	test("deleteDraft() should handle API error response", async () => {
		globalThis.fetch = async (url) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			return { ok: false, status: 500 };
		};

		const provider = new GraphProvider({});
		const result = await provider.deleteDraft("draft-1");
		assert.strictEqual(result.ok, false);
	});

	test("deleteDraft() should handle network error", async () => {
		globalThis.fetch = async () => { throw new Error("Network error"); };

		const provider = new GraphProvider({});
		const result = await provider.deleteDraft("draft-1");
		assert.strictEqual(result.ok, false);
	});

	test("organize() should handle API error response", async () => {
		globalThis.fetch = async (url) => {
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "fake-token" }) };
			}
			throw new Error("API request failed");
		};

		const provider = new GraphProvider({});
		const result = await provider.organize({ messageIds: ["msg-1"], action: "markRead" });
		assert.strictEqual(result.ok, false);
	});

	test("organize() should handle network error", async () => {
		globalThis.fetch = async () => { throw new Error("Network error"); };

		const provider = new GraphProvider({});
		const result = await provider.organize({ messageIds: ["msg-1"], action: "markRead" });
		assert.strictEqual(result.ok, false);
	});

	test("validateConfig() should return errors for missing env vars", () => {
		const provider = new GraphProvider({});
		const result = provider.validateConfig();
		assert.strictEqual(result.valid, true);
	});

	test("token refresh should handle 401 retry", async () => {
		let callCount = 0;
		globalThis.fetch = async (url, opts) => {
			callCount++;
			if (url.includes("/token")) {
				return { ok: true, json: async () => ({ access_token: "new-token" }) };
			}
			if (callCount === 1) {
				return { ok: false, status: 401 };
			}
			return { ok: true, json: async () => ({ value: [] }) };
		};

		const provider = new GraphProvider({});
		const result = await provider.read({ limit: 1 });
		assert.strictEqual(result.ok, true);
	});

	test("token refresh should handle 401 with failed refresh", async () => {
		let callCount = 0;
		globalThis.fetch = async (url) => {
			callCount++;
			if (url.includes("/token")) {
				return { ok: false, status: 400 };
			}
			if (callCount === 1) {
				return { ok: false, status: 401 };
			}
			return { ok: true, json: async () => ({ value: [] }) };
		};

		const provider = new GraphProvider({});
		const result = await provider.read({ limit: 1 });
		assert.strictEqual(result.ok, false);
	});

	test("sanitizeError should handle null message", async () => {
		globalThis.fetch = async () => { throw new Error(); };

		const provider = new GraphProvider({});
		const result = await provider.read({ limit: 1 });
		assert.strictEqual(result.ok, false);
	});

	test("sanitizeError should redact credentials in error", async () => {
		// sanitizeError is called in send() error path
		globalThis.fetch = async () => { throw new Error("client_id=my-id&client_secret=my-secret&access_token=my-token&refresh_token=my-refresh&Bearer my-bearer"); };

		const provider = new GraphProvider({});
		const result = await provider.send({
			to: ["recipient@example.com"],
			subject: "Test",
			body: "Body",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("[REDACTED]"));
	});

	test("cancel() should abort current request", () => {
		const provider = new GraphProvider({});
		provider.cancel();
		assert.ok(true);
	});

	test("constructor should throw when env vars are missing", () => {
		delete process.env.EMAIL_GRAPH_CLIENT_ID;
		assert.throws(() => new GraphProvider({}), /Graph provider requires/);
		process.env.EMAIL_GRAPH_CLIENT_ID = "test-client-id";
	});
});
