import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	normalizeDomain,
	getUrls,
	base,
	authFilePath,
	getToken,
	persist,
	clearToken,
	requestDeviceCode,
	pollForToken,
	getAuthPrompt,
	createCopilotFetch,
	setAuthRequiredHandler,
	exchangeCopilotToken,
	clearExchangeCache,
	CLIENT_ID,
} from "../../../src/provider/copilotAuth.js";

/** @type {string} */
let tmp;
/** @type {string} */
let memoryDir;

beforeEach(async () => {
	tmp = await mkdtemp(join(tmpdir(), "copilot-auth-"));
	memoryDir = join(tmp, "memory");
});

afterEach(async () => {
	await rm(tmp, { recursive: true, force: true });
});

describe("normalizeDomain", () => {
	it("strips scheme and trailing slash", () => {
		assert.strictEqual(normalizeDomain("https://github.com/"), "github.com");
		assert.strictEqual(normalizeDomain("http://ghe.example.com/"), "ghe.example.com");
	});

	it("defaults to github.com when empty", () => {
		assert.strictEqual(normalizeDomain(""), "github.com");
		assert.strictEqual(normalizeDomain(undefined), "github.com");
	});
});

describe("getUrls", () => {
	it("builds device-code and token endpoints", () => {
		const urls = getUrls("github.com");
		assert.strictEqual(urls.deviceCodeUrl, "https://github.com/login/device/code");
		assert.strictEqual(urls.tokenUrl, "https://github.com/login/oauth/access_token");
	});

	it("normalizes a full URL domain", () => {
		const urls = getUrls("https://ghe.example.com/");
		assert.strictEqual(urls.deviceCodeUrl, "https://ghe.example.com/login/device/code");
	});
});

describe("base", () => {
	it("returns the default Copilot API base URL when no enterprise URL", () => {
		assert.strictEqual(base(), "https://api.githubcopilot.com");
		assert.strictEqual(base(undefined), "https://api.githubcopilot.com");
	});

	it("builds an enterprise API base URL from a GHE host", () => {
		assert.strictEqual(base("https://ghe.example.com/"), "https://ghe.example.com/api/v1");
	});
});

describe("authFilePath", () => {
	it("defaults to memory/auth.json", () => {
		assert.strictEqual(authFilePath(), "memory/auth.json");
	});

	it("joins a memory directory", () => {
		assert.strictEqual(authFilePath("memory/"), "memory/auth.json");
	});
});

describe("persist / getToken / clearToken", () => {
	it("persists the token with mode 0o600", async () => {
		await persist("tok-123", memoryDir);
		const file = authFilePath(memoryDir);
		const st = await stat(file);
		// 0o600 = 384 decimal
		assert.strictEqual(st.mode & 0o777, 0o600);
		const raw = JSON.parse(await readFile(file, "utf8"));
		assert.strictEqual(raw.access_token, "tok-123");
		assert.strictEqual(raw.expires, 0);
	});

	it("getToken returns the stored token", async () => {
		await persist("tok-123", memoryDir);
		assert.strictEqual(await getToken(memoryDir), "tok-123");
	});

	it("getToken returns null when no file exists", async () => {
		assert.strictEqual(await getToken(memoryDir), null);
	});

	it("clearToken removes the file", async () => {
		await persist("tok-123", memoryDir);
		await clearToken(memoryDir);
		assert.strictEqual(await getToken(memoryDir), null);
	});

	it("clearToken is a no-op when the file is missing", async () => {
		await clearToken(memoryDir);
		assert.strictEqual(await getToken(memoryDir), null);
	});
});

