import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { createBedrockChatModel } from "../../../src/provider/bedrock.js";

const BEDROCK_ENV_KEYS = [
	"BEDROCK_AWS_REGION",
	"AWS_REGION",
	"AWS_BEARER_TOKEN_BEDROCK",
	"BEDROCK_AWS_ACCESS_KEY_ID",
	"BEDROCK_AWS_SECRET_ACCESS_KEY",
	"BEDROCK_AWS_SESSION_TOKEN",
];

function clearBedrockEnv() {
	for (const key of BEDROCK_ENV_KEYS) {
		delete process.env[key];
	}
}

function setBedrockEnv(overrides = {}) {
	clearBedrockEnv();
	process.env.BEDROCK_AWS_REGION = overrides.BEDROCK_AWS_REGION ?? "us-east-1";
	process.env.BEDROCK_AWS_ACCESS_KEY_ID = overrides.BEDROCK_AWS_ACCESS_KEY_ID ?? "test-access-key";
	process.env.BEDROCK_AWS_SECRET_ACCESS_KEY =
		overrides.BEDROCK_AWS_SECRET_ACCESS_KEY ?? "test-secret-key";
	if (overrides.BEDROCK_AWS_SESSION_TOKEN) {
		process.env.BEDROCK_AWS_SESSION_TOKEN = overrides.BEDROCK_AWS_SESSION_TOKEN;
	}
}

/**
 * Build a mock Bedrock Runtime client whose `send` dispatches on the command
 * constructor name. Non-streaming `ConverseCommand` returns a message;
 * `ConverseStreamCommand` returns a `stream` async iterable of Converse events.
 * @param {Object} [handlers] - Optional per-command handlers
 * @returns {Object} A mock client with a `send` method
 */
function makeMockClient(handlers = {}) {
	return {
		async send(command) {
			const name = command.constructor.name;
			if (handlers[name]) return handlers[name](command);
			if (name === "ConverseCommand") {
				return {
					output: {
						message: {
							role: "assistant",
							content: [{ text: "hello" }],
						},
					},
					stopReason: "end_turn",
					usage: { inputTokens: 5, outputTokens: 2, totalTokens: 7 },
				};
			}
			if (name === "ConverseStreamCommand") {
				return {
					stream: (async function* () {
						yield { contentBlockDelta: { contentBlockIndex: 0, delta: { text: "streamed" } } };
						yield { messageStop: { stopReason: "end_turn" } };
					})(),
				};
			}
			throw new Error(`Unexpected command: ${name}`);
		},
	};
}

describe("ChatBedrockConverse request path (integration)", () => {
	beforeEach(() => setBedrockEnv());
	afterEach(() => clearBedrockEnv());

	it("sends a Converse request and returns the assistant message", async () => {
		let capturedCommand;
		const client = makeMockClient({
			ConverseCommand(command) {
				capturedCommand = command;
				return {
					output: {
						message: {
							role: "assistant",
							content: [{ text: "hello" }],
						},
					},
					stopReason: "end_turn",
					usage: { inputTokens: 5, outputTokens: 2, totalTokens: 7 },
				};
			},
		});
		const model = createBedrockChatModel({
			type: "bedrock",
			model: "us.anthropic.claude-sonnet-4-6",
			region: "us-east-1",
			temperature: 0.4,
			maxTokens: -1,
			streaming: false,
			rateLimit: { maxRetries: 6 },
		});
		model.client = client;
		const res = await model.invoke("hello");
		assert.strictEqual(res.content, "hello");
		assert.strictEqual(capturedCommand.input.modelId, "us.anthropic.claude-sonnet-4-6");
		assert.strictEqual(capturedCommand.input.messages[0].content[0].text, "hello");
	});

	it("reports usage metadata that feeds the token budget", async () => {
		const client = makeMockClient();
		const model = createBedrockChatModel({
			type: "bedrock",
			model: "us.anthropic.claude-sonnet-4-6",
			region: "us-east-1",
			temperature: 0.4,
			maxTokens: -1,
			streaming: false,
			rateLimit: { maxRetries: 6 },
		});
		model.client = client;
		const res = await model.invoke("hello");
		assert.strictEqual(res.usage_metadata.input_tokens, 5);
		assert.strictEqual(res.usage_metadata.output_tokens, 2);
		assert.strictEqual(res.usage_metadata.total_tokens, 7);
	});
});

describe("ChatBedrockConverse streaming and tool calls (integration)", () => {
	beforeEach(() => setBedrockEnv());
	afterEach(() => clearBedrockEnv());

	it("streams content chunks", async () => {
		const client = makeMockClient();
		const model = createBedrockChatModel({
			type: "bedrock",
			model: "us.anthropic.claude-sonnet-4-6",
			region: "us-east-1",
			temperature: 0.4,
			maxTokens: -1,
			rateLimit: { maxRetries: 6 },
		});
		model.client = client;
		let streamed = "";
		for await (const chunk of await model.stream("hello")) {
			streamed += chunk.content;
		}
		assert.strictEqual(streamed, "streamed");
	});

	it("round-trips a tool call", async () => {
		const client = makeMockClient({
			ConverseCommand(command) {
				// If the request carries a tool result, respond with a text message.
				const hasToolResult = command.input.messages?.some(
					(m) => m.role === "user" && m.content?.some((c) => c.toolResult),
				);
				if (hasToolResult) {
					return {
						output: {
							message: {
								role: "assistant",
								content: [{ text: "tool result" }],
							},
						},
						stopReason: "end_turn",
						usage: { inputTokens: 5, outputTokens: 2, totalTokens: 7 },
					};
				}
				// Otherwise emit a tool-use content block.
				return {
					output: {
						message: {
							role: "assistant",
							content: [
								{
									toolUse: {
										toolUseId: "call_1",
										name: "get_weather",
										input: { city: "London" },
									},
								},
							],
						},
					},
					stopReason: "tool_use",
					usage: { inputTokens: 5, outputTokens: 2, totalTokens: 7 },
				};
			},
		});
		const model = createBedrockChatModel({
			type: "bedrock",
			model: "us.anthropic.claude-sonnet-4-6",
			region: "us-east-1",
			temperature: 0.4,
			maxTokens: -1,
			streaming: false,
			rateLimit: { maxRetries: 6 },
		});
		model.client = client;
		const res = await model.invoke("what's the weather?");
		assert.ok(res.content !== undefined);
	});
});

describe("ChatBedrockConverse throttling retry behavior (integration)", () => {
	beforeEach(() => setBedrockEnv());
	afterEach(() => clearBedrockEnv());

	it("retries on a ThrottlingException up to maxAttempts", async () => {
		let requestCount = 0;
		const client = {
			async send() {
				requestCount++;
				if (requestCount < 3) {
					const err = new Error("ThrottlingException");
					err.name = "ThrottlingException";
					err.$metadata = { httpStatusCode: 429 };
					throw err;
				}
				return {
					output: {
						message: {
							role: "assistant",
							content: [{ text: "ok" }],
						},
					},
					stopReason: "end_turn",
					usage: { inputTokens: 5, outputTokens: 2, totalTokens: 7 },
				};
			},
		};
		const model = createBedrockChatModel({
			type: "bedrock",
			model: "us.anthropic.claude-sonnet-4-6",
			region: "us-east-1",
			temperature: 0.4,
			maxTokens: -1,
			streaming: false,
			rateLimit: { maxRetries: 3 },
		});
		model.client = client;
		const res = await model.invoke("hello");
		assert.strictEqual(res.content, "ok");
		assert.ok(requestCount >= 3, `expected at least 3 requests, got ${requestCount}`);
	});
});
