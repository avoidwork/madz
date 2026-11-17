/**
 * Integration tests for the Confluence tool.
 * Exercises the full lifecycle (search → get → create → update → delete) against
 * an in-memory Confluence Cloud REST API v2 mock installed as a `fetch` override.
 * @see {@link src/tools/confluence/index.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { confluenceImpl } from "../../../src/tools/confluence/index.js";

const noSleep = async () => {};

/**
 * A minimal in-memory Confluence Cloud REST API v2 mock.
 * @returns {{ fetch: Function, pages: Map }}
 */
function createConfluenceMock() {
	const pages = new Map();
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

		// GET /wiki/api/v2/pages (search / list)
		if (path.endsWith("/wiki/api/v2/pages") && method === "GET") {
			const all = [...pages.values()];
			const start = Number(u.searchParams.get("start") ?? 0);
			const limit = Number(u.searchParams.get("limit") ?? 50);
			const page = all.slice(start, start + limit);
			return json(200, { results: page, _links: {} });
		}

		// POST /wiki/api/v2/pages
		if (path.endsWith("/wiki/api/v2/pages") && method === "POST") {
			const id = String(nextId++);
			const page = { id, title: body.title, spaceId: body.spaceId, body };
			pages.set(id, page);
			return json(201, page);
		}

		// /wiki/api/v2/pages/:id
		const m = path.match(/\/wiki\/api\/v2\/pages\/([^/]+)$/);
		if (m) {
			const id = decodeURIComponent(m[1]);
			const page = pages.get(id);
			if (method === "GET") {
				return page ? json(200, page) : json(404, { message: "Page does not exist" });
			}
			if (method === "PUT") {
				if (!page) return json(404, { message: "Page does not exist" });
				if (body.title !== undefined) page.title = body.title;
				if (body.body !== undefined) page.body = body.body;
				pages.set(id, page);
				return json(200, page);
			}
			if (method === "DELETE") {
				if (!page) return json(404, { message: "Page does not exist" });
				pages.delete(id);
				return json(204);
			}
		}

		return json(404, { message: "Not found" });
	};

	return { fetch, pages };
}

const withUrl = (opts = {}) => ({
	sleep: noSleep,
	...opts,
	policy: {
		rateLimit: 0,
		timeout: 30000,
		baseUrl: "https://example.atlassian.net",
	},
});

describe("confluence integration", () => {
	it("runs search → get → create → update → delete end-to-end", async () => {
		const mock = createConfluenceMock();
		const opts = withUrl({ fetch: mock.fetch });

		// create
		const created = await confluenceImpl(
			{ action: "create", spaceId: "1001", title: "Home", body: "hello" },
			opts,
		);
		assert.strictEqual(created.ok, true);
		assert.strictEqual(created.status, 201);
		const id = created.data.id;

		// get
		const got = await confluenceImpl({ action: "get", id }, opts);
		assert.strictEqual(got.ok, true);
		assert.strictEqual(got.data.title, "Home");

		// update
		const updated = await confluenceImpl(
			{ action: "update", id, title: "Home v2", body: "updated", version: 2 },
			opts,
		);
		assert.strictEqual(updated.ok, true);
		assert.strictEqual(updated.data.title, "Home v2");

		// search
		const searched = await confluenceImpl({ action: "search", cql: "space = SPACE" }, opts);
		assert.strictEqual(searched.ok, true);
		assert.strictEqual(searched.data.results.length, 1);

		// delete
		const deleted = await confluenceImpl({ action: "delete", id }, opts);
		assert.strictEqual(deleted.ok, true);
		assert.strictEqual(deleted.status, 204);

		// get after delete → 404
		const gone = await confluenceImpl({ action: "get", id }, opts);
		assert.strictEqual(gone.ok, false);
		assert.strictEqual(gone.status, 404);
	});

	it("returns empty search results without error", async () => {
		const mock = createConfluenceMock();
		const opts = withUrl({ fetch: mock.fetch });
		const r = await confluenceImpl({ action: "search", cql: "space = NOPE" }, opts);
		assert.strictEqual(r.ok, true);
		assert.strictEqual(r.data.results.length, 0);
	});

	it("maps 404 for an invalid page id", async () => {
		const mock = createConfluenceMock();
		const opts = withUrl({ fetch: mock.fetch });
		const r = await confluenceImpl({ action: "get", id: "99999" }, opts);
		assert.strictEqual(r.ok, false);
		assert.strictEqual(r.status, 404);
	});

	it("paginates results via limit/start", async () => {
		const mock = createConfluenceMock();
		for (let i = 0; i < 5; i++) {
			await confluenceImpl(
				{ action: "create", spaceId: "1001", title: `Page ${i}`, body: "x" },
				withUrl({ fetch: mock.fetch }),
			);
		}
		const opts = withUrl({ fetch: mock.fetch });
		const page1 = await confluenceImpl(
			{ action: "search", cql: "space = SPACE", limit: 2, start: 0 },
			opts,
		);
		const page2 = await confluenceImpl(
			{ action: "search", cql: "space = SPACE", limit: 2, start: 2 },
			opts,
		);
		assert.strictEqual(page1.ok, true);
		assert.strictEqual(page1.data.results.length, 2);
		assert.strictEqual(page2.ok, true);
		assert.strictEqual(page2.data.results.length, 2);
	});

	it("rejects a create missing required fields", async () => {
		const mock = createConfluenceMock();
		const opts = withUrl({ fetch: mock.fetch });
		// spaceId and title are required by the schema; omitting them is invalid.
		const r = await confluenceImpl({ action: "create", body: "x" }, opts);
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /Invalid input/);
	});
});
