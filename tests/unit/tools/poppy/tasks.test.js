import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
	TasksInputSchema,
	TasksResponseSchema,
	buildTasksHeaders,
	fetchTasks,
	matchTask,
	fetchSkill,
	fetchSkills,
	sendFeedback,
	execute,
} from "../../../../src/tools/poppy/tasks.js";

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

describe("poppy tasks - schema validation", () => {
	it("accepts valid tasks input", () => {
		const result = TasksInputSchema.safeParse({
			op: "fetch",
			endpoint: "https://example.com/tasks",
		});
		assert.strictEqual(result.success, true);
	});

	it("rejects tasks input missing op", () => {
		const result = TasksInputSchema.safeParse({ endpoint: "https://example.com/tasks" });
		assert.strictEqual(result.success, false);
	});

	it("accepts a valid tasks response", () => {
		const result = TasksResponseSchema.safeParse(TASKS_RESPONSE);
		assert.strictEqual(result.success, true);
	});

	it("defaults missing fields in a tasks response", () => {
		const result = TasksResponseSchema.safeParse({});
		assert.strictEqual(result.success, true);
		assert.deepStrictEqual(result.data.excluded_tasks, []);
		assert.deepStrictEqual(result.data.skill_index, { $schema: "", skills: [] });
	});
});

describe("poppy tasks - buildTasksHeaders", () => {
	it("includes the Poppy-Session and Poppy-Version headers", () => {
		const headers = buildTasksHeaders({ session: "jwt", version: "1.0" });
		assert.strictEqual(headers["Poppy-Session"], "jwt");
		assert.strictEqual(headers["Poppy-Version"], "1.0");
	});

	it("defaults the Poppy-Version header", () => {
		const headers = buildTasksHeaders({});
		assert.strictEqual(headers["Poppy-Version"], "1.0");
	});

	it("does not include an access token", () => {
		const headers = buildTasksHeaders({ session: "jwt" });
		assert.strictEqual(headers.authorization, undefined);
	});
});

describe("poppy tasks - fetchTasks", () => {
	it("fetches the tasks endpoint with the session header and no access token", async () => {
		mock.method(global, "fetch", async (url, init) => {
			assert.strictEqual(String(url), "https://example.com/tasks");
			assert.strictEqual(init.method, "GET");
			assert.strictEqual(init.headers["Poppy-Session"], "jwt");
			assert.strictEqual(init.headers.authorization, undefined);
			return { ok: true, status: 200, json: async () => TASKS_RESPONSE };
		});
		const result = await fetchTasks({ endpoint: "https://example.com/tasks", session: "jwt" });
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.excluded_tasks.length, 1);
		assert.strictEqual(result.data.skill_index.skills.length, 1);
		assert.strictEqual(result.data.feedback.endpoint, "https://example.com/feedback");
	});

	it("rejects an invalid tasks response", async () => {
		mock.method(global, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => ({ excluded_tasks: "not-an-array" }),
		}));
		const result = await fetchTasks({ endpoint: "https://example.com/tasks" });
		assert.strictEqual(result.ok, false);
	});

	it("reports an error when the tasks endpoint is missing", async () => {
		const result = await fetchTasks({});
		assert.strictEqual(result.ok, false);
	});

	it("reports an HTTP error from the tasks endpoint", async () => {
		mock.method(global, "fetch", async () => ({
			ok: false,
			status: 404,
			json: async () => ({}),
		}));
		const result = await fetchTasks({ endpoint: "https://example.com/tasks" });
		assert.strictEqual(result.ok, false);
	});
});

describe("poppy tasks - matchTask", () => {
	it("reports a task as excluded when it matches", () => {
		const result = matchTask(TASKS_RESPONSE, "refunds");
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.excluded, true);
		assert.strictEqual(result.data.alternative.instructions, "contact support");
	});

	it("reports a task as allowed when it does not match", () => {
		const result = matchTask(TASKS_RESPONSE, "orders");
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.excluded, false);
	});

	it("reports no exclusions when excluded_tasks is empty", () => {
		const result = matchTask({ excluded_tasks: [] }, "refunds");
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.excluded, false);
	});
});

describe("poppy tasks - fetchSkill", () => {
	it("fetches and verifies a skill artifact", async () => {
		const content = { content: "orders skill" };
		const bytes = new TextEncoder().encode(JSON.stringify(content));
		const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
		const entry = {
			name: "orders",
			type: "skill-md",
			url: "https://example.com/skills/orders.md",
			digest,
		};
		mock.method(global, "fetch", async () => ({
			ok: true,
			status: 200,
			arrayBuffer: async () => bytes.buffer,
		}));
		const result = await fetchSkill(entry);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.name, "orders");
	});

	it("rejects an invalid skill index entry", async () => {
		const result = await fetchSkill({ name: "orders" });
		assert.strictEqual(result.ok, false);
	});

	it("reports a digest mismatch", async () => {
		const entry = {
			name: "orders",
			type: "skill-md",
			url: "https://example.com/skills/orders.md",
			digest: "sha256:wrong",
		};
		mock.method(global, "fetch", async () => ({
			ok: true,
			status: 200,
			arrayBuffer: async () =>
				new TextEncoder().encode(JSON.stringify({ content: "orders skill" })).buffer,
		}));
		const result = await fetchSkill(entry);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /Digest mismatch/);
	});
});

