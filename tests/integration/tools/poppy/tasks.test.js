import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { execute } from "../../../../src/tools/poppy/tasks.js";

const TASKS_RESPONSE = {
	excluded_tasks: [
		{
			task: "refunds",
			description: "Refunds are handled by support",
			alternative: { instructions: "contact support", references: ["https://example.com/support"] },
		},
	],
	skill_index: {
		$schema: "https://example.com/skills/schema.json",
		skills: [
			{
				name: "orders",
				type: "skill-md",
				url: "https://example.com/skills/orders.md",
				digest: "abc123",
			},
		],
	},
	feedback: { endpoint: "https://example.com/feedback" },
};

describe("poppy - integration tasks", () => {
	it("fetches task coverage with the session header and no access token", async () => {
		mock.method(global, "fetch", async (url, init) => {
			assert.strictEqual(String(url), "https://example.com/tasks");
			assert.strictEqual(init.method, "GET");
			assert.strictEqual(init.headers["Poppy-Session"], "session-jwt");
			assert.strictEqual(init.headers["Poppy-Version"], "1.0");
			assert.strictEqual(init.headers.authorization, undefined);
			return { ok: true, status: 200, json: async () => TASKS_RESPONSE };
		});

		const result = await execute({
			op: "fetch",
			endpoint: "https://example.com/tasks",
			session: "session-jwt",
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.excluded_tasks.length, 1);
		assert.strictEqual(result.data.skill_index.skills.length, 1);
		assert.strictEqual(result.data.feedback.endpoint, "https://example.com/feedback");
	});

	it("matches a task against excluded tasks", async () => {
		const result = await execute({
			op: "match",
			poppyJson: TASKS_RESPONSE,
			task: "refunds",
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.excluded, true);
		assert.strictEqual(result.data.alternative.instructions, "contact support");
	});

	it("sends feedback and reports it as accepted", async () => {
		mock.method(global, "fetch", async (url, init) => {
			assert.strictEqual(String(url), "https://example.com/feedback");
			assert.strictEqual(init.method, "POST");
			const body = JSON.parse(init.body);
			assert.strictEqual(body.task, "refunds");
			assert.strictEqual(body.description, "Could not process refunds");
			return { ok: true, status: 202, json: async () => ({}) };
		});

		const result = await execute({
			op: "feedback",
			endpoint: "https://example.com/feedback",
			task: "refunds",
			description: "Could not process refunds",
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.accepted, true);
	});

	it("returns an alternative when feedback returns 200 with one", async () => {
		mock.method(global, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => ({ alternative: "contact support" }),
		}));

		const result = await execute({
			op: "feedback",
			endpoint: "https://example.com/feedback",
			task: "refunds",
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.accepted, false);
		assert.strictEqual(result.data.alternative, "contact support");
	});
});
