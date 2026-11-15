/**
 * Tests for the archive tool.
 * @see {@link src/tools/archive/index.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { archive, archiveImpl } from "../../../src/tools/archive/index.js";

describe("tools - archive", () => {
	describe("Zod schema validation", () => {
		it("validates all operations", () => {
			for (const operation of ["create", "extract", "list"]) {
				const result = archive.schema.safeParse({
					operation,
					format: "zip",
					source: "/tmp/file",
				});
				assert.ok(result.success, `operation '${operation}' should be valid`);
			}
		});

		it("validates all formats", () => {
			for (const format of ["zip", "tar", "gzip"]) {
				const result = archive.schema.safeParse({
					operation: "create",
					format,
					source: "/tmp/file",
					destination: "/tmp/out",
				});
				assert.ok(result.success, `format '${format}' should be valid`);
			}
		});

		it("rejects invalid operation", () => {
			const result = archive.schema.safeParse({
				operation: "bogus",
				format: "zip",
				source: "/tmp/file",
			});
			assert.strictEqual(result.success, false);
		});

		it("rejects invalid format", () => {
			const result = archive.schema.safeParse({
				operation: "create",
				format: "rar",
				source: "/tmp/file",
			});
			assert.strictEqual(result.success, false);
		});

		it("rejects missing operation", () => {
			const result = archive.schema.safeParse({ format: "zip", source: "/tmp/file" });
			assert.strictEqual(result.success, false);
		});

		it("rejects missing format", () => {
			const result = archive.schema.safeParse({ operation: "create", source: "/tmp/file" });
			assert.strictEqual(result.success, false);
		});

		it("accepts optional destination for list", () => {
			const result = archive.schema.safeParse({
				operation: "list",
				format: "tar",
				source: "/tmp/file.tar",
			});
			assert.ok(result.success);
		});

		it("accepts sources array", () => {
			const result = archive.schema.safeParse({
				operation: "create",
				format: "zip",
				sources: ["/tmp/a", "/tmp/b"],
				destination: "/tmp/out.zip",
			});
			assert.ok(result.success);
		});
	});

	describe("archiveImpl validation", () => {
		it("rejects unknown operation", async () => {
			const result = await archiveImpl(
				{ operation: "bogus", format: "zip" },
				{ allowedPaths: ["/tmp"] },
			);
			assert.strictEqual(result.ok, false);
			assert.strictEqual(result.kind, "invalid-operation");
		});

		it("rejects unknown format", async () => {
			const result = await archiveImpl(
				{ operation: "create", format: "rar" },
				{ allowedPaths: ["/tmp"] },
			);
			assert.strictEqual(result.ok, false);
			assert.strictEqual(result.kind, "invalid-format");
		});

		it("rejects path outside allowlist", async () => {
			const result = await archiveImpl(
				{ operation: "create", format: "zip", source: "/etc/passwd", destination: "/tmp/out.zip" },
				{ allowedPaths: ["/tmp"] },
			);
			assert.strictEqual(result.ok, false);
			assert.strictEqual(result.kind, "access-denied");
		});

		it("rejects destination outside allowlist", async () => {
			const result = await archiveImpl(
				{
					operation: "create",
					format: "zip",
					source: "/tmp/file.txt",
					destination: "/etc/out.zip",
				},
				{ allowedPaths: ["/tmp"] },
			);
			assert.strictEqual(result.ok, false);
			assert.strictEqual(result.kind, "access-denied");
		});
	});
});
