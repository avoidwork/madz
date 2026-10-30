import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
	fileImpl,
	readImpl,
	writeImpl,
	editImpl,
	deleteImpl,
} from "../../../src/tools/file/index.js";

const TEST_DIR = join(process.cwd(), "memory", "__test_file_integration__");
const ALLOWED_PATHS = [TEST_DIR];

function getOptions() {
	return { allowedPaths: ALLOWED_PATHS, maxReadSize: "1mb" };
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

describe("tools - file integration", () => {
	before(setupTestFiles);
	after(cleanupTestFiles);

	it("performs a read/write/edit/delete round-trip", async () => {
		const filePath = join(TEST_DIR, "roundtrip.txt");

		// write
		const writeResult = await writeImpl({ path: filePath, content: "hello world" }, getOptions());
		assert.strictEqual(writeResult.ok, true);
		assert.strictEqual(writeResult.path, filePath);
		assert.strictEqual(writeResult.bytesWritten, 11);
		assert.strictEqual(readFileSync(filePath, "utf-8"), "hello world");

		// read
		const readResult = await readImpl({ path: filePath }, getOptions());
		assert.strictEqual(readResult.ok, true);
		assert.deepStrictEqual(readResult.lines, ["1|hello world"]);

		// edit
		const editResult = await editImpl(
			{ path: filePath, oldString: "world", newString: "madz" },
			getOptions(),
		);
		assert.strictEqual(editResult.ok, true);
		assert.strictEqual(editResult.changes, 1);
		assert.strictEqual(readFileSync(filePath, "utf-8"), "hello madz");

		// delete
		const deleteResult = await deleteImpl({ path: filePath }, getOptions());
		assert.strictEqual(deleteResult.ok, true);
		assert.strictEqual(deleteResult.path, filePath);
		assert.strictEqual(existsSync(filePath), false);
	});

	it("dispatches through fileImpl", async () => {
		const filePath = join(TEST_DIR, "dispatch.txt");
		const result = await fileImpl(
			{ action: "write", path: filePath, content: "dispatched" },
			getOptions(),
		);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.path, filePath);
		assert.strictEqual(readFileSync(filePath, "utf-8"), "dispatched");
	});
});
