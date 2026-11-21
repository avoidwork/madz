import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { createAgent } from "langchain";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import {
	calibratedContextSize,
	createContextCalibrationMiddleware,
	getContextInputTokens,
	getContextOverhead,
	readInputTokens,
	resetContextCalibration,
	setContextInputTokens,
	setContextOverhead,
} from "../../../src/provider/contextCalibration.js";

/** Provider-reported prompt tokens returned by the fake model. */
const REPORTED_INPUT = 500;

/** Tokenizer count of the request messages returned by the fake tokenizer. */
const TOKENIZER_COUNT = 120;

/** Chat model that reports provider usage on its reply. */
class UsageModel extends BaseChatModel {
	_llmType() {
		return "usage";
	}

	bindTools() {
		return this;
	}

	async _generate() {
		const message = new AIMessage({
			content: "done",
			usage_metadata: {
				input_tokens: REPORTED_INPUT,
				output_tokens: 5,
				total_tokens: REPORTED_INPUT + 5,
			},
		});
		return { generations: [{ text: "done", message }] };
	}
}

/** Tokenizer double with the ChatOpenAI `getNumTokensFromMessages` shape. */
const tokenizer = { getNumTokensFromMessages: async () => ({ totalCount: TOKENIZER_COUNT }) };

describe("readInputTokens", () => {
	it("reads usage_metadata.input_tokens from a message", () => {
		assert.strictEqual(readInputTokens({ usage_metadata: { input_tokens: 7 } }), 7);
	});

	it("reads prompt_tokens from response_metadata.usage", () => {
		assert.strictEqual(readInputTokens({ response_metadata: { usage: { prompt_tokens: 9 } } }), 9);
	});

	it("reads usage from the last message of a ModelResponse", () => {
		const result = {
			result: [{ usage_metadata: { input_tokens: 3 } }, { usage_metadata: { input_tokens: 4 } }],
		};
		assert.strictEqual(readInputTokens(result), 4);
	});

	it("returns 0 when the response has no usage", () => {
		assert.strictEqual(readInputTokens({ content: "x" }), 0);
		assert.strictEqual(readInputTokens(undefined), 0);
	});
});

describe("context overhead", () => {
	beforeEach(() => setContextOverhead(null));

	it("is null until a real call is measured and leaves the count unchanged", () => {
		assert.strictEqual(getContextOverhead(), null);
		assert.strictEqual(calibratedContextSize(TOKENIZER_COUNT), TOKENIZER_COUNT);
	});

	it("is added to the tokenizer count once measured", () => {
		setContextOverhead(REPORTED_INPUT - TOKENIZER_COUNT);
		assert.strictEqual(calibratedContextSize(TOKENIZER_COUNT), REPORTED_INPUT);
	});

	it("never yields a negative context size", () => {
		setContextOverhead(-TOKENIZER_COUNT - 1);
		assert.strictEqual(calibratedContextSize(TOKENIZER_COUNT), 0);
	});

	it("ignores a non-finite overhead", () => {
		setContextOverhead(Number.NaN);
		assert.strictEqual(getContextOverhead(), null);
	});
});

describe("context input tokens", () => {
	beforeEach(() => resetContextCalibration());

	it("is null until a real call is measured", () => {
		assert.strictEqual(getContextInputTokens(), null);
	});

	it("records the provider-reported input tokens once measured", () => {
		setContextInputTokens(REPORTED_INPUT);
		assert.strictEqual(getContextInputTokens(), REPORTED_INPUT);
	});

	it("ignores a non-positive input token count", () => {
		setContextInputTokens(0);
		assert.strictEqual(getContextInputTokens(), null);
		setContextInputTokens(-5);
		assert.strictEqual(getContextInputTokens(), null);
	});

	it("ignores a non-finite input token count", () => {
		setContextInputTokens(Number.NaN);
		assert.strictEqual(getContextInputTokens(), null);
	});

	it("resets both overhead and input tokens", () => {
		setContextOverhead(10);
		setContextInputTokens(REPORTED_INPUT);
		resetContextCalibration();
		assert.strictEqual(getContextOverhead(), null);
		assert.strictEqual(getContextInputTokens(), null);
	});
});

describe("createContextCalibrationMiddleware", () => {
	beforeEach(() => resetContextCalibration());

	it("measures overhead as provider input tokens minus tokenizer message tokens", async () => {
		const mw = createContextCalibrationMiddleware({ model: tokenizer });
		const request = { messages: [new HumanMessage("hi")] };
		const result = { usage_metadata: { input_tokens: REPORTED_INPUT } };
		const returned = await mw.wrapModelCall(request, async () => result);

		assert.strictEqual(returned, result, "the response passes through untouched");
		assert.strictEqual(getContextOverhead(), REPORTED_INPUT - TOKENIZER_COUNT);
		assert.strictEqual(getContextInputTokens(), REPORTED_INPUT);
	});

	it("leaves the overhead alone when the response has no usage", async () => {
		const mw = createContextCalibrationMiddleware({ model: tokenizer });
		await mw.wrapModelCall({ messages: [] }, async () => ({ content: "x" }));
		assert.strictEqual(getContextOverhead(), null);
	});

	it("does not fail the model call when the tokenizer throws", async () => {
		const failing = {
			getNumTokensFromMessages: async () => {
				throw new Error("tokenizer down");
			},
		};
		const mw = createContextCalibrationMiddleware({ model: failing });
		const result = { usage_metadata: { input_tokens: REPORTED_INPUT } };
		assert.strictEqual(await mw.wrapModelCall({ messages: [] }, async () => result), result);
		assert.strictEqual(getContextOverhead(), null);
	});

	it("measures overhead on a real agent model call", async () => {
		const agent = createAgent({
			model: new UsageModel({}),
			tools: [],
			middleware: [createContextCalibrationMiddleware({ model: tokenizer })],
		});
		await agent.invoke({ messages: [new HumanMessage("hello")] });
		assert.strictEqual(getContextOverhead(), REPORTED_INPUT - TOKENIZER_COUNT);
	});
});
