import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { joinBrowserSession } from "../../../../src/tools/poppy/browser.js";

describe("poppy browser - integration join flow", () => {
	it("runs the join flow against a mock browser-session endpoint", async () => {
		const page = {
			goto: async (url) => {
				assert.ok(
					String(url) === "https://example.com/session" || String(url) === "https://example.com",
				);
			},
			evaluate: async () => "one-time-code-123",
		};
		const browser = {
			close: async () => {},
		};
		let authorizeCalled = false;
		mock.method(global, "fetch", async (url, init) => {
			assert.strictEqual(String(url), "https://example.com/session/authorize");
			assert.strictEqual(init.method, "POST");
			assert.strictEqual(init.headers["Poppy-Session"], "jwt");
			const body = JSON.parse(init.body);
			assert.strictEqual(body.code, "one-time-code-123");
			authorizeCalled = true;
			return { ok: true, status: 200, json: async () => ({ ok: true }) };
		});

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
		assert.strictEqual(authorizeCalled, true);
	});

	it("returns an error when the authorize endpoint rejects an expired code", async () => {
		const page = {
			goto: async () => {},
			evaluate: async () => "expired-code",
		};
		const browser = {
			close: async () => {},
		};
		mock.method(global, "fetch", async () => ({
			ok: false,
			status: 400,
			json: async () => ({ error: "code_expired" }),
		}));

		const result = await joinBrowserSession(
			{
				op: "join",
				endpoint: "https://example.com/session",
			},
			{
				launchBrowser: async () => browser,
				openPage: async () => page,
			},
		);

		assert.strictEqual(result.ok, false);
	});
});
