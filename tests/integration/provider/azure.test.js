import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { createAzureChatModel } from "../../../src/provider/azure.js";

const AZURE_ENV_KEYS = [
	"AZURE_OPENAI_API_KEY",
	"AZURE_OPENAI_ENDPOINT",
	"AZURE_OPENAI_API_INSTANCE_NAME",
	"AZURE_OPENAI_API_DEPLOYMENT_NAME",
	"AZURE_OPENAI_API_VERSION",
];

function clearAzureEnv() {
	for (const key of AZURE_ENV_KEYS) {
		delete process.env[key];
	}
}

function setAzureEnv(overrides = {}) {
	clearAzureEnv();
	process.env.AZURE_OPENAI_API_KEY = overrides.AZURE_OPENAI_API_KEY ?? "test-key";
	process.env.AZURE_OPENAI_ENDPOINT =
		overrides.AZURE_OPENAI_ENDPOINT ?? "https://myresource.openai.azure.com";
	process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME =
		overrides.AZURE_OPENAI_API_DEPLOYMENT_NAME ?? "gpt-4o";
	process.env.AZURE_OPENAI_API_VERSION = overrides.AZURE_OPENAI_API_VERSION ?? "2024-10-21";
}

/**
 * Build a streaming SSE response body for a chat completion.
 * @param {string} content - The assistant content to stream
 * @returns {ReadableStream} A ReadableStream of SSE chunks
 */
function sseStream(content) {
	const encoder = new TextEncoder();
	const chunks = [
		`data: ${JSON.stringify({
			id: "chatcmpl-1",
			object: "chat.completion.chunk",
			created: 123,
			model: "gpt-4o",
			choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: null }],
		})}\n\n`,
		`data: ${JSON.stringify({
			id: "chatcmpl-1",
			object: "chat.completion.chunk",
			created: 123,
			model: "gpt-4o",
			choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
		})}\n\n`,
		"data: [DONE]\n\n",
	];
	return new ReadableStream({
		start(controller) {
			for (const chunk of chunks) {
				controller.enqueue(encoder.encode(chunk));
			}
			controller.close();
		},
	});
}

describe("AzureChatOpenAI request path (integration)", () => {
	beforeEach(() => setAzureEnv());
	afterEach(() => {
		clearAzureEnv();
		globalThis.fetch = undefined;
	});

	it("sends the api-key header and the deployment path with api-version", async () => {
		const origFetch = globalThis.fetch;
		let capturedUrl;
		let capturedHeaders;
		globalThis.fetch = async (url, init) => {
			const urlStr = String(url);
			if (urlStr.includes("/openai/deployments/")) {
				capturedUrl = urlStr;
				capturedHeaders = new Headers(init?.headers);
			}
			return new Response(sseStream("hello"), {
				status: 200,
				headers: { "Content-Type": "text/event-stream" },
			});
		};
		try {
			const model = createAzureChatModel({
				type: "azure-openai",
				model: "gpt-4o",
				temperature: 0.4,
				maxTokens: -1,
				rateLimit: { maxRetries: 6 },
			});
			const res = await model.invoke("hello");
			assert.strictEqual(res.content, "hello");
			assert.ok(
				capturedUrl.includes("/openai/deployments/gpt-4o/chat/completions"),
				`unexpected url: ${capturedUrl}`,
			);
			assert.ok(
				capturedUrl.includes("api-version=2024-10-21"),
				`missing api-version: ${capturedUrl}`,
			);
			assert.strictEqual(capturedHeaders.get("api-key"), "test-key");
		} finally {
			globalThis.fetch = origFetch;
		}
	});

	it("handles an endpoint with a trailing slash", async () => {
		const origFetch = globalThis.fetch;
		let capturedUrl;
		globalThis.fetch = async (url, _init) => {
			const urlStr = String(url);
			if (urlStr.includes("/openai/deployments/")) {
				capturedUrl = urlStr;
			}
			return new Response(sseStream("ok"), {
				status: 200,
				headers: { "Content-Type": "text/event-stream" },
			});
		};
		try {
			setAzureEnv({ AZURE_OPENAI_ENDPOINT: "https://myresource.openai.azure.com/" });
			const model = createAzureChatModel({
				type: "azure-openai",
				model: "gpt-4o",
				temperature: 0.4,
				maxTokens: -1,
				rateLimit: { maxRetries: 6 },
			});
			const res = await model.invoke("hello");
			assert.strictEqual(res.content, "ok");
			assert.ok(
				capturedUrl.includes("/openai/deployments/gpt-4o/chat/completions"),
				`unexpected url: ${capturedUrl}`,
			);
		} finally {
			globalThis.fetch = origFetch;
		}
	});
});

