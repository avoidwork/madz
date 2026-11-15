/**
 * Unit tests for the Confluence tool.
 * @see {@link src/tools/confluence/index.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
	confluenceImpl,
	resolveConfluenceCredential,
	ConfluenceInputSchema,
} from "../../../src/tools/confluence/index.js";

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
	policy: { allowlist: [], rateLimit: 0, timeout: 30000, credentials: {} },
};
const withUrl = (opts = {}) => ({
	...base,
	...opts,
	policy: { ...base.policy, baseUrl: "https://example.atlassian.net" },
});

describe("confluence input validation", () => {
	it("rejects an unknown action", async () => {
		const r = await confluenceImpl({ action: "frobnicate", id: "1" }, withUrl());
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /Invalid input/);
	});

	it("rejects unknown fields via strict schema", async () => {
		const r = await confluenceImpl({ action: "get", id: "1", bogus: 1 }, withUrl());
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /Invalid input/);
	});

	it("requires a base URL", async () => {
		const r = await confluenceImpl(
			{ action: "get", id: "1" },
			{ ...base, policy: { allowlist: [], rateLimit: 0, timeout: 30000, credentials: {} } },
		);
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /No Confluence base URL/);
	});
});

describe("confluence actions", () => {
	it("search GETs /pages with CQL query", async () => {
		const { fetch, calls } = stub([res({ body: JSON.stringify({ results: [], _links: {} }) })]);
		const r = await confluenceImpl(
			{ action: "search", cql: "space = SPACE", limit: 10 },
			withUrl({ fetch }),
		);
		assert.strictEqual(r.ok, true);
		assert.strictEqual(r.status, 200);
		assert.match(calls[0].url, /\/wiki\/api\/v2\/pages\?/);
		assert.match(calls[0].url, /cql=space\+%3D\+SPACE/);
		assert.match(calls[0].url, /limit=10/);
		assert.strictEqual(calls[0].options.method, "GET");
	});

	it("get fetches a page by id", async () => {
		const { fetch, calls } = stub([res({ body: JSON.stringify({ id: "123", title: "Home" }) })]);
		const r = await confluenceImpl({ action: "get", id: "123" }, withUrl({ fetch }));
		assert.strictEqual(r.ok, true);
		assert.strictEqual(r.data.id, "123");
		assert.match(calls[0].url, /\/wiki\/api\/v2\/pages\/123$/);
		assert.strictEqual(calls[0].options.method, "GET");
	});

	it("create posts a page body", async () => {
		const { fetch, calls } = stub([res({ body: JSON.stringify({ id: "456", title: "New" }) })]);
		const r = await confluenceImpl(
			{ action: "create", spaceId: "1001", title: "New", body: "hello" },
			withUrl({ fetch }),
		);
		assert.strictEqual(r.ok, true);
		assert.strictEqual(r.data.id, "456");
		assert.strictEqual(calls[0].options.method, "POST");
		const sent = JSON.parse(calls[0].options.body);
		assert.strictEqual(sent.spaceId, "1001");
		assert.strictEqual(sent.title, "New");
		assert.deepStrictEqual(sent.body, { storage: { value: "hello", representation: "storage" } });
	});

	it("update puts a page body/title/version", async () => {
		const { fetch, calls } = stub([res({ body: JSON.stringify({ id: "123", title: "Updated" }) })]);
		const r = await confluenceImpl(
			{ action: "update", id: "123", title: "Updated", body: "new body", version: 2 },
			withUrl({ fetch }),
		);
		assert.strictEqual(r.ok, true);
		assert.strictEqual(calls[0].options.method, "PUT");
		const sent = JSON.parse(calls[0].options.body);
		assert.strictEqual(sent.title, "Updated");
		assert.deepStrictEqual(sent.body, {
			storage: { value: "new body", representation: "storage" },
		});
		assert.deepStrictEqual(sent.version, { number: 2 });
	});

	it("delete removes a page", async () => {
		const { fetch, calls } = stub([res({ status: 204 })]);
		const r = await confluenceImpl({ action: "delete", id: "123" }, withUrl({ fetch }));
		assert.strictEqual(r.ok, true);
		assert.strictEqual(calls[0].options.method, "DELETE");
		assert.match(calls[0].url, /\/wiki\/api\/v2\/pages\/123$/);
	});

	it("metadata lookups hit the right endpoints", async () => {
		for (const [action, path] of [
			["spaces", "/spaces"],
			["pages", "/pages"],
		]) {
			const { fetch, calls } = stub([res({ body: "[]" })]);
			const r = await confluenceImpl({ action }, withUrl({ fetch }));
			assert.strictEqual(r.ok, true, action);
			assert.match(calls[0].url, new RegExp(`/wiki/api/v2${path}$`), action);
		}
	});

	it("labels and attachments hit page sub-resources", async () => {
		for (const [action, path] of [
			["labels", "/labels"],
			["attachments", "/attachments"],
		]) {
			const { fetch, calls } = stub([res({ body: "[]" })]);
			const r = await confluenceImpl({ action, id: "123" }, withUrl({ fetch }));
			assert.strictEqual(r.ok, true, action);
			assert.match(calls[0].url, new RegExp(`/wiki/api/v2/pages/123${path}$`), action);
		}
	});
});

describe("confluence error mapping", () => {
	it("maps 400 invalid CQL", async () => {
		const { fetch } = stub([res({ status: 400, body: JSON.stringify({ message: "bad CQL" }) })]);
		const r = await confluenceImpl({ action: "search", cql: "garbage" }, withUrl({ fetch }));
		assert.strictEqual(r.ok, false);
		assert.strictEqual(r.status, 400);
		assert.match(r.error, /HTTP 400/);
	});

	it("maps 404 unknown page", async () => {
		const { fetch } = stub([res({ status: 404, body: "{}" })]);
		const r = await confluenceImpl({ action: "get", id: "999" }, withUrl({ fetch }));
		assert.strictEqual(r.ok, false);
		assert.strictEqual(r.status, 404);
	});

	it("maps 401 bad credentials", async () => {
		const { fetch } = stub([res({ status: 401, body: "{}" })]);
		const r = await confluenceImpl({ action: "get", id: "123" }, withUrl({ fetch }));
		assert.strictEqual(r.ok, false);
		assert.strictEqual(r.status, 401);
	});
});

describe("confluence credential resolution", () => {
	it("resolves a basic credential from env", () => {
		const policy = {
			credentials: {
				confluence: { usernameEnv: "CONFLUENCE_EMAIL", passwordEnv: "CONFLUENCE_TOKEN", hosts: [] },
			},
		};
		const r = resolveConfluenceCredential("confluence", policy, {
			CONFLUENCE_EMAIL: "a@b.com",
			CONFLUENCE_TOKEN: "tok",
		});
		assert.strictEqual(r.auth.type, "basic");
		assert.strictEqual(r.auth.username, "a@b.com");
		assert.strictEqual(r.auth.password, "tok");
	});

	it("rejects an unknown credential", () => {
		const r = resolveConfluenceCredential("nope", { credentials: {} }, {});
		assert.match(r.error, /Unknown credential/);
	});

	it("rejects a missing env var", () => {
		const policy = {
			credentials: {
				confluence: { usernameEnv: "CONFLUENCE_EMAIL", passwordEnv: "CONFLUENCE_TOKEN", hosts: [] },
			},
		};
		const r = resolveConfluenceCredential("confluence", policy, {});
		assert.match(r.error, /not configured/);
	});

	it("rejects a host outside the credential allowlist", async () => {
		const { fetch } = stub([res({ body: "{}" })]);
		const policy = {
			baseUrl: "https://evil.example.com",
			allowlist: [],
			rateLimit: 0,
			timeout: 30000,
			credentials: {
				confluence: {
					usernameEnv: "CONFLUENCE_EMAIL",
					passwordEnv: "CONFLUENCE_TOKEN",
					hosts: ["*.atlassian.net"],
				},
			},
		};
		const r = await confluenceImpl(
			{ action: "get", id: "123", credential: "confluence" },
			{ ...base, policy, fetch, env: { CONFLUENCE_EMAIL: "a@b.com", CONFLUENCE_TOKEN: "tok" } },
		);
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /not permitted for host/);
	});
});

describe("confluence schema", () => {
	it("parses a valid search input", () => {
		const r = ConfluenceInputSchema.safeParse({ action: "search", cql: "space = X", limit: 10 });
		assert.strictEqual(r.success, true);
	});
});
