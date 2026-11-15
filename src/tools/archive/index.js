/**
 * Archive tool.
 * Creates, extracts, and lists zip, tar, and gzip archives with sandbox
 * allowlist enforcement and path-traversal protection.
 * @module tools/archive
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ZipArchive, TarArchive } from "archiver";
import unzipper from "unzipper";
import * as tar from "tar";
import fs from "node:fs";
import path from "node:path";
import { createGunzip, createGzip } from "node:zlib";
import { validatePath } from "../common.js";
import { loadConfig } from "../../config/loader.js";
import { getProjectCwd } from "../../workspace/project.js";

const config = loadConfig();

/** Supported operations. */
const VALID_OPERATIONS = ["create", "extract", "list"];

/** Supported archive formats. */
const VALID_FORMATS = ["zip", "tar", "gzip"];

/**
 * Resolve the effective base directory for the archive tool.
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
	const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(resolveBaseDir(), filePath);
	return validatePath(resolved, allowedPaths);
}

/**
 * Resolve a destination directory, creating it if needed, and validate it
 * against the sandbox allowlist.
 * @param {string} dirPath - The requested destination directory
 * @param {string[]} allowedPaths - Sandbox-allowed paths
 * @returns {Promise<{ allowed: boolean, path: string, realPath?: string, error?: string }>}
 */
async function resolveAndEnsureDir(dirPath, allowedPaths) {
	const resolved = path.isAbsolute(dirPath) ? dirPath : path.resolve(resolveBaseDir(), dirPath);
	const check = validatePath(resolved, allowedPaths);
	if (!check.allowed) return check;
	await fs.promises.mkdir(check.realPath || check.path, { recursive: true });
	return check;
}

/**
 * Create an archive from source paths.
 * @param {object} input - Tool input
 * @param {object} options - Runtime options (allowedPaths)
 * @returns {Promise<object>} Result of the operation
 */
async function createArchive(input, options) {
	const { format, source, sources, destination } = input;
	const allowedPaths = options.allowedPaths || [];

	// Validate destination path.
	const destCheck = resolveAndValidate(destination, allowedPaths);
	if (!destCheck.allowed) {
		return { ok: false, error: destCheck.error, kind: "access-denied" };
	}

	// Validate each source path. Prefer `sources` array, fall back to `source`.
	const sourceList = sources && sources.length > 0 ? sources : [source];
	const validatedSources = [];
	for (const src of sourceList) {
		if (!src) {
			return { ok: false, error: "A source path is required", kind: "invalid-input" };
		}
		const srcCheck = resolveAndValidate(src, allowedPaths);
		if (!srcCheck.allowed) {
			return { ok: false, error: srcCheck.error, kind: "access-denied" };
		}
		validatedSources.push(srcCheck.realPath || srcCheck.path);
	}

	const destPath = destCheck.realPath || destCheck.path;

	try {
		if (format === "gzip") {
			await createGzipArchive(validatedSources, destPath);
		} else {
			await createStreamingArchive(format, validatedSources, destPath);
		}
		return { ok: true, destination: destPath, format, sources: validatedSources };
	} catch (err) {
		return {
			ok: false,
			error: `Failed to create ${format} archive: ${err.message}`,
			kind: "archive-failed",
		};
	}
}

/**
 * Create a zip or tar archive using the archiver library.
 * @param {string} format - Archive format (zip or tar)
 * @param {string[]} sources - Validated source paths
 * @param {string} destPath - Destination archive path
 * @returns {Promise<void>} Resolves when the archive is finalized
 */
async function createStreamingArchive(format, sources, destPath) {
	await new Promise((resolve, reject) => {
		const output = fs.createWriteStream(destPath);
		const archive = format === "zip" ? new ZipArchive() : new TarArchive();

		output.on("close", resolve);
		output.on("error", reject);
		archive.on("error", reject);
		archive.on("warning", (err) => {
			if (err.code !== "ENOENT") reject(err);
		});

		archive.pipe(output);

		for (const src of sources) {
			const stat = fs.statSync(src);
			if (stat.isDirectory()) {
				archive.directory(src, path.basename(src));
			} else {
				archive.file(src, { name: path.basename(src) });
			}
		}

		archive.finalize();
	});
}

