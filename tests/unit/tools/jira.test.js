/**
 * Unit tests for the JIRA tool.
 * @see {@link src/tools/jira/index.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { jiraImpl, resolveJiraCredential, JiraInputSchema } from "../../../src/tools/jira/index.js";

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
	policy: { rateLimit: 0, timeout: 30000, credentials: {} },
};
const withUrl = (opts = {}) => ({
	...base,
	...opts,
	policy: { ...base.policy, baseUrl: "https://example.atlassian.net" },
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
			{ ...base, policy: { rateLimit: 0, timeout: 30000, credentials: {} } },
		);
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /No JIRA base URL/);
	});
});

describe("jira actions", () => {
	it("search posts JQL to /search/jql", async () => {
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
		assert.match(calls[0].url, /\/rest\/api\/3\/search\/jql$/);
		assert.strictEqual(calls[0].options.method, "POST");
	});

	it("get fetches an issue by key", async () => {
		const { fetch, calls } = stub([res({ body: JSON.stringify({ key: "PROJ-1", id: "10001" }) })]);
		const r = await jiraImpl({ action: "get", key: "PROJ-1" }, withUrl({ fetch }));
		assert.strictEqual(r.ok, true);
		assert.strictEqual(r.data.key, "PROJ-1");
		assert.match(calls[0].url, /\/rest\/api\/3\/issue\/PROJ-1$/);
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

	it("assign puts an account id", async () => {
		const { fetch, calls } = stub([res({ body: "{}" })]);
		const r = await jiraImpl(
			{ action: "assign", key: "PROJ-1", assignee: "acc-123" },
			withUrl({ fetch }),
		);
		assert.strictEqual(r.ok, true);
		const sent = JSON.parse(calls[0].options.body);
		assert.strictEqual(sent.accountId, "acc-123");
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
			assert.match(calls[0].url, new RegExp(`/rest/api/3${path}$`), action);
		}
	});

	it("users search passes a query", async () => {
		const { fetch, calls } = stub([res({ body: "[]" })]);
		const r = await jiraImpl({ action: "users", query: "jason" }, withUrl({ fetch }));
		assert.strictEqual(r.ok, true);
		assert.match(calls[0].url, /query=jason/);
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

describe("jira credential resolution", () => {
	it("resolves a basic credential from env", () => {
		const policy = {
			credentials: { jira: { usernameEnv: "JIRA_EMAIL", passwordEnv: "JIRA_TOKEN", hosts: [] } },
		};
		const r = resolveJiraCredential("jira", policy, { JIRA_EMAIL: "a@b.com", JIRA_TOKEN: "tok" });
		assert.strictEqual(r.auth.type, "basic");
		assert.strictEqual(r.auth.username, "a@b.com");
		assert.strictEqual(r.auth.password, "tok");
	});

	it("rejects an unknown credential", () => {
		const r = resolveJiraCredential("nope", { credentials: {} }, {});
		assert.match(r.error, /Unknown credential/);
	});

	it("rejects a missing env var", () => {
		const policy = {
			credentials: { jira: { usernameEnv: "JIRA_EMAIL", passwordEnv: "JIRA_TOKEN", hosts: [] } },
		};
		const r = resolveJiraCredential("jira", policy, {});
		assert.match(r.error, /not configured/);
	});

	it("rejects a host outside the credential allowlist", async () => {
		const { fetch } = stub([res({ body: "{}" })]);
		const policy = {
			baseUrl: "https://evil.example.com",
			rateLimit: 0,
			timeout: 30000,
			credentials: {
				jira: { usernameEnv: "JIRA_EMAIL", passwordEnv: "JIRA_TOKEN", hosts: ["*.atlassian.net"] },
			},
		};
		const r = await jiraImpl(
			{ action: "get", key: "PROJ-1", credential: "jira" },
			{ ...base, policy, fetch, env: { JIRA_EMAIL: "a@b.com", JIRA_TOKEN: "tok" } },
		);
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /not permitted for host/);
	});
});

describe("jira schema", () => {
	it("parses a valid search input", () => {
		const r = JiraInputSchema.safeParse({ action: "search", jql: "project = X", maxResults: 10 });
		assert.strictEqual(r.success, true);
	});
});
