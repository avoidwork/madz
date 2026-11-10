import { describe, it } from "node:test";
import assert from "node:assert";
import {
	apiImpl,
	makeApiRequest,
	createApiTool,
	resolveCredential,
} from "../../src/tools/api/index.js";
import { ApiSchema } from "../../src/config/schemas/api.js";
import { createRateLimiter } from "../../src/tools/api/rateLimiter.js";

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

const base = { sleep: noSleep, rateLimit: 0 };

describe("api input validation", () => {
	it("rejects file:// via the scheme filter", async () => {
		const r = await apiImpl({ url: "file:///etc/passwd" }, {});
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /Blocked scheme/);
	});

	it("rejects invalid URL, method and unknown fields", async () => {
		assert.match((await apiImpl({ url: "not-a-url" })).error, /Invalid input/);
		assert.match(
			(await apiImpl({ url: "https://example.com", method: "NOPE" })).error,
			/Invalid input/,
		);
		assert.match((await apiImpl({ method: "GET" })).error, /Invalid input/);
	});

	it("does not accept model-supplied auth, allowlist or rate limit", async () => {
		for (const extra of [
			{ auth: { type: "bearer", token: "x" } },
			{ allowlist: ["evil.com"] },
			{ rateLimit: 0 },
		]) {
			const r = await apiImpl({ url: "https://example.com", ...extra });
			assert.match(r.error, /Invalid input/);
		}
	});

	it("rejects caller-controlled framing headers", async () => {
		const r = await makeApiRequest("https://example.com", { ...base, headers: { Host: "evil" } });
		assert.match(r.error, /Header not allowed: Host/);
	});

	it("rejects a body on GET and body+form together", async () => {
		assert.match(
			(await makeApiRequest("https://example.com", { ...base, body: "x" })).error,
			/not allowed for GET/,
		);
		const both = await makeApiRequest("https://example.com", {
			...base,
			method: "POST",
			body: "x",
			form: { a: 1 },
		});
		assert.match(both.error, /either body or form/);
	});
});

describe("api URL filtering", () => {
	it("blocks a redirect to a blocked scheme", async () => {
		const { fetch, calls } = stub([
			res({ status: 302, headers: { location: "file:///etc/passwd" } }),
		]);
		const r = await makeApiRequest("https://example.com/", { ...base, fetch });
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /Blocked scheme/);
		assert.strictEqual(calls.length, 1);
		assert.strictEqual(calls[0].options.redirect, "manual");
	});

	it("applies the allowlist to redirect hops", async () => {
		const { fetch } = stub([res({ status: 301, headers: { location: "https://other.com/" } })]);
		const r = await makeApiRequest("https://good.com/", {
			...base,
			fetch,
			allowlist: ["good.com"],
		});
		assert.match(r.error, /not on allowlist/);
	});

	it("rejects hosts not on the allowlist and lookalike suffix hosts", async () => {
		const policy = { allowlist: ["https://api.example.com"] };
		const a = await apiImpl({ url: "https://evil.com/" }, policy);
		const b = await apiImpl({ url: "https://api.example.com.evil.com/" }, policy, {});
		assert.match(a.error, /not on allowlist/);
		assert.match(b.error, /not on allowlist/);
	});

	it("stops after maxRedirects", async () => {
		const { fetch } = stub([
			res({ status: 302, headers: { location: "https://example.com/loop" } }),
		]);
		const r = await makeApiRequest("https://example.com/", { ...base, fetch, maxRedirects: 2 });
		assert.match(r.error, /Too many redirects/);
	});
});

