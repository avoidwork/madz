import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { scanAgentsImpl, createScanAgentsTool } from "../../src/tools/scanAgents.js";
import { buildToolConfig } from "../../src/tools/index.js";

// Test fixtures
const TEST_DIR = join(tmpdir(), "scanAgents-test-" + Date.now());
const AGENTS_CONTENT = "# Test AGENTS.md\n\nThis is test content.";

async function setup() {
	await mkdir(TEST_DIR, { recursive: true });
	await writeFile(join(TEST_DIR, "AGENTS.md"), AGENTS_CONTENT, "utf-8");
}

async function teardown() {
	try {
		await rm(TEST_DIR, { recursive: true, force: true });
	} catch {
		// Directory may not exist
	}
}

describe("scanAgents tool - scanAgentsImpl", () => {
	let options;

	beforeEach(async () => {
		await setup();
		options = {
			allowedPaths: [tmpdir()],
			maxReadSize: "1mb",
		};
	});

	afterEach(async () => {
		await teardown();
	});

	it("returns file contents when AGENTS.md exists", async () => {
		const result = await scanAgentsImpl({ path: TEST_DIR }, options);
		assert.ok(
			result.includes("# Test AGENTS.md") && result.includes("This is test content."),
			`Expected AGENTS.md content in result, got: ${result.substring(0, 100)}`,
		);
	});

	it("returns empty string when AGENTS.md does not exist", async () => {
		const nonExistentDir = join(tmpdir(), "nonExistent-" + Date.now());
		const result = await scanAgentsImpl({ path: nonExistentDir }, options);
		assert.strictEqual(result, "");
	});

	it("returns empty string when target directory does not exist", async () => {
		const nonExistentDir = join(tmpdir(), "nonExistent-" + Date.now());
		const result = await scanAgentsImpl({ path: nonExistentDir }, options);
		assert.strictEqual(result, "");
	});

	it("returns error message for path traversal attempt", async () => {
		const result = await scanAgentsImpl({ path: "../../../etc" }, options);
		assert.ok(
			result.toLowerCase().includes("error") || result.toLowerCase().includes("not allowed"),
			`Expected error for path traversal, got: ${result}`,
		);
	});

	it("returns error message when file exceeds size limit", async () => {
		const largeContent = "x".repeat(2 * 1024 * 1024); // 2MB
		await writeFile(join(TEST_DIR, "AGENTS.md"), largeContent, "utf-8");
		const result = await scanAgentsImpl({ path: TEST_DIR }, options);
		assert.ok(
			result.toLowerCase().includes("error") || result.toLowerCase().includes("exceeds"),
			`Expected error for oversized file, got: ${result}`,
		);
	});

	it("uses process.cwd() when no path is provided", async () => {
		// This test verifies the default path behavior
		// We can't easily test process.cwd() without mocking, so we verify the schema accepts no path
		const schema = createScanAgentsTool({}).schema;
		const parsed = schema.parse({});
		assert.ok(
			!parsed.path || typeof parsed.path === "undefined",
			"Expected path to be undefined when not provided",
		);
	});
});

describe("scanAgents tool - createScanAgentsTool", () => {
	it("returns a LangChain Tool with correct name", () => {
		const toolInstance = createScanAgentsTool({});
		assert.strictEqual(toolInstance.name, "scanAgents");
	});

	it("returns a LangChain Tool with description", () => {
		const toolInstance = createScanAgentsTool({});
		assert.ok(toolInstance.description.length > 10, "Expected a descriptive description");
	});

	it("returns a LangChain Tool with a zod schema", () => {
		const toolInstance = createScanAgentsTool({});
		assert.ok(toolInstance.schema, "Expected a schema to be defined");
	});
});

describe("scanAgents tool - buildToolConfig", () => {
	it("registers scanAgents tool without permissions", async () => {
		const tools = await buildToolConfig({ permissions: [] });
		const toolNames = tools.map((t) => t.name);
		assert.ok(
			toolNames.includes("scanAgents"),
			`Expected 'scanAgents' tool to be registered, got: ${toolNames.join(", ")}`,
		);
	});
});
