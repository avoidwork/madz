import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { discoveryImpl, globImpl, lsImpl } from "../../../src/tools/discovery/index.js";

const TEST_DIR = join(process.cwd(), "memory", "__test_discovery_integration__");
const ALLOWED_PATHS = [TEST_DIR];

function getOptions() {
	return { allowedPaths: ALLOWED_PATHS };
}

function buildFixtureTree() {
	const src = join(TEST_DIR, "src");
	mkdirSync(src, { recursive: true });
	writeFileSync(join(src, "index.js"), "export const foo = 1;\n");
	writeFileSync(join(src, "util.js"), "export const bar = 2;\n");
	writeFileSync(join(src, "README.md"), "# Fixture\n\nSome docs.\n");
	mkdirSync(join(src, "nested"), { recursive: true });
	writeFileSync(join(src, "nested", "deep.js"), "export const baz = 3;\n");
}

function setupTestFiles() {
	mkdirSync(TEST_DIR, { recursive: true });
	buildFixtureTree();
}

function cleanupTestFiles() {
	try {
		rmSync(TEST_DIR, { recursive: true, force: true });
	} catch {
		// ignore
	}
}

describe("tools - discovery integration", () => {
	before(setupTestFiles);
	after(cleanupTestFiles);

	it("matches files by glob pattern", async () => {
		const result = await globImpl({ path: TEST_DIR, pattern: "**/*.js" }, getOptions());
		assert.match(result, /index\.js/);
		assert.match(result, /util\.js/);
		assert.match(result, /deep\.js/);
		assert.ok(!result.includes("README.md"));
	});

	it("lists directory entries", async () => {
		const result = await lsImpl({ path: TEST_DIR }, getOptions());
		assert.match(result, /src/);
	});

	it("dispatches through discoveryImpl", async () => {
		const result = await discoveryImpl({ action: "ls", path: TEST_DIR }, getOptions());
		assert.match(result, /src/);
	});
});