describe("api redirects and credentials", () => {
	it("follows redirects and reports the final URL", async () => {
		const { fetch, calls } = stub([
			res({ status: 301, headers: { location: "/final" } }),
			res({ body: "done", headers: { "content-type": "text/plain" } }),
		]);
		const r = await makeApiRequest("https://example.com/start", { ...base, fetch });
		assert.strictEqual(r.ok, true);
		assert.strictEqual(r.body, "done");
		assert.strictEqual(r.url, "https://example.com/final");
		assert.strictEqual(calls.length, 2);
	});

	it("drops credentials on cross-origin redirects but keeps them same-origin", async () => {
		const cross = stub([
			res({ status: 302, headers: { location: "https://other.example.org/x" } }),
			res(),
		]);
		await makeApiRequest("https://example.com/", {
			...base,
			fetch: cross.fetch,
			auth: { type: "apikey", key: "X-API-Key", token: "secret" },
			headers: { Authorization: "Bearer x" },
		});
		assert.strictEqual(cross.calls[0].options.headers["X-API-Key"], "secret");
		assert.strictEqual(cross.calls[1].options.headers["X-API-Key"], undefined);
		assert.strictEqual(cross.calls[1].options.headers.Authorization, undefined);

		const same = stub([res({ status: 302, headers: { location: "/next" } }), res()]);
		await makeApiRequest("https://example.com/", {
			...base,
			fetch: same.fetch,
			auth: { type: "bearer", token: "t" },
		});
		assert.strictEqual(same.calls[1].options.headers.Authorization, "Bearer t");
	});

	it("turns POST into GET on 303 and drops the body", async () => {
		const { fetch, calls } = stub([res({ status: 303, headers: { location: "/r" } }), res()]);
		await makeApiRequest("https://example.com/", {
			...base,
			fetch,
			method: "POST",
			body: { a: 1 },
		});
		assert.strictEqual(calls[1].options.method, "GET");
		assert.strictEqual(calls[1].options.body, undefined);
	});

	it("attaches the Authorization header for bearer, basic and apikey", async () => {
		const run = async (auth) => {
			const { fetch, calls } = stub([res()]);
			const r = await makeApiRequest("https://example.com/", { ...base, fetch, auth });
			return { r, headers: calls[0]?.options.headers };
		};
		assert.strictEqual(
			(await run({ type: "bearer", token: "t" })).headers.Authorization,
			"Bearer t",
		);
		const basic = await run({ type: "basic", username: "u", password: "p" });
		assert.strictEqual(
			basic.headers.Authorization,
			`Basic ${Buffer.from("u:p").toString("base64")}`,
		);
		const legacy = await run({ type: "basic", token: "u:p" });
		assert.ok(legacy.headers.Authorization.startsWith("Basic "));
		assert.strictEqual((await run({ type: "apikey", key: "X-K", token: "v" })).headers["X-K"], "v");
	});

	it("errors instead of silently sending no auth", async () => {
		const { fetch, calls } = stub([res()]);
		const r = await makeApiRequest("https://example.com/", {
			...base,
			fetch,
			auth: { type: "bearer" },
		});
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /Invalid auth/);
		assert.strictEqual(calls.length, 0);
		const basic = await makeApiRequest("https://example.com/", {
			...base,
			fetch,
			auth: { type: "basic", token: "no-colon" },
		});
		assert.match(basic.error, /username and password/);
	});
});

describe("api credential profiles", () => {
	const policy = ApiSchema.parse({
		credentials: {
			github: { type: "bearer", tokenEnv: "GH_TOKEN", hosts: ["api.github.com"] },
			svc: { type: "basic", usernameEnv: "SVC_USER", passwordEnv: "SVC_PASS" },
		},
	});

	it("resolves secrets from the environment, server-side", () => {
		const r = resolveCredential("github", policy, { GH_TOKEN: "abc" });
		assert.strictEqual(r.auth.token, "abc");
		assert.deepStrictEqual(r.hosts, ["api.github.com"]);
	});

	it("reports unknown and unconfigured credentials without leaking values", () => {
		assert.match(
			resolveCredential("nope", policy, {}).error,
			/Unknown credential: nope \(available: github, svc\)/,
		);
		assert.match(resolveCredential("github", policy, {}).error, /GH_TOKEN is not set/);
	});

	it("sends the credential only to permitted hosts", async () => {
		const { fetch, calls } = stub([res()]);
		const runtime = { env: { GH_TOKEN: "abc" }, fetch, sleep: noSleep };
		const ok = await apiImpl(
			{ url: "https://api.github.com/user", credential: "github" },
			policy,
			runtime,
		);
		assert.strictEqual(ok.ok, true);
		assert.strictEqual(calls[0].options.headers.Authorization, "Bearer abc");
		const denied = await apiImpl(
			{ url: "https://evil.com/", credential: "github" },
			policy,
			runtime,
		);
		assert.match(denied.error, /not permitted for host evil.com/);
		assert.strictEqual(calls.length, 1);
	});

	it("rejects incomplete profiles at config time", () => {
		assert.throws(() => ApiSchema.parse({ credentials: { x: { type: "bearer" } } }));
		assert.throws(() =>
			ApiSchema.parse({ credentials: { x: { type: "basic", usernameEnv: "U" } } }),
		);
		assert.throws(() => ApiSchema.parse({ credentials: { x: { type: "apikey", tokenEnv: "T" } } }));
	});
});