/**
 * Create a gzip archive from a single source file.
 * @param {string[]} sources - Validated source paths (expects one file)
 * @param {string} destPath - Destination gzip path
 * @returns {Promise<void>} Resolves when the gzip stream is closed
 */
async function createGzipArchive(sources, destPath) {
	if (sources.length !== 1) {
		throw new Error("gzip archives support exactly one source file");
	}
	const src = sources[0];
	const stat = fs.statSync(src);
	if (stat.isDirectory()) {
		throw new Error("gzip archives support a single file, not a directory");
	}
	await new Promise((resolve, reject) => {
		const input = fs.createReadStream(src);
		const gzip = createGzip();
		const output = fs.createWriteStream(destPath);
		input.pipe(gzip).pipe(output);
		output.on("close", resolve);
		output.on("error", reject);
		gzip.on("error", reject);
	});
}

/**
 * Extract an archive to a destination directory.
 * @param {object} input - Tool input
 * @param {object} options - Runtime options (allowedPaths)
 * @returns {Promise<object>} Result of the operation
 */
async function extractArchive(input, options) {
	const { format, source, destination } = input;
	const allowedPaths = options.allowedPaths || [];

	// Validate source archive path.
	const srcCheck = resolveAndValidate(source, allowedPaths);
	if (!srcCheck.allowed) {
		return { ok: false, error: srcCheck.error, kind: "access-denied" };
	}

	// Validate and ensure destination directory.
	const destCheck = await resolveAndEnsureDir(destination, allowedPaths);
	if (!destCheck.allowed) {
		return { ok: false, error: destCheck.error, kind: "access-denied" };
	}

	const srcPath = srcCheck.realPath || srcCheck.path;
	const destPath = destCheck.realPath || destCheck.path;

	try {
		if (format === "zip") {
			await extractZip(srcPath, destPath, allowedPaths);
		} else if (format === "tar") {
			await tar.x({ file: srcPath, cwd: destPath, preservePaths: false });
		} else if (format === "gzip") {
			await extractGzip(srcPath, destPath);
		}
		return { ok: true, source: srcPath, destination: destPath, format };
	} catch (err) {
		return {
			ok: false,
			error: `Failed to extract ${format} archive: ${err.message}`,
			kind: "extract-failed",
		};
	}
}

/**
 * Extract a zip archive, guarding against path traversal.
 * @param {string} srcPath - Source archive path
 * @param {string} destPath - Destination directory
 * @param {string[]} allowedPaths - Sandbox-allowed paths
 * @returns {Promise<void>} Resolves when extraction completes
 */
async function extractZip(srcPath, destPath, allowedPaths) {
	const directory = await unzipper.Open.file(srcPath);
	for (const entry of directory.files) {
		if (entry.type === "Directory") continue;
		const entryPath = path.resolve(destPath, entry.path);
		// Guard against path traversal: the resolved entry path must stay within
		// the destination directory and the sandbox allowlist.
		if (!entryPath.startsWith(destPath + path.sep)) {
			throw new Error(`Path traversal blocked: ${entry.path}`);
		}
		const check = validatePath(entryPath, allowedPaths);
		if (!check.allowed) {
			throw new Error(`Path traversal blocked: ${entry.path}`);
		}
		await fs.promises.mkdir(path.dirname(entryPath), { recursive: true });
		const content = await entry.buffer();
		await fs.promises.writeFile(entryPath, content);
	}
}

/**
 * Extract a gzip archive to a destination directory.
 * @param {string} srcPath - Source gzip path
 * @param {string} destPath - Destination directory
 * @returns {Promise<void>} Resolves when extraction completes
 */
async function extractGzip(srcPath, destPath) {
	const { createReadStream, createWriteStream } = fs;
	const basename = path.basename(srcPath).replace(/\.gz$/i, "");
	const outPath = path.join(destPath, basename);
	await new Promise((resolve, reject) => {
		const input = createReadStream(srcPath);
		const gunzip = createGunzip();
		const output = createWriteStream(outPath);
		input.pipe(gunzip).pipe(output);
		output.on("close", resolve);
		output.on("error", reject);
		gunzip.on("error", reject);
	});
}

