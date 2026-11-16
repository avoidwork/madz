/**
 * Integration tests for the JIRA tool.
 * Exercises the full lifecycle (search → get → create → transition → comment →
 * update → assign → delete) against an in-memory JIRA Data Center REST API v2 mock
 * installed as a `fetch` override.
 * @see {@link src/tools/jira/index.js}
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { jiraImpl } from "../../../src/tools/jira/index.js";

const noSleep = async () => {};

/**
 * A minimal in-memory JIRA Data Center REST API v2 mock.
 * @returns {{ fetch: Function, issues: Map }}
 */
function createJiraMock() {
	const issues = new Map();
	let nextId = 10000;

	const json = (status, body) =>
		new Response(status === 204 ? null : JSON.stringify(body), {
			status,
			headers: { "content-type": "application/json" },
		});

	const fetch = async (url, options = {}) => {
		const u = new URL(url);
		const path = u.pathname;
		const method = options.method || "GET";
		const body = options.body ? JSON.parse(options.body) : undefined;

		// POST /rest/api/2/search
		if (path.endsWith("/search") && method === "POST") {
			const all = [...issues.values()];
			const startAt = body?.startAt ?? 0;
			const maxResults = body?.maxResults ?? 50;
			const page = all.slice(startAt, startAt + maxResults);
			return json(200, { issues: page, startAt, total: all.length, maxResults });
		}

		// POST /rest/api/2/issue
		if (path === "/rest/api/2/issue" && method === "POST") {
			const id = String(nextId++);
			const key = `${body.fields.project.key}-${id}`;
			const issue = { id, key, fields: body.fields };
			issues.set(key, issue);
			return json(201, issue);
		}

		// /rest/api/2/issue/:key
		const m = path.match(/^\/rest\/api\/2\/issue\/([^/]+)$/);
		if (m) {
			const key = decodeURIComponent(m[1]);
			const issue = issues.get(key);
			if (method === "GET") {
				return issue ? json(200, issue) : json(404, { errorMessages: ["Issue does not exist"] });
			}
			if (method === "PUT") {
				if (!issue) return json(404, { errorMessages: ["Issue does not exist"] });
				issue.fields = { ...issue.fields, ...body.fields };
				return json(200, issue);
			}
			if (method === "DELETE") {
				if (!issue) return json(404, { errorMessages: ["Issue does not exist"] });
				issues.delete(key);
				return json(204);
			}
		}

		// /rest/api/2/issue/:key/transitions
		const tm = path.match(/^\/rest\/api\/2\/issue\/([^/]+)\/transitions$/);
		if (tm && method === "POST") {
			const key = decodeURIComponent(tm[1]);
			const issue = issues.get(key);
			if (!issue) return json(404, { errorMessages: ["Issue does not exist"] });
			issue.fields.status = { name: "Done" };
			return json(200, issue);
		}

		// /rest/api/2/issue/:key/comment
		const cm = path.match(/^\/rest\/api\/2\/issue\/([^/]+)\/comment$/);
		if (cm && method === "POST") {
			const key = decodeURIComponent(cm[1]);
			if (!issues.has(key)) return json(404, { errorMessages: ["Issue does not exist"] });
			return json(201, { id: "1", body: body.body });
		}

		// /rest/api/2/issue/:key/assignee
		const am = path.match(/^\/rest\/api\/2\/issue\/([^/]+)\/assignee$/);
		if (am && method === "PUT") {
			const key = decodeURIComponent(am[1]);
			const issue = issues.get(key);
			if (!issue) return json(404, { errorMessages: ["Issue does not exist"] });
			issue.fields.assignee = { name: body.name };
			return json(200, issue);
		}

		// metadata endpoints
		if (
			[
				"/rest/api/2/project",
				"/rest/api/2/issuetype",
				"/rest/api/2/status",
				"/rest/api/2/field",
			].includes(path)
		) {
			return json(200, []);
		}

		return json(404, { errorMessages: [`No route for ${method} ${path}`] });
	};

	return { fetch, issues };
}

describe("jira integration", () => {
	let origFetch;
	let mock;

	before(() => {
		origFetch = globalThis.fetch;
		mock = createJiraMock();
		globalThis.fetch = mock.fetch;
	});

	after(() => {
		globalThis.fetch = origFetch;
	});

	const opts = {
		sleep: noSleep,
		policy: {
			baseUrl: "https://jira.example.com",
			rateLimit: 0,
			timeout: 30000,
		},
	};

	it("runs the full lifecycle end-to-end", async () => {
		// search (empty)
		let r = await jiraImpl({ action: "search", jql: "project = PROJ" }, opts);
		assert.strictEqual(r.ok, true);
		assert.strictEqual(r.data.total, 0);

		// create
		r = await jiraImpl(
			{ action: "create", project: "PROJ", issueType: "Bug", summary: "boom" },
			opts,
		);
		assert.strictEqual(r.ok, true);
		const key = r.data.key;
		assert.match(key, /^PROJ-10000$/);

		// get
		r = await jiraImpl({ action: "get", key }, opts);
		assert.strictEqual(r.ok, true);
		assert.strictEqual(r.data.key, key);

		// transition
		r = await jiraImpl({ action: "transition", key, transitionId: 31 }, opts);
		assert.strictEqual(r.ok, true);
		assert.strictEqual(r.data.fields.status.name, "Done");

		// comment
		r = await jiraImpl({ action: "comment", key, comment: "investigating" }, opts);
		assert.strictEqual(r.ok, true);
		assert.strictEqual(r.data.body, "investigating");

		// update
		r = await jiraImpl({ action: "update", key, updates: { summary: "fixed" } }, opts);
		assert.strictEqual(r.ok, true);
		assert.strictEqual(r.data.fields.summary, "fixed");

		// assign
		r = await jiraImpl({ action: "assign", key, assignee: "acc-1" }, opts);
		assert.strictEqual(r.ok, true);
		assert.strictEqual(r.data.fields.assignee.name, "acc-1");

		// delete
		r = await jiraImpl({ action: "delete", key }, opts);
		assert.strictEqual(r.ok, true);

		// get after delete → 404
		r = await jiraImpl({ action: "get", key }, opts);
		assert.strictEqual(r.ok, false);
		assert.strictEqual(r.status, 404);
	});

	it("handles empty JQL results", async () => {
		const r = await jiraImpl({ action: "search", jql: "project = NONE" }, opts);
		assert.strictEqual(r.ok, true);
		assert.strictEqual(r.data.issues.length, 0);
	});

	it("maps an unknown issue key to 404", async () => {
		const r = await jiraImpl({ action: "get", key: "NOPE-1" }, opts);
		assert.strictEqual(r.ok, false);
		assert.strictEqual(r.status, 404);
	});

	it("paginates via startAt/maxResults", async () => {
		for (let i = 0; i < 3; i++) {
			await jiraImpl({ action: "create", project: "PROJ", summary: `s${i}` }, opts);
		}
		const r = await jiraImpl(
			{ action: "search", jql: "project = PROJ", maxResults: 2, startAt: 0 },
			opts,
		);
		assert.strictEqual(r.ok, true);
		assert.strictEqual(r.data.issues.length, 2);
		assert.ok(r.data.total >= 3);
	});
});
