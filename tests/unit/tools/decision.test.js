import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { decision, decisionImpl } from "../../../src/tools/decision/index.js";
import { buildToolConfig } from "../../../src/tools/index.js";

const baseConfig = {
	baseUrl: "http://localhost:11434",
	model: "tev1:4b",
	temperature: 0,
};

describe("decision tool", () => {
	it("has correct tool metadata", () => {
		assert.strictEqual(decision.name, "decision");
		assert.ok(typeof decision.description === "string");
		assert.ok(decision.description.length > 0);
	});

	it("returns an error when decisionConfig is not provided", async () => {
		const result = await decisionImpl({ state: "x", questions: {} }, {});
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /not configured/);
	});

	it("returns an error when baseUrl is empty", async () => {
		const result = await decisionImpl(
			{ state: "x", questions: {} },
			{ decisionConfig: { ...baseConfig, baseUrl: "" } },
		);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /not configured/);
	});

	it("returns an error when state is empty", async () => {
		const result = await decisionImpl(
			{ state: "", questions: { q: { type: "noul", instructions: "x" } } },
			{ decisionConfig: baseConfig },
		);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /state is required/);
	});

	it("returns an error when questions is empty", async () => {
		const result = await decisionImpl(
			{ state: "x", questions: {} },
			{ decisionConfig: baseConfig },
		);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /questions is required/);
	});

	it("handles a choice question type", async () => {
		let capturedUrl;
		let capturedBody;
		const fetchMock = mock.method(globalThis, "fetch", async (url, opts) => {
			capturedUrl = url;
			capturedBody = JSON.parse(opts.body);
			return {
				ok: true,
				status: 200,
				json: async () => ({
					model: "tev1:4b",
					answers: {
						team: {
							type: "choice",
							choice: "billing",
							probabilities: { billing: 0.985, technical: 0.012, other: 0.003 },
							confidence: 0.922,
						},
					},
					usage: { input_tokens: 841, output_tokens: 4 },
				}),
			};
		});
		try {
			const result = await decisionImpl(
				{
					state: { ticket: "I was charged twice. Please refund the extra payment." },
					questions: {
						team: {
							type: "choice",
							instructions: "Which team should handle this ticket?",
							criteria: { billing: "Payments and refunds", technical: "Bugs and integrations" },
						},
					},
				},
				{ decisionConfig: baseConfig },
			);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.answers.team.choice, "billing");
			assert.strictEqual(capturedUrl, "http://localhost:11434/v1/systemone");
			assert.strictEqual(capturedBody.model, "tev1:4b");
			assert.strictEqual(
				capturedBody.state.ticket,
				"I was charged twice. Please refund the extra payment.",
			);
			assert.strictEqual(capturedBody.questions.team.type, "choice");
		} finally {
			fetchMock.mock.restore();
		}
	});

	it("handles a noul question type", async () => {
		const fetchMock = mock.method(globalThis, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => ({
				model: "tev1:4b",
				answers: { refund: { type: "noul", noul: 0.997 } },
				usage: { input_tokens: 100, output_tokens: 2 },
			}),
		}));
		try {
			const result = await decisionImpl(
				{
					state: "I was charged twice. Please refund the extra payment.",
					questions: {
						refund: {
							type: "noul",
							instructions: "Does the customer explicitly ask for a refund?",
						},
					},
				},
				{ decisionConfig: baseConfig },
			);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.answers.refund.noul, 0.997);
		} finally {
			fetchMock.mock.restore();
		}
	});

	it("handles a score question type", async () => {
		const fetchMock = mock.method(globalThis, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => ({
				model: "tev1:4b",
				answers: {
					urgency: {
						type: "score",
						score: 0.815,
						legend: { 0: "Routine", 1: "Soon", 2: "Urgent" },
						probabilities: { 0: 0.378, 1: 0.429, 2: 0.193 },
						confidence: 0.046,
					},
				},
				usage: { input_tokens: 200, output_tokens: 3 },
			}),
		}));
		try {
			const result = await decisionImpl(
				{
					state: "I was charged twice. Please refund the extra payment.",
					questions: {
						urgency: {
							type: "score",
							instructions: "How urgent is this ticket?",
							criteria: ["Routine", "Soon", "Urgent"],
						},
					},
				},
				{ decisionConfig: baseConfig },
			);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.answers.urgency.score, 0.815);
		} finally {
			fetchMock.mock.restore();
		}
	});

	it("returns an error when the model response is missing answers", async () => {
		const fetchMock = mock.method(globalThis, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => ({ model: "tev1:4b" }),
		}));
		try {
			const result = await decisionImpl(
				{
					state: "x",
					questions: { q: { type: "noul", instructions: "x" } },
				},
				{ decisionConfig: baseConfig },
			);
			assert.strictEqual(result.ok, false);
			assert.match(result.error, /missing answers/);
		} finally {
			fetchMock.mock.restore();
		}
	});

	it("returns an error when the fetch request fails", async () => {
		const fetchMock = mock.method(globalThis, "fetch", async () => {
			throw new Error("connection refused");
		});
		try {
			const result = await decisionImpl(
				{
					state: "x",
					questions: { q: { type: "noul", instructions: "x" } },
				},
				{ decisionConfig: baseConfig },
			);
			assert.strictEqual(result.ok, false);
			assert.match(result.error, /request failed/);
		} finally {
			fetchMock.mock.restore();
		}
	});

	it("rejects invalid question type via schema validation", async () => {
		await assert.rejects(
			async () =>
				decision.invoke({
					state: "x",
					questions: { q: { type: "invalid", instructions: "x" } },
				}),
			/type/i,
		);
	});

	it("rejects missing state via schema validation", async () => {
		await assert.rejects(
			async () => decision.invoke({ questions: { q: { type: "noul", instructions: "x" } } }),
			/state/i,
		);
	});
});

describe("decision tool - buildToolConfig", () => {
	it("registers decision when network:outbound and baseUrl are set", async () => {
		const tools = await buildToolConfig({
			permissions: ["network:outbound"],
			config: {
				providers: {},
				search: {},
				agent: {
					decision: { baseUrl: "http://localhost:11434", model: "tev1:4b", temperature: 0 },
				},
			},
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(toolNames.includes("decision"));
	});

	it("does not register decision when baseUrl is empty", async () => {
		const tools = await buildToolConfig({
			permissions: ["network:outbound"],
			config: {
				providers: {},
				search: {},
				agent: { decision: { baseUrl: "", model: "tev1:4b", temperature: 0 } },
			},
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(!toolNames.includes("decision"));
	});

	it("does not register decision when agent.decision is absent", async () => {
		const tools = await buildToolConfig({
			permissions: ["network:outbound"],
			config: { providers: {}, search: {} },
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(!toolNames.includes("decision"));
	});

	it("does not register decision without network:outbound permission", async () => {
		const tools = await buildToolConfig({
			permissions: ["filesystem:read"],
			config: {
				providers: {},
				search: {},
				agent: {
					decision: { baseUrl: "http://localhost:11434", model: "tev1:4b", temperature: 0 },
				},
			},
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(!toolNames.includes("decision"));
	});
});
