/**
 * Unit tests for the Poppy discovery tool.
 * @see {@link src/tools/poppy/index.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
	poppyImpl,
	PoppyInputSchema,
	PoppyDocumentSchema,
} from "../../../src/tools/poppy/index.js";

const noSleep = async () => {};
const DOC_URL = "https://example.com/.well-known/poppy.json";
const RESOURCE_URL = "https://example.com/.well-known/oauth-protected-resource";
const ISSUER_URL = "https://auth.example.com/.well-known/oauth-authorization-server";

const json = (body, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const redirect = (location, status = 302) => new Response(null, { status, headers: { location } });
const notFound = () => new Response("nope", { status: 404 });

const validDoc = (overrides = {}) => ({
	protocol_version: "1.0",
	organization: { name: "Example", domain: "example.com" },
	auth: {
		scopes: ["orders.read"],
		scope_hints: { "orders.read": "Read orders" },
		sign_in_options: ["oauth"],
	},
	agent: { url: "https://agent.example.com" },
	web: { url: "https://example.com" },
	extensions: { "x-demo": true },
	...overrides,
});

/**
 * Build a fetch stub that answers by exact URL and records calls.
 * @param {Record<string, Response|Function>} routes - URL to response
 * @returns {{ fetch: Function, calls: string[] }}
 */
function router(routes) {
	const calls = [];
	const fetch = async (url) => {
		calls.push(url);
		const route = routes[url];
		if (!route) return notFound();
		return typeof route === "function" ? route() : route.clone();
	};
	return { fetch, calls };
}

const opts = (fetch) => ({ fetch, sleep: noSleep, policy: { rateLimit: 0, timeout: 30000 } });

describe("poppy input validation", () => {
	it("rejects an unknown action", async () => {
		const r = await poppyImpl({ action: "sign-in", domain: "example.com" }, opts());
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /Invalid input/);
	});

	it("rejects unknown fields via strict schema", async () => {
		assert.strictEqual(
			PoppyInputSchema.safeParse({ action: "discover", domain: "example.com", x: 1 }).success,
			false,
		);
	});

	it("requires a domain and sends no request", async () => {
		const { fetch, calls } = router({});
		const r = await poppyImpl({ action: "discover" }, opts(fetch));
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /requires: domain/);
		assert.strictEqual(calls.length, 0);
	});

	for (const bad of [
		"https://example.com",
		"example.com/path",
		"example.com:8443",
		"a@b.com",
		"exa mple.com",
	]) {
		it(`rejects non-hostname domain ${JSON.stringify(bad)}`, async () => {
			const { fetch, calls } = router({});
			const r = await poppyImpl({ action: "discover", domain: bad }, opts(fetch));
			assert.strictEqual(r.ok, false);
			assert.strictEqual(calls.length, 0);
		});
	}
});

describe("poppy discover", () => {
	it("returns a normalized summary when no protected resource metadata exists", async () => {
		const { fetch, calls } = router({ [DOC_URL]: json(validDoc()) });
		const r = await poppyImpl({ action: "discover", domain: "Example.com" }, opts(fetch));
		assert.strictEqual(r.ok, true);
		assert.deepStrictEqual(r.summary.channels, ["agent", "web"]);
		assert.strictEqual(r.summary.protocolVersion, "1.0");
		assert.strictEqual(r.summary.organization.domain, "example.com");
		assert.deepStrictEqual(r.summary.scopes, ["orders.read"]);
		assert.deepStrictEqual(r.summary.scopeHints, { "orders.read": "Read orders" });
		assert.deepStrictEqual(r.summary.signIn, ["oauth"]);
		assert.deepStrictEqual(r.summary.extensions, { "x-demo": true });
		assert.strictEqual(r.summary.issuer, null);
		assert.deepStrictEqual(calls, [DOC_URL, RESOURCE_URL]);
	});

	it("defaults optional summary fields", async () => {
		const doc = { protocol_version: "1.0", organization: { domain: "example.com" } };
		const { fetch } = router({ [DOC_URL]: json(doc) });
		const r = await poppyImpl({ action: "discover", domain: "example.com" }, opts(fetch));
		assert.strictEqual(r.ok, true);
		assert.deepStrictEqual(r.summary.channels, []);
		assert.deepStrictEqual(r.summary.scopes, []);
		assert.deepStrictEqual(r.summary.scopeHints, {});
		assert.deepStrictEqual(r.summary.signIn, []);
		assert.deepStrictEqual(r.summary.extensions, {});
	});

	it("reports a verified issuer", async () => {
		const { fetch } = router({
			[DOC_URL]: json(validDoc()),
			[RESOURCE_URL]: json({ authorization_servers: ["https://auth.example.com"] }),
			[ISSUER_URL]: json({ protected_resources: ["https://example.com"] }),
		});
		const r = await poppyImpl({ action: "discover", domain: "example.com" }, opts(fetch));
		assert.strictEqual(r.ok, true);
		assert.strictEqual(r.summary.issuer, "https://auth.example.com");
	});

	it("fails when the issuer does not list the domain", async () => {
		const { fetch } = router({
			[DOC_URL]: json(validDoc()),
			[RESOURCE_URL]: json({ authorization_servers: ["https://auth.example.com"] }),
			[ISSUER_URL]: json({ protected_resources: ["other.com", 7] }),
		});
		const r = await poppyImpl({ action: "discover", domain: "example.com" }, opts(fetch));
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /does not list example.com/);
	});

	it("fails when issuer metadata has no protected_resources", async () => {
		const { fetch } = router({
			[DOC_URL]: json(validDoc()),
			[RESOURCE_URL]: json({ authorization_servers: ["https://auth.example.com"] }),
			[ISSUER_URL]: json({}),
		});
		const r = await poppyImpl({ action: "discover", domain: "example.com" }, opts(fetch));
		assert.strictEqual(r.ok, false);
	});

	it("fails when issuer metadata cannot be fetched", async () => {
		const { fetch } = router({
			[DOC_URL]: json(validDoc()),
			[RESOURCE_URL]: json({ authorization_servers: ["https://auth.example.com"] }),
		});
		const r = await poppyImpl({ action: "discover", domain: "example.com" }, opts(fetch));
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /Issuer metadata/);
	});

	it("fails on a non-HTTPS or malformed issuer", async () => {
		for (const issuer of ["http://auth.example.com", "not a url"]) {
			const { fetch } = router({
				[DOC_URL]: json(validDoc()),
				[RESOURCE_URL]: json({ authorization_servers: [issuer] }),
			});
			const r = await poppyImpl({ action: "discover", domain: "example.com" }, opts(fetch));
			assert.strictEqual(r.ok, false, issuer);
		}
	});

	it("treats protected resource metadata without an issuer as no issuer", async () => {
		const { fetch } = router({ [DOC_URL]: json(validDoc()), [RESOURCE_URL]: json({}) });
		const r = await poppyImpl({ action: "discover", domain: "example.com" }, opts(fetch));
		assert.strictEqual(r.ok, true);
		assert.strictEqual(r.summary.issuer, null);
	});

	it("fails when protected resource metadata errors with a non-404", async () => {
		const { fetch } = router({
			[DOC_URL]: json(validDoc()),
			[RESOURCE_URL]: new Response("boom", { status: 500 }),
		});
		const r = await poppyImpl({ action: "discover", domain: "example.com" }, { ...opts(fetch) });
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /Protected resource metadata/);
	});
});

