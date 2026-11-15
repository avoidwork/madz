/**
 * Integration tests for the diagram tool.
 * Renders known mermaid and graphviz diagrams to SVG/PNG.
 * @see {@link src/tools/diagram/index.js}
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdirSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { diagramImpl } from "../../../src/tools/diagram/index.js";

const TEST_DIR = join(tmpdir(), `__test_diagram_integration__${process.pid}`);
const ALLOWED_PATHS = [TEST_DIR];

function getOptions() {
	return { allowedPaths: ALLOWED_PATHS };
}

function setupTestFiles() {
	mkdirSync(TEST_DIR, { recursive: true });
}

function cleanupTestFiles() {
	try {
		rmSync(TEST_DIR, { recursive: true, force: true });
	} catch {
		// ignore
	}
}

describe("tools - diagram integration", () => {
	before(setupTestFiles);
	after(cleanupTestFiles);

	it("renders a graphviz diagram to SVG", async () => {
		const dest = join(TEST_DIR, "gv.svg");
		const result = await diagramImpl(
			{ format: "graphviz", source: "digraph { a -> b }", output: "svg", destination: dest },
			getOptions(),
		);
		assert.strictEqual(result.ok, true);
		assert.ok(existsSync(dest));
		const svg = readFileSync(dest, "utf-8");
		assert.ok(svg.includes("<svg"), "SVG output should contain an <svg> element");
	});

	it("renders a graphviz diagram to PNG", async () => {
		const dest = join(TEST_DIR, "gv.png");
		const result = await diagramImpl(
			{ format: "graphviz", source: "digraph { a -> b }", output: "png", destination: dest },
			getOptions(),
		);
		assert.strictEqual(result.ok, true);
		assert.ok(existsSync(dest));
		const png = readFileSync(dest);
		// PNG magic bytes
		assert.strictEqual(png.slice(0, 4).toString("hex"), "89504e47");
	});

	it("renders a mermaid diagram to SVG", async () => {
		const dest = join(TEST_DIR, "mm.svg");
		const result = await diagramImpl(
			{ format: "mermaid", source: "flowchart LR\n  A --> B", output: "svg", destination: dest },
			getOptions(),
		);
		assert.strictEqual(result.ok, true);
		assert.ok(existsSync(dest));
		const svg = readFileSync(dest, "utf-8");
		assert.ok(svg.includes("<svg"), "SVG output should contain an <svg> element");
	});

	it("renders a mermaid diagram to PNG", async () => {
		const dest = join(TEST_DIR, "mm.png");
		const result = await diagramImpl(
			{ format: "mermaid", source: "flowchart LR\n  A --> B", output: "png", destination: dest },
			getOptions(),
		);
		assert.strictEqual(result.ok, true);
		assert.ok(existsSync(dest));
		const png = readFileSync(dest);
		assert.strictEqual(png.slice(0, 4).toString("hex"), "89504e47");
	});

	it("rejects an unsupported format", async () => {
		const result = await diagramImpl(
			{ format: "bogus", source: "x", output: "svg", destination: join(TEST_DIR, "x.svg") },
			getOptions(),
		);
		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.kind, "invalid-format");
	});

	it("rejects a path outside the allowlist", async () => {
		const result = await diagramImpl(
			{
				format: "graphviz",
				source: "digraph { a -> b }",
				output: "svg",
				destination: "/etc/x.svg",
			},
			getOptions(),
		);
		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.kind, "access-denied");
	});
});
