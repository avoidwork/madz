import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import {
	BrowserInputSchema,
	buildBrowserHeaders,
	hasBrowserSignInScope,
	authorizeCode,
	readCodeFromPage,
	submitFormAndBrowse,
	joinBrowserSession,
	execute,
} from "../../../../src/tools/poppy/browser.js";

describe("poppy browser - schema validation", () => {
	it("accepts valid browser input", () => {
		const result = BrowserInputSchema.safeParse({
			op: "join",
			endpoint: "https://example.com/session",
		});
		assert.strictEqual(result.success, true);
	});

	it("rejects browser input missing op", () => {
		const result = BrowserInputSchema.safeParse({ endpoint: "https://example.com/session" });
		assert.strictEqual(result.success, false);
	});

	it("rejects browser input missing endpoint", () => {
		const result = BrowserInputSchema.safeParse({ op: "join" });
		assert.strictEqual(result.success, false);
	});
});

describe("poppy browser - buildBrowserHeaders", () => {
	it("includes Poppy-Version header", () => {
		const headers = buildBrowserHeaders({});
		assert.strictEqual(headers["Poppy-Version"], "1.0");
	});

	it("includes Poppy-Session header when session provided", () => {
		const headers = buildBrowserHeaders({ session: "jwt" });
		assert.strictEqual(headers["Poppy-Session"], "jwt");
	});

	it("includes access token as bearer", () => {
		const headers = buildBrowserHeaders({ accessToken: "token" });
		assert.strictEqual(headers.authorization, "Bearer token");
	});

	it("omits access token when absent", () => {
		const headers = buildBrowserHeaders({});
		assert.strictEqual(headers.authorization, undefined);
	});
});

describe("poppy browser - hasBrowserSignInScope", () => {
	it("returns true when the scope is present", () => {
		assert.strictEqual(hasBrowserSignInScope("openid poppy:browser-sign-in"), true);
	});

	it("returns false when the scope is absent", () => {
		assert.strictEqual(hasBrowserSignInScope("openid"), false);
	});

	it("returns false when scope is undefined", () => {
		assert.strictEqual(hasBrowserSignInScope(undefined), false);
	});
});

describe("poppy browser - authorizeCode", () => {
	it("authorizes the code with POST to {endpoint}/authorize", async () => {
		mock.method(global, "fetch", async (url, init) => {
			assert.strictEqual(String(url), "https://example.com/session/authorize");
			assert.strictEqual(init.method, "POST");
			assert.strictEqual(init.headers["Poppy-Session"], "jwt");
			const body = JSON.parse(init.body);
			assert.strictEqual(body.code, "abc123");
			return { ok: true, status: 200, json: async () => ({ ok: true }) };
		});
		const result = await authorizeCode({
			endpoint: "https://example.com/session",
			code: "abc123",
			session: "jwt",
		});
		assert.strictEqual(result.ok, true);
	});

	it("reports a missing endpoint", async () => {
		const result = await authorizeCode({ code: "abc123" });
		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.error, "endpoint is required");
	});

	it("reports a missing code", async () => {
		const result = await authorizeCode({ endpoint: "https://example.com/session" });
		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.error, "code is required");
	});

	it("rejects a non-HTTPS endpoint", async () => {
		const result = await authorizeCode({
			endpoint: "http://example.com/session",
			code: "abc123",
		});
		assert.strictEqual(result.ok, false);
	});
});

describe("poppy browser - readCodeFromPage", () => {
	it("reads the code from a data-poppy-code element", async () => {
		const page = {
			evaluate: async () => "code-123",
		};
		const result = await readCodeFromPage(page);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.code, "code-123");
	});

	it("reports when no code is found", async () => {
		const page = {
			evaluate: async () => "",
		};
		const result = await readCodeFromPage(page);
		assert.strictEqual(result.ok, false);
	});

	it("reports an error when the page evaluate throws", async () => {
		const page = {
			evaluate: async () => {
				throw new Error("boom");
			},
		};
		const result = await readCodeFromPage(page);
		assert.strictEqual(result.ok, false);
	});
});

