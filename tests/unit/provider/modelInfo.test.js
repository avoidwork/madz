import { describe, it, mock } from "node:test";
import assert from "node:assert";
import {
	getModelContextLength,
	buildModelsUrl,
	buildShowUrl,
	parseNumCtx,
} from "../../../src/provider/modelInfo.js";

describe("buildModelsUrl", () => {
	it("appends /models when base_url already ends with /v1", () => {
		assert.strictEqual(buildModelsUrl("https://host/v1"), "https://host/v1/models");
	});

	it("appends /v1/models when base_url does not contain /v1", () => {
		assert.strictEqual(buildModelsUrl("https://host"), "https://host/v1/models");
	});

	it("strips trailing slashes before appending", () => {
		assert.strictEqual(buildModelsUrl("https://host/v1/"), "https://host/v1/models");
	});
});

describe("buildShowUrl", () => {
	it("strips a trailing /v1 prefix", () => {
		assert.strictEqual(buildShowUrl("https://host/v1"), "https://host/api/show");
	});

	it("uses the base host when no /v1 prefix", () => {
		assert.strictEqual(buildShowUrl("https://host"), "https://host/api/show");
	});
});

describe("parseNumCtx", () => {
	it("parses num_ctx from a parameters string", () => {
		assert.strictEqual(parseNumCtx("num_ctx 8192 stop <|endoftext|>"), 8192);
	});

	it("returns undefined when num_ctx is absent", () => {
		assert.strictEqual(parseNumCtx("stop <|endoftext|>"), undefined);
	});

	it("returns undefined for non-string input", () => {
		assert.strictEqual(parseNumCtx(undefined), undefined);
	});
});

describe("getModelContextLength", () => {
	it("returns max_model_len from the OpenAI-compatible models endpoint", async () => {
		mock.method(globalThis, "fetch", async () => ({
			ok: true,
			json: async () => ({ data: [{ id: "llama3.1", max_model_len: 131072 }] }),
		}));
		const result = await getModelContextLength({
			base_url: "https://host/v1",
			model: "llama3.1",
			credentials: { apiKey: "sk-test" },
		});
		assert.strictEqual(result, 131072);
	});

	it("returns undefined when the model is not found in the models response", async () => {
		mock.method(globalThis, "fetch", async () => ({
			ok: true,
			json: async () => ({ data: [{ id: "other-model", max_model_len: 131072 }] }),
		}));
		const result = await getModelContextLength({
			base_url: "https://host/v1",
			model: "llama3.1",
			credentials: { apiKey: "sk-test" },
		});
		assert.strictEqual(result, undefined);
	});

	it("returns undefined when max_model_len is absent", async () => {
		mock.method(globalThis, "fetch", async () => ({
			ok: true,
			json: async () => ({ data: [{ id: "llama3.1" }] }),
		}));
		const result = await getModelContextLength({
			base_url: "https://host/v1",
			model: "llama3.1",
			credentials: { apiKey: "sk-test" },
		});
		assert.strictEqual(result, undefined);
	});

	it("returns context_length from the Ollama /api/show endpoint", async () => {
		mock.method(globalThis, "fetch", async () => ({
			ok: true,
			json: async () => ({
				model_info: { gemma4: { context_length: 131072 } },
			}),
		}));
		const result = await getModelContextLength({
			base_url: "https://host",
			model: "gemma4",
			credentials: { apiKey: "sk-test" },
		});
		assert.strictEqual(result, 131072);
	});

	it("parses num_ctx from the parameters string when context_length is absent", async () => {
		mock.method(globalThis, "fetch", async () => ({
			ok: true,
			json: async () => ({
				model_info: {},
				parameters: "num_ctx 8192 stop <|endoftext|>",
			}),
		}));
		const result = await getModelContextLength({
			base_url: "https://host",
			model: "gemma4",
			credentials: { apiKey: "sk-test" },
		});
		assert.strictEqual(result, 8192);
	});

	it("returns undefined when neither context_length nor num_ctx is present", async () => {
		mock.method(globalThis, "fetch", async () => ({
			ok: true,
			json: async () => ({ model_info: {}, parameters: "stop <|endoftext|>" }),
		}));
		const result = await getModelContextLength({
			base_url: "https://host",
			model: "gemma4",
			credentials: { apiKey: "sk-test" },
		});
		assert.strictEqual(result, undefined);
	});

	it("returns undefined when the provider is unreachable", async () => {
		mock.method(globalThis, "fetch", async () => {
			throw new Error("network error");
		});
		const result = await getModelContextLength({
			base_url: "https://host/v1",
			model: "llama3.1",
			credentials: { apiKey: "sk-test" },
		});
		assert.strictEqual(result, undefined);
	});

	it("returns undefined on a non-200 response", async () => {
		mock.method(globalThis, "fetch", async () => ({
			ok: false,
			status: 500,
			json: async () => ({}),
		}));
		const result = await getModelContextLength({
			base_url: "https://host/v1",
			model: "llama3.1",
			credentials: { apiKey: "sk-test" },
		});
		assert.strictEqual(result, undefined);
	});

	it("returns undefined when base_url or model is missing", async () => {
		assert.strictEqual(await getModelContextLength({}), undefined);
		assert.strictEqual(await getModelContextLength({ base_url: "https://host" }), undefined);
	});
});
