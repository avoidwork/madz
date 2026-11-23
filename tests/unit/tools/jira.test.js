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

	it("create sends components, labels, and priority", async () => {
		const { fetch, calls } = stub([res({ body: JSON.stringify({ key: "PROJ-3", id: "10003" }) })]);
		const r = await jiraImpl(
			{
				action: "create",
				project: "PROJ",
				issueType: "Bug",
				summary: "boom",
				components: ["api", "core"],
				labels: ["regression"],
				priority: "High",
			},
			withUrl({ fetch }),
		);
		assert.strictEqual(r.ok, true);
		const sent = JSON.parse(calls[0].options.body);
		assert.deepStrictEqual(sent.fields.components, [{ name: "api" }, { name: "core" }]);
		assert.deepStrictEqual(sent.fields.labels, ["regression"]);
		assert.deepStrictEqual(sent.fields.priority, { name: "High" });
	});

	it("create merges arbitrary fields from the fields record", async () => {
		const { fetch, calls } = stub([res({ body: JSON.stringify({ key: "PROJ-4", id: "10004" }) })]);
		const r = await jiraImpl(
			{
				action: "create",
				project: "PROJ",
				summary: "boom",
				fields: { customfield_10014: "EPIC-1", environment: "staging" },
			},
			withUrl({ fetch }),
		);
		assert.strictEqual(r.ok, true);
		const sent = JSON.parse(calls[0].options.body);
		assert.strictEqual(sent.fields.customfield_10014, "EPIC-1");
		assert.strictEqual(sent.fields.environment, "staging");
	});

	it("typed inputs take precedence over the fields record", async () => {
		const { fetch, calls } = stub([res({ body: JSON.stringify({ key: "PROJ-5", id: "10005" }) })]);
		const r = await jiraImpl(
			{
				action: "create",
				project: "PROJ",
				summary: "boom",
				priority: "High",
				fields: { priority: { name: "Low" }, customfield_10014: "EPIC-1" },
			},
			withUrl({ fetch }),
		);
		assert.strictEqual(r.ok, true);
		const sent = JSON.parse(calls[0].options.body);
		assert.deepStrictEqual(sent.fields.priority, { name: "High" });
		assert.strictEqual(sent.fields.customfield_10014, "EPIC-1");
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

describe("jira transitions", () => {
	it("lists available transitions for an issue", async () => {
		const body = JSON.stringify({
			transitions: [{ id: "31", name: "Done", to: { name: "Done" } }],
		});
		const { fetch, calls } = stub([res({ body })]);
		const r = await jiraImpl({ action: "transitions", key: "PROJ-1" }, withUrl({ fetch }));
		assert.strictEqual(r.ok, true);
		assert.strictEqual(calls[0].options.method, "GET");
		assert.match(calls[0].url, /\/rest\/api\/2\/issue\/PROJ-1\/transitions$/);
		assert.strictEqual(r.data.transitions[0].id, "31");
	});

	it("requires a key to list transitions", async () => {
		const { fetch, calls } = stub([res({ body: "{}" })]);
		const r = await jiraImpl({ action: "transitions" }, withUrl({ fetch }));
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /key/);
		assert.strictEqual(calls.length, 0);
	});
});

describe("jira transition body", () => {
	it("sends only the transition id by default", async () => {
		const { fetch, calls } = stub([res({ status: 204 })]);
		const r = await jiraImpl(
			{ action: "transition", key: "PROJ-1", transitionId: 31 },
			withUrl({ fetch }),
		);
		assert.strictEqual(r.ok, true);
		assert.deepStrictEqual(JSON.parse(calls[0].options.body), { transition: { id: "31" } });
	});

	it("sends fields and a comment when given", async () => {
		const { fetch, calls } = stub([res({ status: 204 })]);
		await jiraImpl(
			{
				action: "transition",
				key: "PROJ-1",
				transitionId: 31,
				updates: { resolution: { name: "Fixed" } },
				comment: "Fixed in 1.2",
			},
			withUrl({ fetch }),
		);
		assert.deepStrictEqual(JSON.parse(calls[0].options.body), {
			transition: { id: "31" },
			fields: { resolution: { name: "Fixed" } },
			update: { comment: [{ add: { body: "Fixed in 1.2" } }] },
		});
	});

	it("still requires key and transitionId", async () => {
		const { fetch, calls } = stub([res({ status: 204 })]);
		const r = await jiraImpl(
			{ action: "transition", key: "PROJ-1", comment: "x" },
			withUrl({ fetch }),
		);
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /transitionId/);
		assert.strictEqual(calls.length, 0);
	});
});

describe("jira error bodies", () => {
	it("includes errorMessages and field errors from a 400", async () => {
		const body = JSON.stringify({
			errorMessages: ["The value 'x' does not exist for the field 'project'."],
			errors: { summary: "You must specify a summary of the issue." },
		});
		const { fetch } = stub([res({ status: 400, body })]);
		const r = await jiraImpl({ action: "search", jql: "bad" }, withUrl({ fetch }));
		assert.strictEqual(r.ok, false);
		assert.strictEqual(r.status, 400);
		assert.match(r.error, /does not exist for the field 'project'/);
		assert.match(r.error, /summary: You must specify a summary/);
	});

	it("falls back to the HTTP status when the body is not JSON", async () => {
		const { fetch } = stub([res({ status: 502, body: "Bad Gateway" })]);
		const r = await jiraImpl({ action: "get", key: "P-1" }, withUrl({ fetch }));
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /HTTP 502/);
	});
});

