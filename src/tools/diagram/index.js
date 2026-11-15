/**
 * Diagram tool.
 * Renders mermaid and graphviz diagram specs to SVG or PNG with sandbox
 * allowlist enforcement on output paths.
 * @module tools/diagram
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { instance as vizInstance } from "@viz-js/viz";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { validatePath } from "../common.js";
import { loadConfig } from "../../config/loader.js";
import { getProjectCwd } from "../../workspace/project.js";

const config = loadConfig();

/** Supported diagram formats. */
const VALID_FORMATS = ["mermaid", "graphviz"];

/** Supported output types. */
const VALID_OUTPUTS = ["svg", "png"];

/** Lazily initialized graphviz instance. */
let vizInstancePromise;

/**
 * Resolve the effective base directory for the diagram tool.
 * Prefers the active project cwd, then falls back to `config.cwd`.
 * @returns {string} The base directory for resolving relative paths
 */
function resolveBaseDir() {
	return getProjectCwd() || config.cwd || process.cwd();
}

/**
 * Resolve a path against the base directory, then validate it against the
 * sandbox allowlist.
 * @param {string} filePath - The requested path (may be relative)
 * @param {string[]} allowedPaths - Sandbox-allowed paths
 * @returns {{ allowed: boolean, path: string, realPath?: string, error?: string }}
 */
function resolveAndValidate(filePath, allowedPaths) {
	const resolved = filePath.startsWith("/") ? filePath : path.resolve(resolveBaseDir(), filePath);
	return validatePath(resolved, allowedPaths);
}

/**
 * Get the graphviz instance, initializing it lazily.
 * @returns {Promise<object>} The graphviz instance
 */
async function getViz() {
	if (!vizInstancePromise) {
		vizInstancePromise = vizInstance();
	}
	return vizInstancePromise;
}

/**
 * Set up a minimal jsdom environment for mermaid rendering.
 * Mermaid requires a DOM; this provides window, document, navigator, and a
 * getBBox polyfill on SVG elements so mermaid can render headlessly.
 */
async function setupMermaidDom() {
	// Lazy import so graphviz-only renders never load jsdom.
	const { JSDOM } = await import("jsdom");
	const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
	global.window = dom.window;
	global.document = dom.window.document;
	Object.defineProperty(global, "navigator", { value: dom.window.navigator, configurable: true });
	global.CSSStyleSheet = dom.window.CSSStyleSheet;
	global.DOMParser = dom.window.DOMParser;
	global.SVGElement = dom.window.SVGElement;
	global.Element = dom.window.Element;
	global.Node = dom.window.Node;
	global.getComputedStyle = dom.window.getComputedStyle;
	global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
	global.cancelAnimationFrame = (id) => clearTimeout(id);
	// Polyfill getBBox, which jsdom does not implement on SVG elements.
	dom.window.SVGElement.prototype.getBBox = function () {
		return { x: 0, y: 0, width: 100, height: 100 };
	};
	return dom;
}

/**
 * Render a mermaid diagram spec to SVG.
 * @param {string} source - The mermaid diagram spec
 * @returns {Promise<string>} The rendered SVG
 */
async function renderMermaid(source) {
	await setupMermaidDom();
	const mermaid = (await import("mermaid")).default;
	mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });
	const { svg } = await mermaid.render(`diagram-${Date.now()}`, source);
	return svg;
}

/**
 * Render a graphviz diagram spec to SVG.
 * @param {string} source - The graphviz (DOT) diagram spec
 * @returns {Promise<string>} The rendered SVG
 */
async function renderGraphviz(source) {
	const viz = await getViz();
	const result = viz.render(source, { format: "svg" });
	if (result.status !== "success") {
		throw new Error(result.errors?.join("; ") || "Graphviz rendering failed");
	}
	return result.output;
}

/**
 * Convert an SVG string to a PNG buffer.
 * @param {string} svg - The SVG document
 * @returns {Promise<Buffer>} The PNG buffer
 */
async function svgToPng(svg) {
	return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Render a diagram and write it to the destination path.
 * @param {object} input - Tool input
 * @param {object} options - Runtime options (allowedPaths)
 * @returns {Promise<object>} Result of the operation
 */
async function renderDiagram(input, options) {
	const { format, source, output, destination } = input;
	const allowedPaths = options.allowedPaths || [];

	if (!source || typeof source !== "string" || source.trim().length === 0) {
		return {
			ok: false,
			error: "Diagram source is required and must be a non-empty string",
			kind: "invalid-input",
		};
	}

	// Validate destination path.
	const destCheck = resolveAndValidate(destination, allowedPaths);
	if (!destCheck.allowed) {
		return { ok: false, error: destCheck.error, kind: "access-denied" };
	}

	const destPath = destCheck.realPath || destCheck.path;

	try {
		let svg;
		if (format === "mermaid") {
			svg = await renderMermaid(source);
		} else if (format === "graphviz") {
			svg = await renderGraphviz(source);
		} else {
			return { ok: false, error: `Unsupported format: ${format}`, kind: "invalid-format" };
		}

		if (output === "png") {
			const png = await svgToPng(svg);
			await fs.promises.writeFile(destPath, png);
			return { ok: true, destination: destPath, format, output, bytes: png.length };
		}

		await fs.promises.writeFile(destPath, svg, "utf-8");
		return { ok: true, destination: destPath, format, output, bytes: Buffer.byteLength(svg) };
	} catch (err) {
		return {
			ok: false,
			error: `Failed to render ${format} diagram: ${err.message}`,
			kind: "render-failed",
		};
	}
}

/**
 * Core diagram tool logic.
 * @param {object} input - The tool input
 * @param {object} [options] - Runtime options
 * @param {string[]} [options.allowedPaths] - Sandbox-allowed paths
 * @returns {Promise<object>} Result of the operation
 */
export async function diagramImpl(input = {}, options = {}) {
	const { format, output } = input;

	if (!VALID_FORMATS.includes(format)) {
		return {
			ok: false,
			error: `Unknown format: '${format}'. Valid formats: ${VALID_FORMATS.join(", ")}`,
			kind: "invalid-format",
		};
	}

	if (!VALID_OUTPUTS.includes(output)) {
		return {
			ok: false,
			error: `Unknown output: '${output}'. Valid outputs: ${VALID_OUTPUTS.join(", ")}`,
			kind: "invalid-output",
		};
	}

	const allowedPaths = options.allowedPaths || config.sandbox?.paths || [];
	return renderDiagram(input, { ...options, allowedPaths });
}

const formatSchema = z.enum(VALID_FORMATS).describe("Diagram format: mermaid or graphviz");
const outputSchema = z.enum(VALID_OUTPUTS).describe("Output type: svg or png");

/**
 * First-class diagram tool. Renders mermaid and graphviz diagram specs to SVG
 * or PNG. Enforces the sandbox allowlist on the output path via `validatePath`.
 */
export const diagram = tool((input, options = {}) => diagramImpl(input, options), {
	name: "diagram",
	description:
		"Diagram tool. Renders mermaid or graphviz diagram specs to SVG or PNG. " +
		"formats: mermaid, graphviz. outputs: svg, png. " +
		"The output path is validated against the sandbox allowlist.",
	schema: z.object({
		format: formatSchema,
		source: z.string().min(1).describe("The diagram spec (mermaid or graphviz/DOT)"),
		output: outputSchema,
		destination: z.string().describe("Output file path"),
	}),
});