describe("requestDeviceCode", () => {
	it("POSTs the device-code request with client_id and scope", async () => {
		const calls = [];
		const origFetch = globalThis.fetch;
		globalThis.fetch = async (url, init) => {
			calls.push({ url, init });
			return new Response(
				JSON.stringify({
					device_code: "dc",
					user_code: "ABCD-1234",
					verification_uri: "https://github.com/login/device",
					interval: 5,
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		};
		try {
			const result = await requestDeviceCode({ domain: "github.com" });
			assert.strictEqual(result.device_code, "dc");
			assert.strictEqual(calls.length, 1);
			assert.strictEqual(calls[0].url, "https://github.com/login/device/code");
			const headers = new Headers(calls[0].init.headers);
			assert.strictEqual(headers.get("Accept"), "application/json");
			const body = new URLSearchParams(calls[0].init.body);
			assert.strictEqual(body.get("client_id"), CLIENT_ID);
			assert.strictEqual(body.get("scope"), "read:user");
		} finally {
			globalThis.fetch = origFetch;
		}
	});

	it("throws on a non-ok response", async () => {
		const origFetch = globalThis.fetch;
		globalThis.fetch = async () => new Response("nope", { status: 500 });
		try {
			await assert.rejects(() => requestDeviceCode({ domain: "github.com" }));
		} finally {
			globalThis.fetch = origFetch;
		}
	});

	it("throws on invalid JSON in a 200 response", async () => {
		const origFetch = globalThis.fetch;
		globalThis.fetch = async () => new Response("device_code=not-json", { status: 200 });
		try {
			await assert.rejects(() => requestDeviceCode({ domain: "github.com" }));
		} finally {
			globalThis.fetch = origFetch;
		}
	});

	it("honors deploymentType as the domain", async () => {
		const calls = [];
		const origFetch = globalThis.fetch;
		globalThis.fetch = async (url, init) => {
			calls.push({ url, init });
			return new Response(
				JSON.stringify({
					device_code: "dc",
					user_code: "ABCD-1234",
					verification_uri: "https://github.com/login/device",
					interval: 5,
				}),
				{ status: 200 },
			);
		};
		try {
			await requestDeviceCode({ deploymentType: "github.com" });
			assert.strictEqual(calls[0].url, "https://github.com/login/device/code");
		} finally {
			globalThis.fetch = origFetch;
		}
	});
});

describe("pollForToken", () => {
	it("persists the token on access_token", async () => {
		const origFetch = globalThis.fetch;
		globalThis.fetch = async () =>
			new Response(JSON.stringify({ access_token: "tok-abc" }), { status: 200 });
		try {
			const result = await pollForToken(
				{ device_code: "dc", interval: 5 },
				{ domain: "github.com", memoryDir },
			);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.token, "tok-abc");
			assert.strictEqual(await getToken(memoryDir), "tok-abc");
		} finally {
			globalThis.fetch = origFetch;
		}
	});

	it("returns a failure on an unexpected error", async () => {
		const origFetch = globalThis.fetch;
		globalThis.fetch = async () =>
			new Response(JSON.stringify({ error: "access_denied" }), { status: 200 });
		try {
			const result = await pollForToken(
				{ device_code: "dc", interval: 5 },
				{ domain: "github.com", memoryDir },
			);
			assert.strictEqual(result.ok, false);
			assert.strictEqual(result.error, "access_denied");
		} finally {
			globalThis.fetch = origFetch;
		}
	});

	it("returns a failure on invalid JSON from the token endpoint", async () => {
		const origFetch = globalThis.fetch;
		globalThis.fetch = async () => new Response("not-json", { status: 200 });
		try {
			const result = await pollForToken(
				{ device_code: "dc", interval: 5 },
				{ domain: "github.com", memoryDir },
			);
			assert.strictEqual(result.ok, false);
			assert.match(result.error, /invalid JSON/);
		} finally {
			globalThis.fetch = origFetch;
		}
	});

	it("retries on authorization_pending then succeeds", async () => {
		const origFetch = globalThis.fetch;
		let call = 0;
		globalThis.fetch = async () => {
			call += 1;
			if (call === 1) {
				return new Response(JSON.stringify({ error: "authorization_pending" }), {
					status: 200,
				});
			}
			return new Response(JSON.stringify({ access_token: "tok-pending" }), { status: 200 });
		};
		try {
			const result = await pollForToken(
				{ device_code: "dc", interval: 0 },
				{ domain: "github.com", memoryDir, pollSafetyMs: 0 },
			);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.token, "tok-pending");
			assert.strictEqual(call, 2);
		} finally {
			globalThis.fetch = origFetch;
		}
	});

	it("retries on slow_down then succeeds", async () => {
		const origFetch = globalThis.fetch;
		let call = 0;
		globalThis.fetch = async () => {
			call += 1;
			if (call === 1) {
				return new Response(JSON.stringify({ error: "slow_down" }), { status: 200 });
			}
			return new Response(JSON.stringify({ access_token: "tok-slow" }), { status: 200 });
		};
		try {
			const result = await pollForToken(
				{ device_code: "dc", interval: 0 },
				{ domain: "github.com", memoryDir, pollSafetyMs: 0 },
			);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.token, "tok-slow");
			assert.strictEqual(call, 2);
		} finally {
			globalThis.fetch = origFetch;
		}
	});

	it("times out after maxPollAttempts", async () => {
		const origFetch = globalThis.fetch;
		globalThis.fetch = async () =>
			new Response(JSON.stringify({ error: "authorization_pending" }), { status: 200 });
		try {
			const result = await pollForToken(
				{ device_code: "dc", interval: 0 },
				{ domain: "github.com", memoryDir, pollSafetyMs: 0, maxPollAttempts: 3 },
			);
			assert.strictEqual(result.ok, false);
			assert.strictEqual(result.error, "Polling timed out");
		} finally {
			globalThis.fetch = origFetch;
		}
	});
});

