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
	authorize,
	getAuthPrompt,
	createCopilotFetch,
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

describe("authorize", () => {
	it("surfaces the verification URL and code, then persists the token", async () => {
		const origFetch = globalThis.fetch;
		let call = 0;
		globalThis.fetch = async () => {
			call += 1;
			if (call === 1) {
				return new Response(
					JSON.stringify({
						device_code: "dc",
						user_code: "ABCD-1234",
						verification_uri: "https://github.com/login/device",
						interval: 5,
					}),
					{ status: 200 },
				);
			}
			return new Response(JSON.stringify({ access_token: "tok-xyz" }), { status: 200 });
		};
		try {
			const statuses = [];
			const result = await authorize({
				domain: "github.com",
				memoryDir,
				onStatus: (s) => statuses.push(s),
			});
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.userCode, "ABCD-1234");
			assert.strictEqual(result.verificationUri, "https://github.com/login/device");
			assert.strictEqual(statuses.length, 1);
			assert.strictEqual(statuses[0].userCode, "ABCD-1234");
			assert.strictEqual(await getToken(memoryDir), "tok-xyz");
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

describe("createCopilotFetch", () => {
	it("injects the bearer token from the auth file", async () => {
		await persist("tok-bearer", memoryDir);
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
			assert.strictEqual(capturedHeaders.get("Authorization"), "Bearer tok-bearer");
		} finally {
			globalThis.fetch = origFetch;
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
});
