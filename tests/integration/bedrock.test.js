import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { createBedrockModel } from "../../src/provider/bedrock.js";

/**
 * Build a mock Bedrock Runtime client that records the Converse command and
 * returns a canned response. The `send` method is the only method the
 * `ChatBedrockConverse` client calls.
 * @param {Object} [response] - The response to return from `send`
 * @returns {{ client: Object, sent: Array }} The mock client and recorded commands
 */
function makeMockClient(response = {}) {
	const sent = [];
	const client = {
		send: async (command, options) => {
			sent.push({ command, options });
			return response;
		},
	};
	return { client, sent };
}

/**
 * Build a minimal non-streaming Converse response message.
 * @param {string} text - The assistant text
 * @returns {Object} A Converse response
 */
function makeConverseResponse(text = "hello") {
	return {
		output: {
			message: {
				role: "assistant",
				content: [{ text }],
			},
		},
		usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
	};
}

/**
 * Build an async iterable of Converse stream events.
 * @param {string} text - The assistant text to stream
 * @returns {AsyncIterable} An async iterable of stream events
 */
function makeConverseStream(text = "hello") {
	const chunks = [];
	for (const char of text) {
		chunks.push({ contentBlockDelta: { delta: { text: char } } });
	}
	chunks.push({ messageStop: {} });
	return {
		async *[Symbol.asyncIterator]() {
			for (const chunk of chunks) yield chunk;
		},
	};
}

describe("Bedrock Converse request shape (integration)", () => {
	let restore;
	beforeEach(() => {
		restore = () => {};
		process.env.BEDROCK_AWS_REGION = "us-east-1";
	});
	afterEach(() => restore());

	it("sends a Converse command with the configured model and region", async () => {
		const { client, sent } = makeMockClient(makeConverseResponse());
		const model = createBedrockModel({
			type: "bedrock",
			model: "us.anthropic.claude-sonnet-4-6",
			region: "us-east-1",
			streaming: false,
			client,
		});
		const result = await model.invoke([{ role: "user", content: "hi" }]);
		assert.strictEqual(sent.length, 1);
		const cmd = sent[0].command;
		assert.strictEqual(cmd.constructor.name, "ConverseCommand");
		assert.strictEqual(cmd.input.modelId, "us.anthropic.claude-sonnet-4-6");
		assert.strictEqual(result.content, "hello");
	});

	it("uses the application inference profile as the modelId when provided", async () => {
		const { client, sent } = makeMockClient(makeConverseResponse());
		const model = createBedrockModel({
			type: "bedrock",
			model: "us.anthropic.claude-sonnet-4-6",
			region: "us-east-1",
			streaming: false,
			applicationInferenceProfile:
				"arn:aws:bedrock:us-east-1:123:application-inference-profile/fm16bt65tzgx",
			client,
		});
		await model.invoke([{ role: "user", content: "hi" }]);
		const cmd = sent[0].command;
		assert.strictEqual(
			cmd.input.modelId,
			"arn:aws:bedrock:us-east-1:123:application-inference-profile/fm16bt65tzgx",
		);
	});

	it("passes tool definitions to the Converse command", async () => {
		const { client, sent } = makeMockClient(makeConverseResponse());
		const model = createBedrockModel({
			type: "bedrock",
			model: "us.anthropic.claude-sonnet-4-6",
			region: "us-east-1",
			streaming: false,
			client,
		});
		const tool = {
			toolSpec: {
				name: "get_weather",
				description: "Get the weather",
				inputSchema: {
					json: { type: "object", properties: { city: { type: "string" } } },
				},
			},
		};
		await model.invoke([{ role: "user", content: "what's the weather?" }], { tools: [tool] });
		const cmd = sent[0].command;
		assert.ok(Array.isArray(cmd.input.toolConfig?.tools), "toolConfig.tools should be an array");
		assert.strictEqual(cmd.input.toolConfig.tools[0].toolSpec.name, "get_weather");
	});

	it("streams Converse events when streaming is enabled", async () => {
		const { client } = makeMockClient({ stream: makeConverseStream("hello") });
		const model = createBedrockModel({
			type: "bedrock",
			model: "us.anthropic.claude-sonnet-4-6",
			region: "us-east-1",
			streaming: true,
			client,
		});
		const stream = await model.stream([{ role: "user", content: "hi" }]);
		let text = "";
		for await (const chunk of stream) {
			text += chunk.content ?? "";
		}
		assert.strictEqual(text, "hello");
	});
});