describe("jira required fields", () => {
	const cases = [
		[{ action: "get" }, /key/],
		[{ action: "delete" }, /key/],
		[{ action: "update", key: "P-1" }, /updates/],
		[{ action: "transition", key: "P-1" }, /transitionId/],
		[{ action: "comment", key: "P-1" }, /comment/],
		[{ action: "assign", key: "P-1" }, /assignee/],
		[{ action: "create", summary: "x" }, /project/],
		[{ action: "create", project: "P" }, /summary/],
		[{ action: "search" }, /jql/],
		[{ action: "users" }, /query/],
	];
	for (const [input, pattern] of cases) {
		it(`rejects ${JSON.stringify(input)} without sending a request`, async () => {
			const { fetch, calls } = stub([res({ body: "{}" })]);
			const r = await jiraImpl(input, withUrl({ fetch }));
			assert.strictEqual(r.ok, false);
			assert.match(r.error, pattern);
			assert.strictEqual(calls.length, 0);
		});
	}

	it("fills project and assignee for create from config", async () => {
		const { fetch, calls } = stub([res({ body: "{}" })]);
		const policy = {
			...base.policy,
			baseUrl: "https://jira.example.com",
			project: "PROJ",
			assignee: "jdoe",
		};
		const r = await jiraImpl({ action: "create", summary: "x" }, { ...base, policy, fetch });
		assert.strictEqual(r.ok, true);
		const sent = JSON.parse(calls[0].options.body);
		assert.deepStrictEqual(sent.fields.project, { key: "PROJ" });
		assert.deepStrictEqual(sent.fields.assignee, { name: "jdoe" });
	});

	it("searches the configured project when no jql is given", async () => {
		const { fetch, calls } = stub([res({ body: "{}" })]);
		const policy = { ...base.policy, baseUrl: "https://jira.example.com", project: "PROJ" };
		await jiraImpl({ action: "search" }, { ...base, policy, fetch });
		assert.strictEqual(JSON.parse(calls[0].options.body).jql, 'project = "PROJ"');
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

describe("jira remote links", () => {
	it("lists remote links for an issue", async () => {
		const body = JSON.stringify([
			{ id: "1", object: { url: "https://github.com/x", title: "PR" } },
		]);
		const { fetch, calls } = stub([res({ body })]);
		const r = await jiraImpl({ action: "remoteLinks", key: "PROJ-1" }, withUrl({ fetch }));
		assert.strictEqual(r.ok, true);
		assert.strictEqual(calls[0].options.method, "GET");
		assert.match(calls[0].url, /\/rest\/api\/2\/issue\/PROJ-1\/remotelink$/);
		assert.strictEqual(r.data[0].object.title, "PR");
	});

	it("creates a remote link", async () => {
		const body = JSON.stringify({
			id: "2",
			self: "https://jira.example.com/rest/api/2/issue/PROJ-1/remotelink/2",
		});
		const { fetch, calls } = stub([res({ status: 201, body })]);
		const r = await jiraImpl(
			{ action: "remoteLinks", key: "PROJ-1", link: { url: "https://github.com/x", title: "PR" } },
			withUrl({ fetch }),
		);
		assert.strictEqual(r.ok, true);
		assert.strictEqual(r.status, 201);
		assert.strictEqual(calls[0].options.method, "POST");
		assert.match(calls[0].url, /\/rest\/api\/2\/issue\/PROJ-1\/remotelink$/);
		assert.deepStrictEqual(JSON.parse(calls[0].options.body), {
			object: { url: "https://github.com/x", title: "PR" },
		});
	});

	it("creates a remote link with icon and status", async () => {
		const { fetch, calls } = stub([res({ status: 201, body: "{}" })]);
		const r = await jiraImpl(
			{
				action: "remoteLinks",
				key: "PROJ-1",
				link: {
					url: "https://github.com/x",
					title: "PR",
					icon: "https://i.example.com/i.png",
					status: "done",
				},
			},
			withUrl({ fetch }),
		);
		assert.strictEqual(r.ok, true);
		assert.deepStrictEqual(JSON.parse(calls[0].options.body), {
			object: {
				url: "https://github.com/x",
				title: "PR",
				icon: "https://i.example.com/i.png",
				status: "done",
			},
		});
	});

	it("requires a key to list remote links", async () => {
		const { fetch, calls } = stub([res({ body: "{}" })]);
		const r = await jiraImpl({ action: "remoteLinks" }, withUrl({ fetch }));
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /key/);
		assert.strictEqual(calls.length, 0);
	});

	it("rejects a link missing url or title", async () => {
		const { fetch, calls } = stub([res({ body: "{}" })]);
		const r = await jiraImpl(
			{ action: "remoteLinks", key: "PROJ-1", link: { title: "PR" } },
			withUrl({ fetch }),
		);
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /Invalid input/);
		assert.strictEqual(calls.length, 0);
	});
});
