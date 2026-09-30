import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createImageDispatchMiddleware } from "../../src/provider/imageDispatchMiddleware.js";

/**
 * Runtime probe for the dispatch acceptance criterion: when a user prompt
 * triggers a `readImage` tool call, the `ImageDispatch` middleware must inject
 * a multimodal HumanMessage (text + image_url) into the next model request.
 *
 * We drive a REAL `createAgent` with a REAL `ChatOpenAI` and a mocked fetch.
 * The agent's first turn calls `readImage` (returning base64 + MIME), and the
 * second model request must contain the image content block. The middleware
 * observes the `readImage` ToolMessage and injects the HumanMessage before the
 * handler (the model call) runs.
 */
describe("integration - image dispatch middleware injects vision input", () => {
	let originalFetch;
	let fetchCalls;
	let lastRequestBody;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		fetchCalls = 0;
		lastRequestBody = null;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	const completion = (content = "hi") =>
		new Response(
			JSON.stringify({
				id: "x",
				object: "chat.completion",
				created: 0,
				model: "gpt-4o",
				choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
				usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
			}),
			{ status: 200, headers: { "content-type": "application/json" } },
		);

	const toolCallCompletion = () =>
		new Response(
			JSON.stringify({
				id: "x",
				object: "chat.completion",
				created: 0,
				model: "gpt-4o",
				choices: [
					{
						index: 0,
						message: {
							role: "assistant",
							content: null,
							tool_calls: [
								{
									id: "call_1",
									type: "function",
									function: {
										name: "readImage",
										arguments: JSON.stringify({ path: "/tmp/screenshot.png" }),
									},
								},
							],
						},
						finish_reason: "tool_calls",
					},
				],
				usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
			}),
			{ status: 200, headers: { "content-type": "application/json" } },
		);

	const stubFetch = () => {
		globalThis.fetch = async (url, init) => {
			fetchCalls += 1;
			lastRequestBody = JSON.parse(init?.body ?? "{}");
			// First request: the model decides to call readImage. Subsequent
			// requests: the model returns a final answer.
			return fetchCalls === 1 ? toolCallCompletion() : completion();
		};
	};

	const makeModel = () =>
		new ChatOpenAI({
			model: "gpt-4o",
			apiKey: "sk-test",
			configuration: { baseURL: "http://127.0.0.1:9/v1" },
			maxRetries: 0,
		});

	const makeReadImageTool = () =>
		tool(
			() =>
				JSON.stringify({
					ok: true,
					mimeType: "image/png",
					data: "iVBORw0KGgo=",
				}),
			{
				name: "readImage",
				description: "Read an image file and return base64 + MIME type",
				schema: z.object({ path: z.string() }),
			},
		);

	it("injects the image content block into the next model request", async () => {
		stubFetch();
		const mw = createImageDispatchMiddleware();

		const agent = createAgent({
			model: makeModel(),
			tools: [makeReadImageTool()],
			middleware: [mw],
		});

		// First turn: the agent calls readImage, then the middleware injects the
		// image HumanMessage on the next model request.
		await agent.invoke({ messages: [{ role: "user", content: "analyze this screenshot" }] });

		assert.ok(fetchCalls >= 1, "expected at least one model request");
		assert.ok(lastRequestBody, "expected a captured request body");

		// The last model request should contain a multimodal content block with
		// an image_url carrying the data URI.
		const messages = lastRequestBody.messages ?? [];
		const hasImageBlock = messages.some((msg) =>
			Array.isArray(msg.content)
				? msg.content.some(
						(block) =>
							block.type === "image_url" &&
							block.image_url?.url === "data:image/png;base64,iVBORw0KGgo=",
					)
				: false,
		);
		assert.ok(hasImageBlock, "expected the model request to contain the image content block");
	});
});