describe("poppy browser - submitFormAndBrowse", () => {
	it("submits the form and browses the website", async () => {
		let submitted = false;
		const page = {
			evaluate: async () => {
				submitted = true;
			},
			goto: async () => {},
		};
		const result = await submitFormAndBrowse(page, "https://example.com");
		assert.strictEqual(result.ok, true);
		assert.strictEqual(submitted, true);
	});

	it("reports an error when the form submission fails", async () => {
		const page = {
			evaluate: async () => {
				throw new Error("boom");
			},
		};
		const result = await submitFormAndBrowse(page);
		assert.strictEqual(result.ok, false);
	});
});

describe("poppy browser - joinBrowserSession", () => {
	it("joins a browser session end to end", async () => {
		const page = {
			goto: async () => {},
			evaluate: async () => "code-123",
		};
		const browser = {
			close: async () => {},
		};
		mock.method(global, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => ({ ok: true }),
		}));
		const result = await joinBrowserSession(
			{
				op: "join",
				endpoint: "https://example.com/session",
				session: "jwt",
			},
			{
				launchBrowser: async () => browser,
				openPage: async () => page,
				websiteUrl: "https://example.com",
			},
		);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.joined, true);
	});

	it("rejects when web browsing is disabled", async () => {
		const result = await joinBrowserSession({
			op: "join",
			endpoint: "https://example.com/session",
			disabled: true,
		});
		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.error, "Web browsing is disabled for this company");
	});

	it("rejects when the access token lacks the browser-sign-in scope", async () => {
		const result = await joinBrowserSession({
			op: "join",
			endpoint: "https://example.com/session",
			accessToken: "token",
			scope: "openid",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("poppy:browser-sign-in"));
	});

	it("proceeds without the scope when unscoped", async () => {
		const page = {
			goto: async () => {},
			evaluate: async () => "code-123",
		};
		const browser = {
			close: async () => {},
		};
		mock.method(global, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => ({ ok: true }),
		}));
		const result = await joinBrowserSession(
			{
				op: "join",
				endpoint: "https://example.com/session",
				accessToken: "token",
				scope: "openid",
				unscoped: true,
			},
			{
				launchBrowser: async () => browser,
				openPage: async () => page,
			},
		);
		assert.strictEqual(result.ok, true);
	});

	it("reports a missing endpoint", async () => {
		const result = await joinBrowserSession({ op: "join" });
		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.error, "endpoint is required");
	});
});

describe("poppy browser - execute", () => {
	it("dispatches the join op", async () => {
		const page = {
			goto: async () => {},
			evaluate: async () => "code-123",
		};
		const browser = {
			close: async () => {},
		};
		mock.method(global, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => ({ ok: true }),
		}));
		const result = await execute(
			{
				op: "join",
				endpoint: "https://example.com/session",
			},
			{
				launchBrowser: async () => browser,
				openPage: async () => page,
			},
		);
		assert.strictEqual(result.ok, true);
	});

	it("returns an error for an unknown op", async () => {
		const result = await execute({ op: "unknown", endpoint: "https://example.com/session" });
		assert.strictEqual(result.ok, false);
	});

	it("returns an error for invalid input", async () => {
		const result = await execute({ endpoint: "https://example.com/session" });
		assert.strictEqual(result.ok, false);
	});
});

describe("poppy browser - tool registration", () => {
	it("registers the browser action in the poppy tool ACTIONS registry", async () => {
		const { ACTIONS } = await import("../../../../src/tools/poppy/index.js");
		assert.ok(ACTIONS.browser);
		assert.strictEqual(typeof ACTIONS.browser.execute, "function");
	});

	it("accepts a browser action in the poppy tool schema", async () => {
		const { poppySchema } = await import("../../../../src/tools/poppy/index.js");
		const result = poppySchema.safeParse({
			action: "browser",
			op: "join",
			endpoint: "https://example.com/session",
			session: "jwt",
			accessToken: "tok",
			scope: "poppy:browser-sign-in",
		});
		assert.strictEqual(result.success, true);
	});

	it("requires op for the browser action", async () => {
		const { poppySchema } = await import("../../../../src/tools/poppy/index.js");
		const result = poppySchema.safeParse({
			action: "browser",
			endpoint: "https://example.com/session",
		});
		assert.strictEqual(result.success, false);
	});
});
