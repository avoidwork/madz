import { describe, it } from "node:test";
import assert from "node:assert";
import { parseCompactionOutput, createCompactionTool } from "../../src/tools/compaction.js";
import { buildToolConfig } from "../../src/tools/index.js";

describe("parseCompactionOutput", () => {
	it("returns ok=true with summary when marker is present", () => {
		const stdout =
			"thinking...\n# Compaction\n\n## Session Context\n\n### Core Decisions\n- Decision 1";
		const result = parseCompactionOutput(stdout);
		assert.strictEqual(result.ok, true);
		assert.ok(result.summary.includes("# Compaction"));
		assert.ok(result.summary.includes("## Session Context"));
		assert.ok(result.summary.includes("### Core Decisions"));
		assert.ok(result.summary.includes("Decision 1"));
	});

	it("returns ok=false when no marker is present", () => {
		const stdout = "just some output without marker";
		const result = parseCompactionOutput(stdout);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("not found"));
	});

	it("returns ok=false when output is empty", () => {
		const result = parseCompactionOutput("");
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("No output"));
	});

	it("returns ok=false when output is null", () => {
		const result = parseCompactionOutput(null);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("No output"));
	});

	it("returns ok=false when marker has no content after it", () => {
		const stdout = "thinking...\n# Compaction\n";
		const result = parseCompactionOutput(stdout);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("no summary content"));
	});

	it("takes only the first split after marker (index[1])", () => {
		const stdout =
			"# Compaction\n\n## Session Context\n\n### Core Decisions\n- Decision 1\n# Compaction\n\ndiscarded\n\n## More Content";
		const result = parseCompactionOutput(stdout);
		assert.strictEqual(result.ok, true);
		assert.ok(result.summary.includes("## Session Context"));
		assert.ok(result.summary.includes("Decision 1"));
		assert.ok(!result.summary.includes("discarded"));
		assert.ok(!result.summary.includes("## More Content"));
	});

	it("handles marker with thinking/reasoning before it", () => {
		const stdout =
			"[thinking / reasoning / pre-marker content]\n# Compaction\n[the actual summary]";
		const result = parseCompactionOutput(stdout);
		assert.strictEqual(result.ok, true);
		assert.ok(result.summary.includes("[the actual summary]"));
		assert.ok(!result.summary.includes("[thinking"));
	});

	it("handles multiline summary content", () => {
		const stdout =
			"# Compaction\n\n## Session Context\n\n### Core Decisions\n- Decision 1\n- Decision 2\n\n### Key Design Points\n- Point 1\n- Point 2\n\n### Open Questions\n- Question 1\n\n### Next Steps\n- Step 1";
		const result = parseCompactionOutput(stdout);
		assert.strictEqual(result.ok, true);
		assert.ok(result.summary.includes("Decision 1"));
		assert.ok(result.summary.includes("Decision 2"));
		assert.ok(result.summary.includes("Point 1"));
		assert.ok(result.summary.includes("Question 1"));
		assert.ok(result.summary.includes("Step 1"));
	});
});

describe("createCompactionTool", () => {
	it("returns a LangChain Tool with correct name", () => {
		const toolInstance = createCompactionTool({ sessionsDir: "memory/sessions/" });
		assert.strictEqual(toolInstance.name, "compaction");
	});

	it("returns a LangChain Tool with description", () => {
		const toolInstance = createCompactionTool({ sessionsDir: "memory/sessions/" });
		assert.ok(toolInstance.description.length > 10, "Expected a descriptive description");
		assert.ok(toolInstance.description.includes("semantic summarization"));
	});

	it("returns a LangChain Tool with a zod schema", () => {
		const toolInstance = createCompactionTool({ sessionsDir: "memory/sessions/" });
		assert.ok(toolInstance.schema, "Expected a schema to be defined");
	});

	it("uses provided sessionsDir", () => {
		const toolInstance = createCompactionTool({ sessionsDir: "custom/sessions/" });
		assert.strictEqual(toolInstance.name, "compaction");
	});

	it("uses default sessionsDir when not provided", () => {
		const toolInstance = createCompactionTool({});
		assert.strictEqual(toolInstance.name, "compaction");
	});
});

describe("compaction tool - buildToolConfig", () => {
	it("registers compaction tool without permissions", async () => {
		const tools = await buildToolConfig({ permissions: [] });
		const toolNames = tools.map((t) => t.name);
		assert.ok(
			toolNames.includes("compaction"),
			`Expected 'compaction' tool to be registered, got: ${toolNames.join(", ")}`,
		);
	});

	it("registers compaction tool with other permissions", async () => {
		const tools = await buildToolConfig({ permissions: ["filesystem:read", "filesystem:write"] });
		const toolNames = tools.map((t) => t.name);
		assert.ok(
			toolNames.includes("compaction"),
			`Expected 'compaction' tool to be registered, got: ${toolNames.join(", ")}`,
		);
	});
});