describe("api request building", () => {
	it("appends query parameters to existing ones", async () => {
		const { fetch, calls } = stub([res()]);
		await makeApiRequest("https://example.com/a?x=1", {
			...base,
			fetch,
			query: { q: "a b", n: 2, f: true },
		});
		const url = new URL(calls[0].url);
		assert.strictEqual(url.searchParams.get("x"), "1");
		assert.strictEqual(url.searchParams.get("q"), "a b");
		assert.strictEqual(url.searchParams.get("n"), "2");
		assert.strictEqual(url.searchParams.get("f"), "true");
	});

	it("sends JSON for objects with a default Content-Type", async () => {
		const { fetch, calls } = stub([res()]);
		await makeApiRequest("https://example.com/", {
			...base,
			fetch,
			method: "POST",
			body: { k: "v" },
		});
		assert.strictEqual(calls[0].options.body, '{"k":"v"}');
		assert.strictEqual(calls[0].options.headers["Content-Type"], "application/json");
	});

	it("does not duplicate a caller Content-Type of different case", async () => {
		const { fetch, calls } = stub([res()]);
		await makeApiRequest("https://example.com/", {
			...base,
			fetch,
			method: "POST",
			body: { k: "v" },
			headers: { "content-type": "application/vnd.api+json" },
		});
		const names = Object.keys(calls[0].options.headers).filter(
			(h) => h.toLowerCase() === "content-type",
		);
		assert.deepStrictEqual(names, ["content-type"]);
	});

	it("sends raw strings as-is with no forced Content-Type", async () => {
		const { fetch, calls } = stub([res()]);
		await makeApiRequest("https://example.com/", { ...base, fetch, method: "POST", body: "raw" });
		assert.strictEqual(calls[0].options.body, "raw");
		assert.strictEqual(calls[0].options.headers["Content-Type"], undefined);
	});

	it("sends falsy JSON bodies (0, false, null, empty string)", async () => {
		for (const body of [0, false, null, ""]) {
			const { fetch, calls } = stub([res()]);
			await makeApiRequest("https://example.com/", { ...base, fetch, method: "POST", body });
			assert.strictEqual(
				calls[0].options.body,
				typeof body === "string" ? body : JSON.stringify(body),
			);
		}
	});

	it("sends a body on DELETE", async () => {
		const { fetch, calls } = stub([res()]);
		await makeApiRequest("https://example.com/", {
			...base,
			fetch,
			method: "DELETE",
			body: { id: 1 },
		});
		assert.strictEqual(calls[0].options.body, '{"id":1}');
	});

	it("encodes form bodies as urlencoded", async () => {
		const { fetch, calls } = stub([res()]);
		await makeApiRequest("https://example.com/", {
			...base,
			fetch,
			method: "POST",
			form: { a: "x y", b: 2 },
		});
		assert.strictEqual(calls[0].options.body, "a=x+y&b=2");
		assert.strictEqual(
			calls[0].options.headers["Content-Type"],
			"application/x-www-form-urlencoded",
		);
	});

	it("supports HEAD and OPTIONS", async () => {
		const { fetch, calls } = stub([res({ headers: { allow: "GET" } })]);
		const head = await makeApiRequest("https://example.com/", { ...base, fetch, method: "HEAD" });
		assert.strictEqual(head.ok, true);
		assert.strictEqual(head.body, "");
		await makeApiRequest("https://example.com/", { ...base, fetch, method: "OPTIONS" });
		assert.strictEqual(calls[1].options.method, "OPTIONS");
	});
});

