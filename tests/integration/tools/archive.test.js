/**
 * Integration tests for the archive tool.
 * Performs create-then-extract round-trips for zip, tar, and gzip.
 * @see {@link src/tools/archive/index.js}
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { archiveImpl } from "../../../src/tools/archive/index.js";

const TEST_DIR = join(process.cwd(), "memory", "__test_archive_integration__");
const ALLOWED_PATHS = [TEST_DIR];

function getOptions() {
	return { allowedPaths: ALLOWED_PATHS };
}

function setupTestFiles() {
	mkdirSync(TEST_DIR, { recursive: true });
	writeFileSync(join(TEST_DIR, "hello.txt"), "hello world");
	writeFileSync(join(TEST_DIR, "data.txt"), "some data");
	mkdirSync(join(TEST_DIR, "sub"), { recursive: true });
	writeFileSync(join(TEST_DIR, "sub", "nested.txt"), "nested content");
}

function cleanupTestFiles() {
	try {
		rmSync(TEST_DIR, { recursive: true, force: true });
	} catch {
		// ignore
	}
}

describe("tools - archive integration", () => {
	before(setupTestFiles);
	after(cleanupTestFiles);

	it("creates and extracts a zip archive round-trip", async () => {
		const archivePath = join(TEST_DIR, "out.zip");
		const destDir = join(TEST_DIR, "extracted-zip");

		const createResult = await archiveImpl(
			{
				operation: "create",
				format: "zip",
				source: join(TEST_DIR, "hello.txt"),
				destination: archivePath,
			},
			getOptions(),
		);
		assert.strictEqual(createResult.ok, true);
		assert.ok(existsSync(archivePath));

		const extractResult = await archiveImpl(
			{ operation: "extract", format: "zip", source: archivePath, destination: destDir },
			getOptions(),
		);
		assert.strictEqual(extractResult.ok, true);
		assert.strictEqual(readFileSync(join(destDir, "hello.txt"), "utf-8"), "hello world");
	});

	it("creates and extracts a tar archive round-trip", async () => {
		const archivePath = join(TEST_DIR, "out.tar");
		const destDir = join(TEST_DIR, "extracted-tar");

		const createResult = await archiveImpl(
			{
				operation: "create",
				format: "tar",
				source: join(TEST_DIR, "hello.txt"),
				destination: archivePath,
			},
			getOptions(),
		);
		assert.strictEqual(createResult.ok, true);
		assert.ok(existsSync(archivePath));

		const extractResult = await archiveImpl(
			{ operation: "extract", format: "tar", source: archivePath, destination: destDir },
			getOptions(),
		);
		assert.strictEqual(extractResult.ok, true);
		assert.strictEqual(readFileSync(join(destDir, "hello.txt"), "utf-8"), "hello world");
	});

	it("creates and extracts a gzip archive round-trip", async () => {
		const archivePath = join(TEST_DIR, "out.gz");
		const destDir = join(TEST_DIR, "extracted-gz");

		const createResult = await archiveImpl(
			{
				operation: "create",
				format: "gzip",
				source: join(TEST_DIR, "hello.txt"),
				destination: archivePath,
			},
			getOptions(),
		);
		assert.strictEqual(createResult.ok, true);
		assert.ok(existsSync(archivePath));

		const extractResult = await archiveImpl(
			{ operation: "extract", format: "gzip", source: archivePath, destination: destDir },
			getOptions(),
		);
		assert.strictEqual(extractResult.ok, true);
		// gzip stores no filename; the extracted file is the basename minus .gz
		assert.strictEqual(readFileSync(join(destDir, "out"), "utf-8"), "hello world");
	});

	it("lists entries in a zip archive", async () => {
		const archivePath = join(TEST_DIR, "list.zip");
		await archiveImpl(
			{
				operation: "create",
				format: "zip",
				source: join(TEST_DIR, "hello.txt"),
				destination: archivePath,
			},
			getOptions(),
		);

		const listResult = await archiveImpl(
			{ operation: "list", format: "zip", source: archivePath },
			getOptions(),
		);
		assert.strictEqual(listResult.ok, true);
		assert.ok(listResult.entries.includes("hello.txt"));
	});

	it("lists entries in a tar archive", async () => {
		const archivePath = join(TEST_DIR, "list.tar");
		await archiveImpl(
			{
				operation: "create",
				format: "tar",
				source: join(TEST_DIR, "hello.txt"),
				destination: archivePath,
			},
			getOptions(),
		);

		const listResult = await archiveImpl(
			{ operation: "list", format: "tar", source: archivePath },
			getOptions(),
		);
		assert.strictEqual(listResult.ok, true);
		assert.ok(listResult.entries.includes("hello.txt"));
	});

	it("rejects a path outside the allowlist", async () => {
		const result = await archiveImpl(
			{
				operation: "create",
				format: "zip",
				source: "/etc/passwd",
				destination: join(TEST_DIR, "x.zip"),
			},
			getOptions(),
		);
		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.kind, "access-denied");
	});

	it("rejects an unsupported format", async () => {
		const result = await archiveImpl(
			{
				operation: "create",
				format: "rar",
				source: join(TEST_DIR, "hello.txt"),
				destination: join(TEST_DIR, "x.rar"),
			},
			getOptions(),
		);
		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.kind, "invalid-format");
	});
});
