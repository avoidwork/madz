import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { scanAgentsImpl } from "../../src/tools/scanAgents/index.js";
import { setProjectCwd } from "../../src/workspace/project.js";
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

	it("returns ok:true with file contents when AGENTS.md exists", async () => {
		const result = await scanAgentsImpl({ path: TEST_DIR }, options);
		assert.strictEqual(result.ok, true);
		assert.ok(
			result.agents.includes("# Test AGENTS.md") && result.agents.includes("This is test content."),
			`Expected AGENTS.md content in result.agents, got: ${result.agents.substring(0, 100)}`,
		);
	});

	it("returns ok:true with empty agents when AGENTS.md does not exist", async () => {
		const nonExistentDir = join(tmpdir(), "nonExistent-" + Date.now());
		const result = await scanAgentsImpl({ path: nonExistentDir }, options);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.agents, "");
	});

	it("returns ok:true with empty agents when target directory does not exist", async () => {
		const nonExistentDir = join(tmpdir(), "nonExistent-" + Date.now());
		const result = await scanAgentsImpl({ path: nonExistentDir }, options);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.agents, "");
	});

	it("returns ok:false with error for path traversal attempt", async () => {
		const result = await scanAgentsImpl({ path: "../../../etc" }, options);
		assert.strictEqual(result.ok, false);
		assert.ok(
			typeof result.error === "string" && result.error.length > 0,
			`Expected a non-empty error string, got: ${JSON.stringify(result)}`,
		);
	});

	it("returns ok:false with error when file exceeds size limit", async () => {
		const largeContent = "x".repeat(2 * 1024 * 1024); // 2MB
		await writeFile(join(TEST_DIR, "AGENTS.md"), largeContent, "utf-8");
		const result = await scanAgentsImpl({ path: TEST_DIR }, options);
		assert.strictEqual(result.ok, false);
		assert.ok(
			typeof result.error === "string" && result.error.length > 0,
			`Expected a non-empty error string, got: ${JSON.stringify(result)}`,
		);
	});

	it("resolves an omitted path against the active project cwd", async () => {
		// A distinct project directory with its own AGENTS.md, under tmpdir()
		// so it passes the sandbox allowlist.
		const projectDir = join(tmpdir(), "scanAgents-project-" + Date.now());
		const projectContent = "# Project AGENTS.md\n\nProject-specific rules.";
		await mkdir(projectDir, { recursive: true });
		await writeFile(join(projectDir, "AGENTS.md"), projectContent, "utf-8");

		setProjectCwd(projectDir);
		try {
			const result = await scanAgentsImpl({}, options);
			assert.strictEqual(result.ok, true);
			assert.ok(
				result.agents.includes("# Project AGENTS.md") &&
					result.agents.includes("Project-specific rules."),
				`Expected project AGENTS.md content, got: ${result.agents.substring(0, 100)}`,
			);
		} finally {
			setProjectCwd("");
			await rm(projectDir, { recursive: true, force: true });
		}
	});
});

describe("scanAgents tool - buildToolConfig", () => {
	it("registers scanAgents tool with filesystem:read permission", async () => {
		const tools = await buildToolConfig({ permissions: ["filesystem:read"] });
		const toolNames = tools.map((t) => t.name);
		assert.ok(
			toolNames.includes("scanAgents"),
			`Expected 'scanAgents' tool to be registered, got: ${toolNames.join(", ")}`,
		);
	});
});