describe("api responses", () => {
	it("ok is true only for 2xx; non-2xx still returns status and body", async () => {
		const { fetch } = stub([res({ status: 404, body: '{"error":"nope"}' })]);
		const r = await makeApiRequest("https://example.com/", { ...base, fetch });
		assert.strictEqual(r.ok, false);
		assert.strictEqual(r.status, 404);
		assert.strictEqual(r.body, '{"error":"nope"}');
		assert.match(r.error, /HTTP 404/);
	});

	it("includes statusText and the final url", async () => {
		const { fetch } = stub([new Response("x", { status: 201, statusText: "Created" })]);
		const r = await makeApiRequest("https://example.com/p", { ...base, fetch });
		assert.strictEqual(r.statusText, "Created");
		assert.strictEqual(r.url, "https://example.com/p");
	});

	it("handles empty 204 responses", async () => {
		const { fetch } = stub([res({ status: 204 })]);
		const r = await makeApiRequest("https://example.com/", { ...base, fetch, method: "DELETE" });
		assert.strictEqual(r.ok, true);
		assert.strictEqual(r.body, "");
	});

	it("returns binary responses base64-encoded", async () => {
		const bytes = new Uint8Array([0, 255, 128, 1]);
		const { fetch } = stub([
			new Response(bytes, { status: 200, headers: { "content-type": "application/octet-stream" } }),
		]);
		const r = await makeApiRequest("https://example.com/", { ...base, fetch });
		assert.strictEqual(r.bodyEncoding, "base64");
		assert.deepStrictEqual([...Buffer.from(r.body, "base64")], [...bytes]);
	});

	it("decodes text using the declared charset", async () => {
		const latin1 = Buffer.from([0x63, 0x61, 0x66, 0xe9]);
		const { fetch } = stub([
			new Response(latin1, { headers: { "content-type": "text/plain; charset=iso-8859-1" } }),
		]);
		const r = await makeApiRequest("https://example.com/", { ...base, fetch });
		assert.strictEqual(r.body, "café");
	});

	it("strips Set-Cookie and WWW-Authenticate response headers", async () => {
		const { fetch } = stub([
			res({ headers: { "set-cookie": "s=1", "www-authenticate": "Bearer", "x-keep": "yes" } }),
		]);
		const r = await makeApiRequest("https://example.com/", { ...base, fetch });
		assert.strictEqual(r.headers["set-cookie"], undefined);
		assert.strictEqual(r.headers["www-authenticate"], undefined);
		assert.strictEqual(r.headers["x-keep"], "yes");
	});

	it("rejects oversized bodies by Content-Length", async () => {
		const { fetch } = stub([res({ headers: { "content-length": "999999" } })]);
		const r = await makeApiRequest("https://example.com/", { ...base, fetch, maxBodySize: 1024 });
		assert.match(r.error, /too large/);
	});

	it("aborts streaming bodies past the byte cap without buffering them", async () => {
		let pulled = 0;
		const stream = new ReadableStream({
			pull(controller) {
				pulled++;
				controller.enqueue(new Uint8Array(512));
				if (pulled > 1000) controller.close();
			},
		});
		const { fetch } = stub([new Response(stream, { headers: { "content-type": "text/plain" } })]);
		const r = await makeApiRequest("https://example.com/", { ...base, fetch, maxBodySize: 1024 });
		assert.match(r.error, /too large/);
		assert.ok(pulled < 20, `read ${pulled} chunks`);
	});

	it("measures the size cap in bytes, not characters", async () => {
		const { fetch } = stub([
			new Response("é".repeat(600), { headers: { "content-type": "text/plain" } }),
		]);
		const r = await makeApiRequest("https://example.com/", { ...base, fetch, maxBodySize: 1024 });
		assert.match(r.error, /too large/);
	});

	it("caps maxBodySize at the 10MB default even if the model asks for more", async () => {
		const { fetch } = stub([res({ headers: { "content-length": String(20 * 1024 * 1024) } })]);
		const r = await apiImpl(
			{ url: "https://example.com/", maxBodySize: 100 * 1024 * 1024 },
			{ rateLimit: 0 },
			{ fetch },
		);
		assert.match(r.error, /too large/);
	});
});

