/**
 * Tests for the diagram tool.
 * @see {@link src/tools/diagram/index.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { diagram, diagramImpl } from "../../../src/tools/diagram/index.js";

describe("tools - diagram", () => {
	describe("Zod schema validation", () => {
		it("validates all formats", () => {
			for (const format of ["mermaid", "graphviz"]) {
				const result = diagram.schema.safeParse({
					format,
					source: "flowchart LR\n  A --> B",
					output: "svg",
					destination: "/tmp/x.svg",
				});
				assert.ok(result.success, `format '${format}' should be valid`);
			}
		});

		it("validates all outputs", () => {
			for (const output of ["svg", "png"]) {
				const result = diagram.schema.safeParse({
					format: "graphviz",
					source: "digraph { a -> b }",
					output,
					destination: "/tmp/x.svg",
				});
				assert.ok(result.success, `output '${output}' should be valid`);
			}
		});

		it("rejects invalid format", () => {
			const result = diagram.schema.safeParse({
				format: "bogus",
				source: "x",
				output: "svg",
				destination: "/tmp/x.svg",
			});
			assert.strictEqual(result.success, false);
		});

		it("rejects invalid output", () => {
			const result = diagram.schema.safeParse({
				format: "mermaid",
				source: "x",
				output: "jpg",
				destination: "/tmp/x.svg",
			});
			assert.strictEqual(result.success, false);
		});

		it("rejects missing source", () => {
			const result = diagram.schema.safeParse({
				format: "mermaid",
				output: "svg",
				destination: "/tmp/x.svg",
			});
			assert.strictEqual(result.success, false);
		});

		it("rejects missing destination", () => {
			const result = diagram.schema.safeParse({
				format: "mermaid",
				source: "x",
				output: "svg",
			});
			assert.strictEqual(result.success, false);
		});
	});

	describe("diagramImpl validation", () => {
		it("rejects unknown format", async () => {
			const result = await diagramImpl(
				{ format: "bogus", source: "x", output: "svg", destination: "/tmp/x.svg" },
				{ allowedPaths: ["/tmp"] },
			);
			assert.strictEqual(result.ok, false);
			assert.strictEqual(result.kind, "invalid-format");
		});

		it("rejects unknown output", async () => {
			const result = await diagramImpl(
				{ format: "mermaid", source: "x", output: "jpg", destination: "/tmp/x.svg" },
				{ allowedPaths: ["/tmp"] },
			);
			assert.strictEqual(result.ok, false);
			assert.strictEqual(result.kind, "invalid-output");
		});

		it("rejects empty source", async () => {
			const result = await diagramImpl(
				{ format: "mermaid", source: "", output: "svg", destination: "/tmp/x.svg" },
				{ allowedPaths: ["/tmp"] },
			);
			assert.strictEqual(result.ok, false);
			assert.strictEqual(result.kind, "invalid-input");
		});

		it("rejects path outside allowlist", async () => {
			const result = await diagramImpl(
				{
					format: "graphviz",
					source: "digraph { a -> b }",
					output: "svg",
					destination: "/etc/x.svg",
				},
				{ allowedPaths: ["/tmp"] },
			);
			assert.strictEqual(result.ok, false);
			assert.strictEqual(result.kind, "access-denied");
		});
	});
});