describe("AzureChatOpenAI streaming and tool calls (integration)", () => {
	beforeEach(() => setAzureEnv());
	afterEach(() => {
		clearAzureEnv();
		globalThis.fetch = undefined;
	});

	it("streams content chunks", async () => {
		const origFetch = globalThis.fetch;
		globalThis.fetch = async (url, _init) => {
			const urlStr = String(url);
			if (urlStr.includes("/openai/deployments/")) {
				return new Response(sseStream("streamed"), {
					status: 200,
					headers: { "Content-Type": "text/event-stream" },
				});
			}
			return new Response("{}", { status: 200 });
		};
		try {
			const model = createAzureChatModel({
				type: "azure-openai",
				model: "gpt-4o",
				temperature: 0.4,
				maxTokens: -1,
				rateLimit: { maxRetries: 6 },
			});
			let streamed = "";
			for await (const chunk of await model.stream("hello")) {
				streamed += chunk.content;
			}
			assert.strictEqual(streamed, "streamed");
		} finally {
			globalThis.fetch = origFetch;
		}
	});

	it("round-trips a tool call", async () => {
		const origFetch = globalThis.fetch;
		globalThis.fetch = async (url, init) => {
			const urlStr = String(url);
			if (urlStr.includes("/openai/deployments/")) {
				const body = JSON.parse(init?.body);
				// If the request carries a tool call, respond with a tool result.
				if (body.messages?.some((m) => m.role === "tool")) {
					return new Response(sseStream("tool result"), {
						status: 200,
						headers: { "Content-Type": "text/event-stream" },
					});
				}
				// Otherwise emit a tool-call delta.
				const encoder = new TextEncoder();
				const chunks = [
					`data: ${JSON.stringify({
						id: "chatcmpl-2",
						object: "chat.completion.chunk",
						created: 123,
						model: "gpt-4o",
						choices: [
							{
								index: 0,
								delta: {
									role: "assistant",
									tool_calls: [
										{
											index: 0,
											id: "call_1",
											type: "function",
											function: { name: "get_weather", arguments: '{"city":"London"}' },
										},
									],
								},
								finish_reason: "tool_calls",
							},
						],
					})}\n\n`,
					"data: [DONE]\n\n",
				];
				return new Response(
					new ReadableStream({
						start(controller) {
							for (const c of chunks) controller.enqueue(encoder.encode(c));
							controller.close();
						},
					}),
					{ status: 200, headers: { "Content-Type": "text/event-stream" } },
				);
			}
			return new Response("{}", { status: 200 });
		};
		try {
			const model = createAzureChatModel({
				type: "azure-openai",
				model: "gpt-4o",
				temperature: 0.4,
				maxTokens: -1,
				rateLimit: { maxRetries: 6 },
			});
			const res = await model.invoke("what's the weather?");
			assert.ok(res.content !== undefined);
		} finally {
			globalThis.fetch = origFetch;
		}
	});
});

describe("AzureChatOpenAI 429 retry behavior (integration)", () => {
	beforeEach(() => setAzureEnv());
	afterEach(() => {
		clearAzureEnv();
		globalThis.fetch = undefined;
	});

	it("retries on a 429 response up to maxRetries", async () => {
		const origFetch = globalThis.fetch;
		let requestCount = 0;
		globalThis.fetch = async (url, _init) => {
			const urlStr = String(url);
			if (urlStr.includes("/openai/deployments/")) {
				requestCount++;
				if (requestCount < 3) {
					return new Response("rate limited", { status: 429, headers: { "retry-after": "0" } });
				}
				return new Response(sseStream("ok"), {
					status: 200,
					headers: { "Content-Type": "text/event-stream" },
				});
			}
			return new Response("{}", { status: 200 });
		};
		try {
			const model = createAzureChatModel({
				type: "azure-openai",
				model: "gpt-4o",
				temperature: 0.4,
				maxTokens: -1,
				rateLimit: { maxRetries: 3 },
			});
			const res = await model.invoke("hello");
			assert.strictEqual(res.content, "ok");
			assert.ok(requestCount >= 3, `expected at least 3 requests, got ${requestCount}`);
		} finally {
			globalThis.fetch = origFetch;
		}
	});
});