describe("poppy discovery document checks", () => {
	it("fails on organization.domain mismatch", async () => {
		const doc = validDoc({ organization: { domain: "evil.com" } });
		const { fetch } = router({ [DOC_URL]: json(doc) });
		const r = await poppyImpl({ action: "discover", domain: "example.com" }, opts(fetch));
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /does not match serving host/);
	});

	it("fails on schema violations", async () => {
		const { fetch } = router({ [DOC_URL]: json({ organization: { domain: "example.com" } }) });
		const r = await poppyImpl({ action: "discover", domain: "example.com" }, opts(fetch));
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /Invalid poppy.json: protocol_version/);
	});

	it("fails on a non-JSON body", async () => {
		const { fetch } = router({
			[DOC_URL]: new Response("<html>", { headers: { "content-type": "text/html" } }),
		});
		const r = await poppyImpl({ action: "discover", domain: "example.com" }, opts(fetch));
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /not JSON/);
	});

	it("fails on an HTTP error", async () => {
		const { fetch } = router({ [DOC_URL]: notFound() });
		const r = await poppyImpl({ action: "discover", domain: "example.com" }, opts(fetch));
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /404/);
	});

	it("keeps unknown fields in optional sections", () => {
		const parsed = PoppyDocumentSchema.parse(validDoc({ agent: { url: "u", future: 1 } }));
		assert.strictEqual(parsed.agent.future, 1);
	});
});

describe("poppy redirects", () => {
	it("follows HTTPS redirects ending at the well-known path and uses the final host", async () => {
		const final = "https://www.example.com/.well-known/poppy.json";
		const { fetch } = router({
			[DOC_URL]: redirect(final, 301),
			[final]: json(validDoc({ organization: { domain: "www.example.com" } })),
		});
		const r = await poppyImpl({ action: "discover", domain: "example.com" }, opts(fetch));
		assert.strictEqual(r.ok, true);
		assert.strictEqual(r.summary.organization.domain, "www.example.com");
	});

	it("refuses a redirect to HTTP", async () => {
		const { fetch } = router({ [DOC_URL]: redirect("http://example.com/.well-known/poppy.json") });
		const r = await poppyImpl({ action: "discover", domain: "example.com" }, opts(fetch));
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /non-HTTPS/);
	});

	it("refuses a final URL at a different path", async () => {
		const other = "https://example.com/poppy.json";
		const { fetch } = router({ [DOC_URL]: redirect(other), [other]: json(validDoc()) });
		const r = await poppyImpl({ action: "discover", domain: "example.com" }, opts(fetch));
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /must be served from/);
	});

	it("refuses a final URL carrying a query", async () => {
		const q = `${DOC_URL}?x=1`;
		const { fetch } = router({ [DOC_URL]: redirect(q), [q]: json(validDoc()) });
		const r = await poppyImpl({ action: "discover", domain: "example.com" }, opts(fetch));
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /no query/);
	});

	it("stops on a redirect loop", async () => {
		const { fetch } = router({ [DOC_URL]: () => redirect(DOC_URL) });
		const r = await poppyImpl({ action: "discover", domain: "example.com" }, opts(fetch));
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /Too many redirects/);
	});
});