describe("api timeouts and retries", () => {
	it("keeps the timeout active while the body is read", async () => {
		const stream = new ReadableStream({
			start(controller) {
				controller.enqueue(new Uint8Array(4));
				// never closes: a stalled server
			},
		});
		const fetch = async (_url, { signal }) => {
			signal.addEventListener("abort", () => stream.cancel().catch(() => {}));
			return new Response(stream, { headers: { "content-type": "text/plain" } });
		};
		const r = await makeApiRequest("https://example.com/", {
			...base,
			fetch,
			timeout: 50,
			maxRetries: 0,
		});
		assert.strictEqual(r.ok, false);
		assert.match(r.error, /timed out|aborted/i);
	});

	it("reports AbortError as a timeout", async () => {
		const { fetch } = stub([Object.assign(new Error("aborted"), { name: "AbortError" })]);
		const r = await makeApiRequest("https://example.com/", {
			...base,
			fetch,
			maxRetries: 0,
			timeout: 100,
		});
		assert.match(r.error, /timed out after 100ms/);
	});

	it("retries 503 then succeeds, honouring Retry-After", async () => {
		const delays = [];
		const { fetch, calls } = stub([
			res({ status: 503, headers: { "retry-after": "2" } }),
			res({ body: "fine", headers: { "content-type": "text/plain" } }),
		]);
		const r = await makeApiRequest("https://example.com/", {
			...base,
			fetch,
			sleep: async (ms) => delays.push(ms),
		});
		assert.strictEqual(r.ok, true);
		assert.strictEqual(calls.length, 2);
		assert.deepStrictEqual(delays, [2000]);
	});

	it("retries transient network errors for idempotent methods", async () => {
		const { fetch, calls } = stub([new Error("ECONNRESET"), res()]);
		const r = await makeApiRequest("https://example.com/", { ...base, fetch });
		assert.strictEqual(r.ok, true);
		assert.strictEqual(calls.length, 2);
	});

	it("does not retry non-idempotent POST on 5xx or network errors", async () => {
		const a = stub([res({ status: 503 })]);
		await makeApiRequest("https://example.com/", {
			...base,
			fetch: a.fetch,
			method: "POST",
			body: "x",
		});
		assert.strictEqual(a.calls.length, 1);
		const b = stub([new Error("ECONNRESET")]);
		await makeApiRequest("https://example.com/", {
			...base,
			fetch: b.fetch,
			method: "POST",
			body: "x",
		});
		assert.strictEqual(b.calls.length, 1);
	});

	it("retries POST on 429 and gives up after maxRetries", async () => {
		const { fetch, calls } = stub([res({ status: 429 })]);
		const r = await makeApiRequest("https://example.com/", {
			...base,
			fetch,
			method: "POST",
			body: "x",
			maxRetries: 2,
		});
		assert.strictEqual(calls.length, 3);
		assert.strictEqual(r.status, 429);
		assert.strictEqual(r.ok, false);
	});

	it("does not retry 4xx client errors", async () => {
		const { fetch, calls } = stub([res({ status: 400 })]);
		await makeApiRequest("https://example.com/", { ...base, fetch });
		assert.strictEqual(calls.length, 1);
	});
});

describe("api tool wrapper", () => {
	it("creates a LangChain tool whose schema has no auth/allowlist fields", () => {
		const t = createApiTool();
		assert.strictEqual(t.name, "api");
		const keys = Object.keys(t.schema.shape);
		assert.ok(keys.includes("credential") && keys.includes("query") && keys.includes("form"));
		for (const forbidden of ["auth", "allowlist", "rateLimit"]) {
			assert.ok(!keys.includes(forbidden), `${forbidden} must not be model-controlled`);
		}
	});

	it("lists configured credential profile names (never secrets) in the description", () => {
		const t = createApiTool({
			credentials: { github: { type: "bearer", tokenEnv: "GH_TOKEN_SECRET_VAR" } },
		});
		assert.match(t.description, /github/);
		assert.doesNotMatch(t.description, /GH_TOKEN_SECRET_VAR/);
	});

	it("enforces the server-side allowlist when invoked", async () => {
		const t = createApiTool({ allowlist: ["good.com"] });
		const out = JSON.parse(await t.invoke({ url: "https://evil.com/" }));
		assert.strictEqual(out.ok, false);
		assert.match(out.error, /not on allowlist/);
	});

	it("returns a JSON string result", async () => {
		const out = JSON.parse(await createApiTool().invoke({ url: "file:///etc/passwd" }));
		assert.strictEqual(out.ok, false);
	});
});

