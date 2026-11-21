/**
 * Unit tests for the Poppy discovery tool.
 * Fixtures follow the Personal Agent Protocol 1.0 specification (section 3).
 * @see {@link src/tools/poppy/index.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
	poppyImpl,
	poppy,
	PoppyInputSchema,
	PoppyDocumentSchema,
} from "../../../src/tools/poppy/index.js";

const noSleep = async () => {};
const DOC_URL = "https://example.com/.well-known/poppy.json";
const RESOURCE_URL = "https://example.com/.well-known/oauth-protected-resource";
const ISSUER = "https://auth.example.com";
const ISSUER_URL = "https://auth.example.com/.well-known/oauth-authorization-server";

const json = (body, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const redirect = (location, status = 302) => new Response(null, { status, headers: { location } });
const notFound = () => new Response("nope", { status: 404 });

const validDoc = (overrides = {}) => ({
	protocol_version: "1.0",
	organization: { name: "Example", domain: "example.com" },
	auth: {
		scopes: { "orders:read": "See your orders" },
		scope_hints: { "orders:read": { changes: "none", personal_data: true } },
	},
	agent: {
		protocols: [
			{
				type: "poppy",
				endpoint: "https://api.example.com/poppy/conversations",
				description: "Orders",
			},
		],
	},
	apis: [
		{ type: "openapi", url: "https://api.example.com/openapi.json", description: "Orders API" },
	],
	web: { browser_session_endpoint: "https://example.com/poppy/browser-session" },
	tasks: { endpoint: "https://api.example.com/poppy/tasks" },
	extensions: {
		"example.com/gift-wrap": [{ version: "1", endpoint: "https://api.example.com/gw" }],
	},
	...overrides,
});

const resourceMeta = (overrides = {}) => ({
	resource: "https://example.com",
	authorization_servers: [ISSUER],
	scopes_supported: ["orders:read"],
	...overrides,
});

const issuerMeta = (overrides = {}) => ({
	issuer: ISSUER,
	protected_resources: ["https://example.com"],
	grant_types_supported: [
		"refresh_token",
		"authorization_code",
		"urn:ietf:params:oauth:grant-type:device_code",
	],
	scopes_supported: ["orders:read", "orders:write"],
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
const discover = (routes, domain = "example.com") =>
	poppyImpl({ action: "discover", domain }, opts(router(routes).fetch));

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

describe("poppy tool description", () => {
	it("tells the agent when to use it, the input shape and failure handling", () => {
		assert.match(poppy.description, /Use this first/);
		assert.match(poppy.description, /no scheme, path or port/);
		assert.match(poppy.description, /do not retry/);
		assert.match(poppy.description, /untrusted data/);
	});
});

describe("poppy discover", () => {
	it("returns a normalized summary when no protected resource metadata exists", async () => {
		const { fetch, calls } = router({ [DOC_URL]: json(validDoc()) });
		const r = await poppyImpl({ action: "discover", domain: "Example.com" }, opts(fetch));
		assert.strictEqual(r.ok, true);
		assert.deepStrictEqual(r.summary.channels, ["agent", "apis", "web"]);
		assert.strictEqual(r.summary.protocolVersion, "1.0");
		assert.strictEqual(r.summary.organization.domain, "example.com");
		assert.deepStrictEqual(r.summary.scopes, { "orders:read": "See your orders" });
		assert.deepStrictEqual(r.summary.scopeHints, {
			"orders:read": { changes: "none", personal_data: true },
		});
		assert.strictEqual(r.summary.agentProtocols[0].description, "Orders");
		assert.strictEqual(r.summary.apis[0].description, "Orders API");
		assert.strictEqual(
			r.summary.web.browser_session_endpoint,
			"https://example.com/poppy/browser-session",
		);
		assert.strictEqual(r.summary.tasksEndpoint, "https://api.example.com/poppy/tasks");
		assert.deepStrictEqual(r.summary.signIn, []);
		assert.strictEqual(r.summary.issuer, null);
		assert.deepStrictEqual(calls, [DOC_URL, RESOURCE_URL]);
	});

	it("accepts a document with only the required fields", async () => {
		const doc = {
			protocol_version: "1.0",
			organization: { domain: "example.com" },
			web: {},
		};
		const r = await discover({ [DOC_URL]: json(doc) });
		assert.strictEqual(r.ok, true);
		assert.deepStrictEqual(r.summary.channels, ["web"]);
		assert.deepStrictEqual(r.summary.scopes, {});
		assert.deepStrictEqual(r.summary.scopeHints, {});
		assert.deepStrictEqual(r.summary.apis, []);
		assert.deepStrictEqual(r.summary.agentProtocols, []);
		assert.deepStrictEqual(r.summary.extensions, {});
		assert.strictEqual(r.summary.tasksEndpoint, null);
	});

	it("reports a verified issuer with sign-in types from grant_types_supported", async () => {
		const r = await discover({
			[DOC_URL]: json(validDoc()),
			[RESOURCE_URL]: json(resourceMeta()),
			[ISSUER_URL]: json(issuerMeta()),
		});
		assert.strictEqual(r.ok, true);
		assert.strictEqual(r.summary.issuer, ISSUER);
		assert.deepStrictEqual(r.summary.signIn, ["direct", "device"]);
		assert.deepStrictEqual(r.summary.scopesSupported, ["orders:read", "orders:write"]);
	});

	it("reports only the sign-in type the issuer offers", async () => {
		const r = await discover({
			[DOC_URL]: json(validDoc()),
			[RESOURCE_URL]: json(resourceMeta()),
			[ISSUER_URL]: json(
				issuerMeta({ grant_types_supported: ["refresh_token", "authorization_code"] }),
			),
		});
		assert.deepStrictEqual(r.summary.signIn, ["direct"]);
	});

	it("reports no sign-in when auth.disabled is true", async () => {
		const r = await discover({
			[DOC_URL]: json(validDoc({ auth: { disabled: true } })),
			[RESOURCE_URL]: json(resourceMeta()),
			[ISSUER_URL]: json(issuerMeta()),
		});
		assert.strictEqual(r.ok, true);
		assert.strictEqual(r.summary.signInDisabled, true);
		assert.deepStrictEqual(r.summary.signIn, []);
		assert.strictEqual(r.summary.issuer, ISSUER);
	});

	it("treats an unrecognized scope hint value as irreversible", async () => {
		const doc = validDoc({
			auth: { scope_hints: { x: { changes: "someday", personal_data: false } } },
		});
		const r = await discover({ [DOC_URL]: json(doc) });
		assert.strictEqual(r.summary.scopeHints.x.changes, "irreversible");
	});

	it("matches protected_resources case-insensitively on the host only", async () => {
		const r = await discover({
			[DOC_URL]: json(validDoc()),
			[RESOURCE_URL]: json(resourceMeta()),
			[ISSUER_URL]: json(issuerMeta({ protected_resources: ["https://EXAMPLE.com"] })),
		});
		assert.strictEqual(r.ok, true);
	});

	it("fails when the issuer does not list the domain exactly", async () => {
		for (const listed of [
			["https://other.com", 7],
			["https://example.com/"],
			["example.com"],
			[],
		]) {
			const r = await discover({
				[DOC_URL]: json(validDoc()),
				[RESOURCE_URL]: json(resourceMeta()),
				[ISSUER_URL]: json(issuerMeta({ protected_resources: listed })),
			});
			assert.strictEqual(r.ok, false, JSON.stringify(listed));
			assert.match(r.error, /does not list example.com/);
		}
	});

	it("fails when issuer metadata has no protected_resources", async () => {
		const meta = issuerMeta();
		delete meta.protected_resources;
		const r = await discover({
			[DOC_URL]: json(validDoc()),
			[RESOURCE_URL]: json(resourceMeta()),
			[ISSUER_URL]: json(meta),
		});
		assert.strictEqual(r.ok, false);
	});

	it("fails when the issuer metadata issuer does not match exactly", async () => {
		const r = await discover({
			[DOC_URL]: json(validDoc()),
			[RESOURCE_URL]: json(resourceMeta()),
			[ISSUER_URL]: json(issuerMeta({ issuer: "https://auth.example.com/" })),
		});
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /does not exactly match/);
	});

	it("fails when issuer metadata cannot be fetched", async () => {
		const r = await discover({
			[DOC_URL]: json(validDoc()),
			[RESOURCE_URL]: json(resourceMeta()),
		});
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /Issuer metadata/);
	});

	it("fails on a non-HTTPS or malformed issuer", async () => {
		for (const issuer of ["http://auth.example.com", "not a url"]) {
			const r = await discover({
				[DOC_URL]: json(validDoc()),
				[RESOURCE_URL]: json(resourceMeta({ authorization_servers: [issuer] })),
			});
			assert.strictEqual(r.ok, false, issuer);
		}
	});

	it("fails when the resource in protected resource metadata is not the domain", async () => {
		const r = await discover({
			[DOC_URL]: json(validDoc()),
			[RESOURCE_URL]: json(resourceMeta({ resource: "https://other.com" })),
		});
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /resource must be exactly https:\/\/example.com/);
	});

	it("treats empty authorization_servers as no issuer", async () => {
		const r = await discover({
			[DOC_URL]: json(validDoc()),
			[RESOURCE_URL]: json(resourceMeta({ authorization_servers: [] })),
		});
		assert.strictEqual(r.ok, true);
		assert.strictEqual(r.summary.issuer, null);
		assert.deepStrictEqual(r.summary.scopesSupported, ["orders:read"]);
	});

	it("fails when protected resource metadata errors with a non-404", async () => {
		const r = await discover({
			[DOC_URL]: json(validDoc()),
			[RESOURCE_URL]: new Response("boom", { status: 500 }),
		});
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /Protected resource metadata/);
	});

	it("fails when auth.issuer is set but the domain has no resource metadata", async () => {
		const r = await discover({
			[DOC_URL]: json(validDoc({ auth: { issuer: ISSUER } })),
		});
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /auth.issuer is set/);
	});

	it("requires auth.issuer to match the single authorization server", async () => {
		const r = await discover({
			[DOC_URL]: json(validDoc({ auth: { issuer: "https://elsewhere.example.com" } })),
			[RESOURCE_URL]: json(resourceMeta()),
		});
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /is not the domain's authorization server/);
	});

	it("uses auth.issuer to pick among several authorization servers", async () => {
		const employees = "https://employees.example.com";
		const r = await discover({
			[DOC_URL]: json(validDoc({ auth: { issuer: ISSUER } })),
			[RESOURCE_URL]: json(resourceMeta({ authorization_servers: [employees, ISSUER] })),
			[ISSUER_URL]: json(issuerMeta()),
		});
		assert.strictEqual(r.ok, true);
		assert.strictEqual(r.summary.issuer, ISSUER);
	});

	it("fails when several authorization servers are listed and auth.issuer is absent or unlisted", async () => {
		const servers = ["https://a.example.com", ISSUER];
		for (const auth of [undefined, { issuer: "https://c.example.com" }]) {
			const r = await discover({
				[DOC_URL]: json(validDoc({ auth })),
				[RESOURCE_URL]: json(resourceMeta({ authorization_servers: servers })),
			});
			assert.strictEqual(r.ok, false);
			assert.match(r.error, /must name one of/);
		}
	});
});

describe("poppy discovery document checks", () => {
	it("fails on organization.domain mismatch", async () => {
		const r = await discover({
			[DOC_URL]: json(validDoc({ organization: { domain: "evil.com" } })),
		});
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /does not match serving host/);
	});

	it("fails on schema violations", async () => {
		const r = await discover({ [DOC_URL]: json({ organization: { domain: "example.com" } }) });
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /Invalid poppy.json: protocol_version/);
	});

	it("fails when none of agent, apis or web is present", async () => {
		const r = await discover({
			[DOC_URL]: json({ protocol_version: "1.0", organization: { domain: "example.com" } }),
		});
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /at least one of agent, apis, or web/);
	});

	it("fails when apis is not a list", async () => {
		const r = await discover({ [DOC_URL]: json(validDoc({ apis: { type: "openapi" } })) });
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /apis/);
	});

	it("fails when a URL in the document is not HTTPS", async () => {
		const doc = validDoc({
			apis: [{ type: "mcp", url: "http://mcp.example.com/mcp", description: "x" }],
		});
		const r = await discover({ [DOC_URL]: json(doc) });
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /must be an HTTPS URL/);
	});

	it("fails on an incompatible major protocol version", async () => {
		for (const version of ["2.0", "0.4", "one"]) {
			const r = await discover({ [DOC_URL]: json(validDoc({ protocol_version: version })) });
			assert.strictEqual(r.ok, false, version);
			assert.match(r.error, /Unsupported protocol_version/);
		}
	});

	it("accepts a newer minor version of the implemented major", async () => {
		const r = await discover({ [DOC_URL]: json(validDoc({ protocol_version: "1.7" })) });
		assert.strictEqual(r.ok, true);
	});

	it("fails on a non-JSON body", async () => {
		const r = await discover({
			[DOC_URL]: new Response("<html>", { headers: { "content-type": "text/html" } }),
		});
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /not JSON/);
	});

	it("fails on an HTTP error", async () => {
		const r = await discover({ [DOC_URL]: notFound() });
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /404/);
	});

	it("keeps unknown fields in optional sections", () => {
		const doc = validDoc();
		doc.agent.future = 1;
		const parsed = PoppyDocumentSchema.parse(doc);
		assert.strictEqual(parsed.agent.future, 1);
	});
});

describe("poppy redirects", () => {
	it("follows HTTPS redirects ending at the well-known path and uses the final host", async () => {
		const final = "https://www.example.com/.well-known/poppy.json";
		const r = await discover({
			[DOC_URL]: redirect(final, 301),
			[final]: json(validDoc({ organization: { domain: "www.example.com" } })),
		});
		assert.strictEqual(r.ok, true);
		assert.strictEqual(r.summary.organization.domain, "www.example.com");
	});

	it("refuses a redirect to HTTP", async () => {
		const r = await discover({
			[DOC_URL]: redirect("http://example.com/.well-known/poppy.json"),
		});
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /non-HTTPS/);
	});

	it("refuses a final URL at a different path", async () => {
		const other = "https://example.com/poppy.json";
		const r = await discover({ [DOC_URL]: redirect(other), [other]: json(validDoc()) });
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /must be served from/);
	});

	it("refuses a final URL carrying a query", async () => {
		const q = `${DOC_URL}?x=1`;
		const r = await discover({ [DOC_URL]: redirect(q), [q]: json(validDoc()) });
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /no query/);
	});

	it("stops on a redirect loop", async () => {
		const r = await discover({ [DOC_URL]: () => redirect(DOC_URL) });
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /Too many redirects/);
	});
});