describe("poppy tasks - fetchSkills", () => {
	it("fetches and verifies all skill artifacts", async () => {
		const ordersContent = { content: "orders" };
		const inventoryContent = { content: "inventory" };
		const ordersBytes = new TextEncoder().encode(JSON.stringify(ordersContent));
		const inventoryBytes = new TextEncoder().encode(JSON.stringify(inventoryContent));
		const skillIndex = [
			{
				name: "orders",
				type: "skill-md",
				url: "https://example.com/skills/orders.md",
				digest: `sha256:${createHash("sha256").update(ordersBytes).digest("hex")}`,
			},
			{
				name: "inventory",
				type: "skill-md",
				url: "https://example.com/skills/inventory.md",
				digest: `sha256:${createHash("sha256").update(inventoryBytes).digest("hex")}`,
			},
		];
		mock.method(global, "fetch", async (url) => {
			const href = String(url);
			if (href.includes("orders"))
				return { ok: true, status: 200, arrayBuffer: async () => ordersBytes.buffer };
			return { ok: true, status: 200, arrayBuffer: async () => inventoryBytes.buffer };
		});
		const result = await fetchSkills(skillIndex);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.length, 2);
	});

	it("returns an empty list when the skill index is empty", async () => {
		const result = await fetchSkills([]);
		assert.strictEqual(result.ok, true);
		assert.deepStrictEqual(result.data, []);
	});

	it("reports an error for an unknown skill type", async () => {
		const skillIndex = [
			{
				name: "orders",
				type: "unknown",
				url: "https://example.com/skills/orders.md",
				digest: "sha256:abc123",
			},
		];
		mock.method(global, "fetch", async () => ({
			ok: true,
			status: 200,
			arrayBuffer: async () =>
				new TextEncoder().encode(JSON.stringify({ content: "orders" })).buffer,
		}));
		const result = await fetchSkills(skillIndex);
		assert.strictEqual(result.ok, false);
	});
});

describe("poppy tasks - sendFeedback", () => {
	it("posts feedback and reports it as accepted", async () => {
		mock.method(global, "fetch", async (url, init) => {
			assert.strictEqual(String(url), "https://example.com/feedback");
			assert.strictEqual(init.method, "POST");
			const body = JSON.parse(init.body);
			assert.strictEqual(body.task, "refunds");
			assert.strictEqual(body.description, "Could not process refunds");
			return { ok: true, status: 202, json: async () => ({}) };
		});
		const result = await sendFeedback({
			endpoint: "https://example.com/feedback",
			task: "refunds",
			description: "Could not process refunds",
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.accepted, true);
	});

	it("returns an alternative when the endpoint returns 200 with one", async () => {
		mock.method(global, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => ({ alternative: "contact support" }),
		}));
		const result = await sendFeedback({
			endpoint: "https://example.com/feedback",
			task: "refunds",
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.accepted, false);
		assert.strictEqual(result.data.alternative, "contact support");
	});

	it("rejects feedback that is too long", async () => {
		const result = await sendFeedback({
			endpoint: "https://example.com/feedback",
			task: "refunds",
			description: "x".repeat(2001),
		});
		assert.strictEqual(result.ok, false);
	});
});

describe("poppy tasks - execute", () => {
	it("dispatches the fetch operation", async () => {
		mock.method(global, "fetch", async () => ({
			ok: true,
			status: 200,
			json: async () => TASKS_RESPONSE,
		}));
		const result = await execute({
			op: "fetch",
			endpoint: "https://example.com/tasks",
			session: "jwt",
		});
		assert.strictEqual(result.ok, true);
	});

	it("dispatches the match operation", async () => {
		const result = await execute({ op: "match", poppyJson: TASKS_RESPONSE, task: "refunds" });
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.excluded, true);
	});

	it("dispatches the skills operation", async () => {
		const content = { content: "orders" };
		const bytes = new TextEncoder().encode(JSON.stringify(content));
		const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
		mock.method(global, "fetch", async () => ({
			ok: true,
			status: 200,
			arrayBuffer: async () => bytes.buffer,
		}));
		const result = await execute({
			op: "skills",
			poppyJson: {
				skill_index: {
					$schema: "https://example.com/skills/schema.json",
					skills: [
						{
							name: "orders",
							type: "skill-md",
							url: "https://example.com/skills/orders.md",
							digest,
						},
					],
				},
			},
		});
		assert.strictEqual(result.ok, true);
	});

	it("dispatches the feedback operation", async () => {
		mock.method(global, "fetch", async () => ({
			ok: true,
			status: 202,
			json: async () => ({}),
		}));
		const result = await execute({
			op: "feedback",
			endpoint: "https://example.com/feedback",
			task: "refunds",
		});
		assert.strictEqual(result.ok, true);
	});

	it("rejects an unknown operation", async () => {
		const result = await execute({ op: "unknown", endpoint: "https://example.com/tasks" });
		assert.strictEqual(result.ok, false);
	});
});
