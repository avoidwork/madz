/**
 * Unit tests for the JIRA tool.
 * @see {@link src/tools/jira/index.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { jiraImpl, JiraInputSchema } from "../../../src/tools/jira/index.js";

const noSleep = async () => {};

/**
 * Build a fetch Response-like object.
 * @param {object} [init]
 * @returns {Response}
 */
function res({ status = 200, headers = {}, body = "{}" } = {}) {
	return new Response(status === 204 || status === 304 ? null : body, { status, headers });
}

/**
 * Create a fetch stub that replays responses and records calls.
 * @param {Array<Response|Error|Function>} queue
 * @returns {{ fetch: Function, calls: Array<{ url: string, options: object }> }}
 */
function stub(queue) {
	const calls = [];
	const fetch = async (url, options) => {
		calls.push({ url, options });
		const next = queue.length > 1 ? queue.shift() : queue[0];
		if (next instanceof Error) throw next;
		return typeof next === "function" ? next(url, options) : next.clone();
	};
	return { fetch, calls };
}

const base = {
	sleep: noSleep,
	policy: { rateLimit: 0, timeout: 30000 },
};
const withUrl = (opts = {}) => ({
	...base,
	...opts,
	policy: { ...base.policy, baseUrl: "https://jira.example.com" },
});

describe("jira input validation", () => {
	it("rejects an unknown action", async () => {
		const r = await jiraImpl({ action: "frobnicate", key: "PROJ-1" }, withUrl());
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /Invalid input/);
	});

	it("rejects unknown fields via strict schema", async () => {
		const r = await jiraImpl({ action: "get", key: "PROJ-1", bogus: 1 }, withUrl());
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /Invalid input/);
	});

	it("rejects maxResults above 100", async () => {
		const r = await jiraImpl({ action: "search", jql: "project = X", maxResults: 500 }, withUrl());
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /Invalid input/);
	});

	it("requires a base URL", async () => {
		const r = await jiraImpl(
			{ action: "get", key: "PROJ-1" },
			{ ...base, policy: { rateLimit: 0, timeout: 30000 } },
		);
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /No JIRA base URL/);
	});
});

describe("jira actions", () => {
	it("search posts JQL to /search", async () => {
		const { fetch, calls } = stub([
			res({ body: JSON.stringify({ issues: [], startAt: 0, total: 0 }) }),
		]);
		const r = await jiraImpl(
			{ action: "search", jql: "project = PROJ", maxResults: 50 },
			withUrl({ fetch }),
		);
		assert.strictEqual(r.ok, true);
		assert.strictEqual(r.status, 200);
		assert.strictEqual(r.data.total, 0);
		assert.match(calls[0].url, /\/rest\/api\/2\/search$/);
		assert.strictEqual(calls[0].options.method, "POST");
	});

	it("get fetches an issue by key", async () => {
		const { fetch, calls } = stub([res({ body: JSON.stringify({ key: "PROJ-1", id: "10001" }) })]);
		const r = await jiraImpl({ action: "get", key: "PROJ-1" }, withUrl({ fetch }));
		assert.strictEqual(r.ok, true);
		assert.strictEqual(r.data.key, "PROJ-1");
		assert.match(calls[0].url, /\/rest\/api\/2\/issue\/PROJ-1$/);
		assert.strictEqual(calls[0].options.method, "GET");
	});

	it("create posts fields", async () => {
		const { fetch, calls } = stub([res({ body: JSON.stringify({ key: "PROJ-2", id: "10002" }) })]);
		const r = await jiraImpl(
			{ action: "create", project: "PROJ", issueType: "Bug", summary: "boom" },
			withUrl({ fetch }),
		);
		assert.strictEqual(r.ok, true);
		assert.strictEqual(r.data.key, "PROJ-2");
		assert.strictEqual(calls[0].options.method, "POST");
		const sent = JSON.parse(calls[0].options.body);
		assert.deepStrictEqual(sent.fields.project, { key: "PROJ" });
		assert.deepStrictEqual(sent.fields.issuetype, { name: "Bug" });
	});

	it("update puts fields", async () => {
		const { fetch, calls } = stub([res({ body: JSON.stringify({ key: "PROJ-1" }) })]);
		const r = await jiraImpl(
			{ action: "update", key: "PROJ-1", updates: { summary: "fixed" } },
			withUrl({ fetch }),
		);
		assert.strictEqual(r.ok, true);
		assert.strictEqual(calls[0].options.method, "PUT");
	});

	it("delete removes an issue", async () => {
		const { fetch, calls } = stub([res({ status: 204 })]);
		const r = await jiraImpl({ action: "delete", key: "PROJ-1" }, withUrl({ fetch }));
		assert.strictEqual(r.ok, true);
		assert.strictEqual(calls[0].options.method, "DELETE");
	});

	it("transition posts a transition id", async () => {
		const { fetch, calls } = stub([res({ body: "{}" })]);
		const r = await jiraImpl(
			{ action: "transition", key: "PROJ-1", transitionId: 31 },
			withUrl({ fetch }),
		);
		assert.strictEqual(r.ok, true);
		const sent = JSON.parse(calls[0].options.body);
		assert.strictEqual(sent.transition.id, "31");
	});

	it("comment posts a comment body", async () => {
		const { fetch, calls } = stub([res({ body: JSON.stringify({ id: "1" }) })]);
		const r = await jiraImpl(
			{ action: "comment", key: "PROJ-1", comment: "hi" },
			withUrl({ fetch }),
		);
		assert.strictEqual(r.ok, true);
		const sent = JSON.parse(calls[0].options.body);
		assert.strictEqual(sent.body, "hi");
	});

	it("assign puts a username", async () => {
		const { fetch, calls } = stub([res({ body: "{}" })]);
		const r = await jiraImpl(
			{ action: "assign", key: "PROJ-1", assignee: "jdoe" },
			withUrl({ fetch }),
		);
		assert.strictEqual(r.ok, true);
		const sent = JSON.parse(calls[0].options.body);
		assert.strictEqual(sent.name, "jdoe");
	});

	it("metadata lookups hit the right endpoints", async () => {
		for (const [action, path] of [
			["projects", "/project"],
			["issueTypes", "/issuetype"],
			["statuses", "/status"],
			["fields", "/field"],
		]) {
			const { fetch, calls } = stub([res({ body: "[]" })]);
			const r = await jiraImpl({ action }, withUrl({ fetch }));
			assert.strictEqual(r.ok, true, action);
			assert.match(calls[0].url, new RegExp(`/rest/api/2${path}$`), action);
		}
	});

	it("users search passes a query", async () => {
		const { fetch, calls } = stub([res({ body: "[]" })]);
		const r = await jiraImpl({ action: "users", query: "jason" }, withUrl({ fetch }));
		assert.strictEqual(r.ok, true);
		assert.match(calls[0].url, /username=jason/);
	});
});