describe("getAuthPrompt", () => {
	it("returns the verification URL and user code when no token is present", async () => {
		const origFetch = globalThis.fetch;
		globalThis.fetch = async () =>
			new Response(
				JSON.stringify({
					device_code: "dc",
					user_code: "ABCD-1234",
					verification_uri: "https://github.com/login/device",
					interval: 5,
				}),
				{ status: 200 },
			);
		try {
			const prompt = await getAuthPrompt({ domain: "github.com", memoryDir });
			assert.ok(prompt);
			assert.strictEqual(prompt.verificationUri, "https://github.com/login/device");
			assert.strictEqual(prompt.userCode, "ABCD-1234");
			assert.strictEqual(prompt.deploymentType, "github.com");
			assert.strictEqual(prompt.deviceCode.device_code, "dc");
		} finally {
			globalThis.fetch = origFetch;
		}
	});

	it("returns null when a token is already present", async () => {
		await persist("tok-existing", memoryDir);
		const origFetch = globalThis.fetch;
		globalThis.fetch = async () => {
			throw new Error("should not be called");
		};
		try {
			const prompt = await getAuthPrompt({ domain: "github.com", memoryDir });
			assert.strictEqual(prompt, null);
		} finally {
			globalThis.fetch = origFetch;
		}
	});

	it("returns null when the device-code request fails", async () => {
		const origFetch = globalThis.fetch;
		globalThis.fetch = async () => new Response("nope", { status: 500 });
		try {
			const prompt = await getAuthPrompt({ domain: "github.com", memoryDir });
			assert.strictEqual(prompt, null);
		} finally {
			globalThis.fetch = origFetch;
		}
	});

	it("returns null when the response lacks a verification URI or code", async () => {
		const origFetch = globalThis.fetch;
		globalThis.fetch = async () =>
			new Response(JSON.stringify({ device_code: "dc" }), { status: 200 });
		try {
			const prompt = await getAuthPrompt({ domain: "github.com", memoryDir });
			assert.strictEqual(prompt, null);
		} finally {
			globalThis.fetch = origFetch;
		}
	});
});

