import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { readAgentsFile } from "../../../src/workspace/loadAgents.js";

const TEST_DIR = "memory/__test_load_agents__/";
const CWD = join(process.cwd(), TEST_DIR);

before(() => {
	rmSync(CWD, { recursive: true, force: true });
	mkdirSync(CWD, { recursive: true });
});

after(() => {
	rmSync(CWD, { recursive: true, force: true });
});

describe("readAgentsFile", () => {
	it("reports the parsed byte limit in the error message", async () => {
		// Write a file larger than the 10-byte limit.
		const filePath = join(CWD, "big.md");
		writeFileSync(filePath, "x".repeat(100));

		const result = await readAgentsFile(filePath, 10);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("exceeds max read size (10)"), `Got: ${result.error}`);
	});

	it("reads a file within the limit", async () => {
		const filePath = join(CWD, "small.md");
		writeFileSync(filePath, "hello");

		const result = await readAgentsFile(filePath, 100);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.found, true);
		assert.strictEqual(result.content, "hello");
	});

	it("returns not-found for a missing file", async () => {
		const result = await readAgentsFile(join(CWD, "missing.md"), 100);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.found, false);
	});
});