/**
 * List the entries in an archive.
 * @param {object} input - Tool input
 * @param {object} options - Runtime options (allowedPaths)
 * @returns {Promise<object>} Result of the operation
 */
async function listArchive(input, options) {
	const { format, source } = input;
	const allowedPaths = options.allowedPaths || [];

	const srcCheck = resolveAndValidate(source, allowedPaths);
	if (!srcCheck.allowed) {
		return { ok: false, error: srcCheck.error, kind: "access-denied" };
	}

	const srcPath = srcCheck.realPath || srcCheck.path;

	try {
		if (format === "zip") {
			const directory = await unzipper.Open.file(srcPath);
			const entries = directory.files
				.filter((entry) => entry.type !== "Directory")
				.map((entry) => entry.path);
			return { ok: true, source: srcPath, format, entries };
		}
		if (format === "tar") {
			const entries = [];
			await tar.t({ file: srcPath, onentry: (entry) => entries.push(entry.path) });
			return { ok: true, source: srcPath, format, entries };
		}
		if (format === "gzip") {
			return {
				ok: true,
				source: srcPath,
				format,
				entries: [path.basename(srcPath).replace(/\.gz$/i, "")],
			};
		}
		return { ok: false, error: `Unsupported format: ${format}`, kind: "invalid-format" };
	} catch (err) {
		return {
			ok: false,
			error: `Failed to list ${format} archive: ${err.message}`,
			kind: "list-failed",
		};
	}
}

/**
 * Core archive tool logic.
 * @param {object} input - The tool input
 * @param {object} [options] - Runtime options
 * @param {string[]} [options.allowedPaths] - Sandbox-allowed paths
 * @returns {Promise<object>} Result of the operation
 */
export async function archiveImpl(input = {}, options = {}) {
	const { operation, format } = input;

	if (!VALID_OPERATIONS.includes(operation)) {
		return {
			ok: false,
			error: `Unknown operation: '${operation}'. Valid operations: ${VALID_OPERATIONS.join(", ")}`,
			kind: "invalid-operation",
		};
	}

	if (!VALID_FORMATS.includes(format)) {
		return {
			ok: false,
			error: `Unknown format: '${format}'. Valid formats: ${VALID_FORMATS.join(", ")}`,
			kind: "invalid-format",
		};
	}

	const allowedPaths = options.allowedPaths || config.sandbox?.paths || [];

	switch (operation) {
		case "create":
			return createArchive(input, { ...options, allowedPaths });
		case "extract":
			return extractArchive(input, { ...options, allowedPaths });
		case "list":
			return listArchive(input, { ...options, allowedPaths });
		default:
			return { ok: false, error: `Unknown operation: '${operation}'`, kind: "invalid-operation" };
	}
}

const operationSchema = z
	.enum(VALID_OPERATIONS)
	.describe("Operation to perform: create, extract, or list");
const formatSchema = z.enum(VALID_FORMATS).describe("Archive format: zip, tar, or gzip");
const pathSchema = z.string().describe("File or directory path");
const pathsSchema = z.array(z.string()).describe("List of source paths");

/**
 * First-class archive tool. Creates, extracts, and lists zip, tar, and gzip
 * archives. Enforces the sandbox allowlist on source/destination paths via
 * `validatePath` and guards against path traversal during extraction.
 */
export const archive = tool((input, options = {}) => archiveImpl(input, options), {
	name: "archive",
	description:
		"Archive tool. Operations: create, extract, list. Formats: zip, tar, gzip. " +
		"create builds an archive from source paths to a destination; extract writes archive contents to a destination directory; list returns the entries in an archive. " +
		"All source and destination paths are validated against the sandbox allowlist, and extraction guards against path traversal.",
	schema: z.object({
		operation: operationSchema,
		format: formatSchema,
		source: pathSchema
			.optional()
			.describe("Source file or directory path (create) or archive path (extract/list)"),
		destination: pathSchema
			.optional()
			.describe("Destination path (create) or destination directory (extract)"),
		sources: pathsSchema.optional().describe("Source paths for create (alternative to source)"),
	}),
});
