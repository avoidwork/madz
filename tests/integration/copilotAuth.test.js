import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { createChatModel } from "../../src/provider/openai.js";
import {
	persist,
	clearToken,
	getToken,
	createCopilotFetch,
	setAuthRequiredHandler,
} from "../../src/provider/copilotAuth.js";

// `createChatModel` wires `createCopilotFetch()` with the default auth file path
// (`memory/auth.json`, gitignored). These integration tests exercise the real
// model path, so they persist/clear the token at the default location.
beforeEach(async () => {
	await clearToken();
});

afterEach(async () => {
	await clearToken();
	setAuthRequiredHandler(null);
});

describe("Copilot model request carries bearer token (integration)", () => {
	it("injects Authorization: Bearer <token> on a request to the Copilot API", async () => {
		await persist("tok-bearer");
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
			return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		};
		try {
			const model = createChatModel({
				type: "github-copilot",
				model: "gpt-4o",
				base_url: "https://api.githubcopilot.com",
				temperature: 0.4,
				maxTokens: -1,
				rateLimit: { maxRetries: 6 },
			});
			// The model's clientConfig.fetch is the interceptor; drive it directly
			// to verify the exchanged bearer token is injected on the outbound request.
			const res = await model.clientConfig.fetch(
				"https://api.githubcopilot.com/v1/chat/completions",
				{ method: "POST" },
			);
			assert.strictEqual(res.status, 200);
			assert.strictEqual(capturedUrl, "https://api.githubcopilot.com/v1/chat/completions");
			assert.strictEqual(capturedHeaders.get("Authorization"), "Bearer short-lived");
		} finally {
			globalThis.fetch = origFetch;
		}
	});

	it("does not send the placeholder apiKey as the Authorization header", async () => {
		await persist("tok-bearer");
		const origFetch = globalThis.fetch;
		let capturedHeaders;
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
			capturedHeaders = new Headers(init.headers);
			return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		};
		try {
			const model = createChatModel({
				type: "github-copilot",
				model: "gpt-4o",
				base_url: "https://api.githubcopilot.com",
				temperature: 0.4,
				maxTokens: -1,
				rateLimit: { maxRetries: 6 },
			});
			await model.clientConfig.fetch("https://api.githubcopilot.com/v1/chat/completions", {
				method: "POST",
			});
			// The placeholder apiKey ("copilot") must never be sent as the
			// Authorization header; the exchanged bearer token is used instead.
			assert.strictEqual(capturedHeaders.get("Authorization"), "Bearer short-lived");
			assert.notStrictEqual(capturedHeaders.get("Authorization"), "Bearer copilot");
		} finally {
			globalThis.fetch = origFetch;
		}
	});

	it("omits the Authorization header when no token is present", async () => {
		const origFetch = globalThis.fetch;
		let capturedHeaders;
		globalThis.fetch = async (_url, init) => {
			capturedHeaders = new Headers(init.headers);
			return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		};
		try {
			const model = createChatModel({
				type: "github-copilot",
				model: "gpt-4o",
				base_url: "https://api.githubcopilot.com",
				temperature: 0.4,
				maxTokens: -1,
				rateLimit: { maxRetries: 6 },
			});
			await model.clientConfig.fetch("https://api.githubcopilot.com/v1/chat/completions", {
				method: "POST",
			});
			assert.strictEqual(capturedHeaders.get("Authorization"), null);
		} finally {
			globalThis.fetch = origFetch;
		}
	});

	it("clears the token and fires the re-auth handler on a 401", async () => {
		await persist("tok-expired");
		const origFetch = globalThis.fetch;
		let handlerCalled = false;
		globalThis.fetch = async () => new Response("unauthorized", { status: 401 });
		setAuthRequiredHandler(() => {
			handlerCalled = true;
		});
		try {
			const copilotFetch = createCopilotFetch();
			const res = await copilotFetch("https://api.githubcopilot.com/v1/chat/completions", {
				method: "POST",
			});
			assert.strictEqual(res.status, 401);
			assert.strictEqual(handlerCalled, true);
			assert.strictEqual(await getToken(), null);
		} finally {
			globalThis.fetch = origFetch;
		}
	});

	it("derives the enterprise base URL for GHEC and sends the bearer token", async () => {
		await persist("tok-ghec");
		const origFetch = globalThis.fetch;
		let capturedUrl;
		let capturedHeaders;
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
			return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		};
		try {
			const model = createChatModel({
				type: "github-copilot",
				model: "gpt-4o",
				base_url: "https://api.githubcopilot.com",
				enterpriseUrl: "https://ghe.example.com/",
				temperature: 0.4,
				maxTokens: -1,
				rateLimit: { maxRetries: 6 },
			});
			assert.strictEqual(model.clientConfig.baseURL, "https://copilot-api.ghe.example.com");
			await model.clientConfig.fetch("https://copilot-api.ghe.example.com/v1/chat/completions", {
				method: "POST",
			});
			assert.strictEqual(capturedUrl, "https://copilot-api.ghe.example.com/v1/chat/completions");
			assert.strictEqual(capturedHeaders.get("Authorization"), "Bearer short-lived");
		} finally {
			globalThis.fetch = origFetch;
		}
	});
});