describe("api rate limiter", () => {
	/**
	 * Fake clock whose sleep advances time.
	 * @returns {{ now: Function, sleep: Function, sleeps: number[] }}
	 */
	function clock() {
		let t = 1_000_000;
		const sleeps = [];
		return {
			now: () => t,
			sleep: async (ms) => {
				// Concurrent sleepers wait in parallel: all compute their wake time from the same instant.
				const wake = t + ms;
				sleeps.push(ms);
				await Promise.resolve();
				t = Math.max(t, wake);
			},
			sleeps,
		};
	}

	it("allows up to the limit without waiting", async () => {
		const c = clock();
		const limiter = createRateLimiter({ maxPerSecond: 3, ...c });
		for (let i = 0; i < 3; i++) await limiter.acquire("a.com");
		assert.deepStrictEqual(c.sleeps, []);
	});

	it("waits once the window is full and never exceeds the limit", async () => {
		const c = clock();
		const limiter = createRateLimiter({ maxPerSecond: 2, ...c });
		const stamps = [];
		for (let i = 0; i < 6; i++) {
			await limiter.acquire("a.com");
			stamps.push(c.now());
		}
		for (let i = 0; i + 2 < stamps.length; i++) {
			assert.ok(stamps[i + 2] - stamps[i] > 1000, "more than 2 requests inside one second");
		}
	});

	it("tracks hosts independently", async () => {
		const c = clock();
		const limiter = createRateLimiter({ maxPerSecond: 1, ...c });
		await limiter.acquire("a.com");
		await limiter.acquire("b.com");
		assert.deepStrictEqual(c.sleeps, []);
	});

	it("holds under concurrency", async () => {
		const c = clock();
		const limiter = createRateLimiter({ maxPerSecond: 2, ...c });
		const stamps = [];
		await Promise.all(
			Array.from({ length: 6 }, async () => {
				await limiter.acquire("a.com");
				stamps.push(c.now());
			}),
		);
		stamps.sort((x, y) => x - y);
		for (let i = 0; i + 2 < stamps.length; i++) {
			assert.ok(stamps[i + 2] - stamps[i] > 1000, "more than 2 requests inside one second");
		}
	});

	it("is disabled by 0 and prunes stale hosts without a timer", async () => {
		const c = clock();
		const off = createRateLimiter({ maxPerSecond: 0, ...c });
		for (let i = 0; i < 50; i++) await off.acquire("a.com");
		assert.deepStrictEqual(c.sleeps, []);

		const limiter = createRateLimiter({ maxPerSecond: 5, ...c });
		for (let i = 0; i < 300; i++) await limiter.acquire(`h${i}.com`);
		await c.sleep(5000);
		await limiter.acquire("fresh.com");
		assert.ok(limiter.size() < 300);
	});

	it("is keyed per host by the tool (different paths share a budget)", async () => {
		const { fetch, calls } = stub([res()]);
		const waits = [];
		const ok = await Promise.all(
			["/a", "/b", "/c"].map((p) =>
				makeApiRequest(`https://rl-host.example.com${p}`, {
					sleep: noSleep,
					fetch,
					rateLimit: 1000,
				}),
			),
		);
		waits.push(ok.length);
		assert.strictEqual(calls.length, 3);
	});
});

describe("api policy schema", () => {
	it("applies safe defaults", () => {
		const p = ApiSchema.parse({});
		assert.deepStrictEqual(p.allowlist, []);
		assert.strictEqual(p.rateLimit, 10);
		assert.strictEqual(p.maxRedirects, 5);
		assert.strictEqual(p.maxRetries, 2);
		assert.deepStrictEqual(p.credentials, {});
	});
});