describe("jira error mapping", () => {
	it("maps 400 invalid JQL", async () => {
		const { fetch } = stub([
			res({ status: 400, body: JSON.stringify({ errorMessages: ["bad JQL"] }) }),
		]);
		const r = await jiraImpl({ action: "search", jql: "garbage" }, withUrl({ fetch }));
		assert.strictEqual(r.ok, false);
		assert.strictEqual(r.status, 400);
		assert.match(r.error, /HTTP 400/);
	});

	it("maps 404 unknown issue", async () => {
		const { fetch } = stub([res({ status: 404, body: "{}" })]);
		const r = await jiraImpl({ action: "get", key: "NOPE-1" }, withUrl({ fetch }));
		assert.strictEqual(r.ok, false);
		assert.strictEqual(r.status, 404);
	});

	it("maps 401 bad credentials", async () => {
		const { fetch } = stub([res({ status: 401, body: "{}" })]);
		const r = await jiraImpl({ action: "get", key: "PROJ-1" }, withUrl({ fetch }));
		assert.strictEqual(r.ok, false);
		assert.strictEqual(r.status, 401);
	});
});

describe("jira auth", () => {
	it("sends the personal access token as a bearer token", async () => {
		const { fetch, calls } = stub([res({ body: "{}" })]);
		const policy = {
			baseUrl: "https://jira.example.com",
			token: "pat123",
			rateLimit: 0,
			timeout: 30000,
		};
		await jiraImpl({ action: "get", key: "PROJ-1" }, { ...base, policy, fetch });
		const header = calls[0].options.headers.Authorization ?? calls[0].options.headers.authorization;
		assert.strictEqual(header, "Bearer pat123");
	});

	it("sends no Authorization header without a token", async () => {
		const { fetch, calls } = stub([res({ body: "{}" })]);
		await jiraImpl({ action: "get", key: "PROJ-1" }, withUrl({ fetch }));
		const headers = calls[0].options.headers ?? {};
		assert.strictEqual(headers.Authorization ?? headers.authorization, undefined);
	});

	it("rejects a credential field in input", async () => {
		const r = await jiraImpl({ action: "get", key: "PROJ-1", credential: "x" }, withUrl());
		assert.strictEqual(r.ok, false);
	});
});

describe("jira schema", () => {
	it("parses a valid search input", () => {
		const r = JiraInputSchema.safeParse({ action: "search", jql: "project = X", maxResults: 10 });
		assert.strictEqual(r.success, true);
	});
});