describe("exchangeCopilotToken", () => {
	it("exchanges the OAuth token for a short-lived bearer", async () => {
		const origFetch = globalThis.fetch;
		let capturedUrl;
		let capturedHeaders;
		globalThis.fetch = async (url, init) => {
			capturedUrl = url;
			capturedHeaders = new Headers(init.headers);
			return new Response(
				JSON.stringify({
					token: "short-lived",
					expires_at: new Date(Date.now() + 60_000).toISOString(),
					endpoints: { api: "https://api.githubcopilot.com" },
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		};
		try {
			const result = await exchangeCopilotToken("oauth-token");
			assert.strictEqual(result.token, "short-lived");
			assert.strictEqual(result.api, "https://api.githubcopilot.com");
			assert.ok(result.expiresAt > Date.now());
			assert.strictEqual(capturedUrl, "https://api.githubcopilot.com/copilot_internal/v2/token");
			assert.strictEqual(capturedHeaders.get("Authorization"), "token oauth-token");
		} finally {
			globalThis.fetch = origFetch;
			clearExchangeCache();
		}
	});

	it("caches the exchanged bearer and reuses it before expiry", async () => {
		const origFetch = globalThis.fetch;
		let calls = 0;
		globalThis.fetch = async () => {
			calls += 1;
			return new Response(
				JSON.stringify({
					token: "short-lived",
					expires_at: new Date(Date.now() + 60_000).toISOString(),
				}),
				{ status: 200 },
			);
		};
		try {
			const first = await exchangeCopilotToken("oauth-token");
			const second = await exchangeCopilotToken("oauth-token");
			assert.strictEqual(first.token, "short-lived");
			assert.strictEqual(second.token, "short-lived");
			assert.strictEqual(calls, 1);
		} finally {
			globalThis.fetch = origFetch;
			clearExchangeCache();
		}
	});

	it("re-exchanges when the cached bearer has expired", async () => {
		const origFetch = globalThis.fetch;
		let calls = 0;
		globalThis.fetch = async () => {
			calls += 1;
			return new Response(
				JSON.stringify({
					token: `short-lived-${calls}`,
					expires_at:
						calls === 1
							? new Date(Date.now() - 60_000).toISOString()
							: new Date(Date.now() + 60_000).toISOString(),
				}),
				{ status: 200 },
			);
		};
		try {
			clearExchangeCache();
			const first = await exchangeCopilotToken("oauth-token");
			assert.strictEqual(first.token, "short-lived-1");
			// The cached entry is expired, so this re-exchanges.
			const result = await exchangeCopilotToken("oauth-token");
			assert.strictEqual(result.token, "short-lived-2");
			assert.strictEqual(calls, 2);
		} finally {
			globalThis.fetch = origFetch;
			clearExchangeCache();
		}
	});

	it("throws on a non-ok exchange response", async () => {
		const origFetch = globalThis.fetch;
		globalThis.fetch = async () => new Response("nope", { status: 500 });
		try {
			await assert.rejects(() => exchangeCopilotToken("oauth-token"));
		} finally {
			globalThis.fetch = origFetch;
			clearExchangeCache();
		}
	});

	it("throws on invalid JSON in the exchange response", async () => {
		const origFetch = globalThis.fetch;
		globalThis.fetch = async () => new Response("not-json", { status: 200 });
		try {
			await assert.rejects(() => exchangeCopilotToken("oauth-token"));
		} finally {
			globalThis.fetch = origFetch;
			clearExchangeCache();
		}
	});

	it("throws when the exchange response is missing a token", async () => {
		const origFetch = globalThis.fetch;
		globalThis.fetch = async () =>
			new Response(JSON.stringify({ expires_at: "2025-01-01T00:00:00Z" }), { status: 200 });
		try {
			await assert.rejects(() => exchangeCopilotToken("oauth-token"));
		} finally {
			globalThis.fetch = origFetch;
			clearExchangeCache();
		}
	});
});

describe("createCopilotFetch", () => {
	it("injects the exchanged bearer token, not the raw OAuth token", async () => {
		await persist("oauth-token", memoryDir);
		const origFetch = globalThis.fetch;
		let capturedHeaders;
		let capturedUrl;
		globalThis.fetch = async (url, init) => {
			if (url.includes("/copilot_internal/v2/token")) {
				return new Response(
					JSON.stringify({
						token: "short-lived",
						expires_at: new Date(Date.now() + 60_000).toISOString(),
					}),
					{ status: 200 },
				);
			}
			capturedUrl = url;
			capturedHeaders = new Headers(init.headers);
			return new Response("ok", { status: 200 });
		};
		try {
			const copilotFetch = createCopilotFetch(memoryDir);
			await copilotFetch("https://api.githubcopilot.com/v1/chat/completions", {
				method: "POST",
			});
			assert.strictEqual(capturedHeaders.get("Authorization"), "Bearer short-lived");
			assert.strictEqual(capturedUrl, "https://api.githubcopilot.com/v1/chat/completions");
		} finally {
			globalThis.fetch = origFetch;
			clearExchangeCache();
		}
	});

	it("omits the Authorization header when no token is present", async () => {
		const origFetch = globalThis.fetch;
		let capturedHeaders;
		globalThis.fetch = async (_input, init) => {
			capturedHeaders = new Headers(init.headers);
			return new Response("ok", { status: 200 });
		};
		try {
			const copilotFetch = createCopilotFetch(memoryDir);
			await copilotFetch("https://api.githubcopilot.com/v1/chat/completions", {
				method: "POST",
			});
			assert.strictEqual(capturedHeaders.get("Authorization"), null);
		} finally {
			globalThis.fetch = origFetch;
		}
	});

	it("clears the token and invokes the re-auth handler on 401 when re-exchange fails", async () => {
		await persist("oauth-token", memoryDir);
		const origFetch = globalThis.fetch;
		let handlerCalled = false;
		let exchangeCalls = 0;
		globalThis.fetch = async (url) => {
			if (url.includes("/copilot_internal/v2/token")) {
				exchangeCalls += 1;
				if (exchangeCalls === 1) {
					return new Response(
						JSON.stringify({
							token: "short-lived",
							expires_at: new Date(Date.now() + 60_000).toISOString(),
						}),
						{ status: 200 },
					);
				}
				// Re-exchange fails (OAuth token expired).
				return new Response("unauthorized", { status: 401 });
			}
			return new Response("unauthorized", { status: 401 });
		};
		setAuthRequiredHandler(() => {
			handlerCalled = true;
		});
		try {
			const copilotFetch = createCopilotFetch(memoryDir);
			const res = await copilotFetch("https://api.githubcopilot.com/v1/chat/completions", {
				method: "POST",
			});
			assert.strictEqual(res.status, 401);
			assert.strictEqual(handlerCalled, true);
			assert.strictEqual(await getToken(memoryDir), null);
		} finally {
			globalThis.fetch = origFetch;
			setAuthRequiredHandler(null);
			clearExchangeCache();
		}
	});

	it("re-exchanges and retries on 401 when re-exchange succeeds", async () => {
		await persist("oauth-token", memoryDir);
		const origFetch = globalThis.fetch;
		let handlerCalled = false;
		let apiCalls = 0;
		let exchangeCalls = 0;
		globalThis.fetch = async (url, _init) => {
			if (url.includes("/copilot_internal/v2/token")) {
				exchangeCalls += 1;
				return new Response(
					JSON.stringify({
						token: `short-lived-${exchangeCalls}`,
						expires_at: new Date(Date.now() + 60_000).toISOString(),
					}),
					{ status: 200 },
				);
			}
			apiCalls += 1;
			if (apiCalls === 1) {
				return new Response("unauthorized", { status: 401 });
			}
			return new Response("ok", { status: 200 });
		};
		setAuthRequiredHandler(() => {
			handlerCalled = true;
		});
		try {
			const copilotFetch = createCopilotFetch(memoryDir);
			const res = await copilotFetch("https://api.githubcopilot.com/v1/chat/completions", {
				method: "POST",
			});
			assert.strictEqual(res.status, 200);
			assert.strictEqual(handlerCalled, false);
			assert.strictEqual(apiCalls, 2);
			assert.strictEqual(exchangeCalls, 2);
		} finally {
			globalThis.fetch = origFetch;
			setAuthRequiredHandler(null);
			clearExchangeCache();
		}
	});

	it("does not invoke the re-auth handler on a non-401 response", async () => {
		await persist("oauth-token", memoryDir);
		const origFetch = globalThis.fetch;
		let handlerCalled = false;
		globalThis.fetch = async (url) => {
			if (url.includes("/copilot_internal/v2/token")) {
				return new Response(
					JSON.stringify({
						token: "short-lived",
						expires_at: new Date(Date.now() + 60_000).toISOString(),
					}),
					{ status: 200 },
				);
			}
			return new Response("ok", { status: 200 });
		};
		setAuthRequiredHandler(() => {
			handlerCalled = true;
		});
		try {
			const copilotFetch = createCopilotFetch(memoryDir);
			const res = await copilotFetch("https://api.githubcopilot.com/v1/chat/completions", {
				method: "POST",
			});
			assert.strictEqual(res.status, 200);
			assert.strictEqual(handlerCalled, false);
			assert.strictEqual(await getToken(memoryDir), "oauth-token");
		} finally {
			globalThis.fetch = origFetch;
			setAuthRequiredHandler(null);
			clearExchangeCache();
		}
	});

	it("honors endpoints.api as the base URL for API requests", async () => {
		await persist("oauth-token", memoryDir);
		const origFetch = globalThis.fetch;
		let capturedUrl;
		globalThis.fetch = async (url) => {
			if (url.includes("/copilot_internal/v2/token")) {
				return new Response(
					JSON.stringify({
						token: "short-lived",
						expires_at: new Date(Date.now() + 60_000).toISOString(),
						endpoints: { api: "https://ghe.example.com" },
					}),
					{ status: 200 },
				);
			}
			capturedUrl = url;
			return new Response("ok", { status: 200 });
		};
		try {
			const copilotFetch = createCopilotFetch(memoryDir);
			await copilotFetch("https://api.githubcopilot.com/v1/chat/completions", {
				method: "POST",
			});
			assert.strictEqual(capturedUrl, "https://ghe.example.com/v1/chat/completions");
		} finally {
			globalThis.fetch = origFetch;
			clearExchangeCache();
		}
	});

	it("rewrites the base URL when the input is a Request object", async () => {
		await persist("oauth-token", memoryDir);
		const origFetch = globalThis.fetch;
		let capturedUrl;
		globalThis.fetch = async (url) => {
			const urlStr = typeof url === "string" ? url : url.url;
			if (urlStr.includes("/copilot_internal/v2/token")) {
				return new Response(
					JSON.stringify({
						token: "short-lived",
						expires_at: new Date(Date.now() + 60_000).toISOString(),
						endpoints: { api: "https://ghe.example.com" },
					}),
					{ status: 200 },
				);
			}
			capturedUrl = urlStr;
			return new Response("ok", { status: 200 });
		};
		try {
			const copilotFetch = createCopilotFetch(memoryDir);
			const req = new Request("https://api.githubcopilot.com/v1/chat/completions", {
				method: "POST",
			});
			await copilotFetch(req);
			assert.strictEqual(capturedUrl, "https://ghe.example.com/v1/chat/completions");
		} finally {
			globalThis.fetch = origFetch;
			clearExchangeCache();
		}
	});
});
