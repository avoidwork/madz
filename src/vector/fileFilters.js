/**
 * Shared file-filtering helpers and defaults for the vector pipeline.
 *
 * @module vector/fileFilters
 */

import { basename, extname } from "node:path";
import { loadConfig } from "../config/loader.js";

/** Default glob patterns for files to include during indexing. */
export const DEFAULT_INCLUDE = ["src/**/*.js", "src/**/*.mjs", "src/**/*.cjs"];

/** Default glob patterns for files to exclude during indexing. */
export const DEFAULT_EXCLUDE = [
	"node_modules/**",
	".git/**",
	".worktrees/**",
	"coverage/**",
	"dist/**",
];

/** Binary file extensions (lowercase, with leading dot). */
export const BINARY_EXTENSIONS = new Set([
	".png",
	".jpg",
	".jpeg",
	".gif",
	".bmp",
	".ico",
	".svg",
	".webp",
	".avif",
	".mp3",
	".wav",
	".ogg",
	".flac",
	".aac",
	".wma",
	".mp4",
	".avi",
	".mkv",
	".mov",
	".wmv",
	".webm",
	".zip",
	".tar",
	".gz",
	".bz2",
	".xz",
	".7z",
	".rar",
	".pdf",
	".doc",
	".docx",
	".xls",
	".xlsx",
	".ppt",
	".pptx",
	".ttf",
	".otf",
	".woff",
	".woff2",
	".eot",
	".o",
	".a",
	".so",
	".dll",
	".dylib",
	".exe",
	".wasm",
	".pyc",
	".pyo",
	".pyd",
	".class",
	".jar",
	".node",
	".sqlite",
	".sqlite3",
]);

/** Binary/junk files matched by exact basename (no real extension). */
export const BINARY_BASENAMES = new Set([".ds_store", ".gitkeep", "thumbs.db"]);

/**
 * Secret-looking file names, skipped by default.
 */
const SECRET_PATTERNS = [
	/^\.env(\..*)?$/i,
	/\.pem$/i,
	/\.key$/i,
	/\.p12$/i,
	/\.pfx$/i,
	/\.keystore$/i,
	/\.jks$/i,
	/^id_(rsa|dsa|ecdsa|ed25519)(\..*)?$/i,
	/^\.npmrc$/i,
	/^\.netrc$/i,
	/^\.pgpass$/i,
	/^credentials(\.json)?$/i,
];

/**
 * @param {string} filePath - Path or file name
 * @returns {boolean} True if the file is considered binary by name
 */
export function isBinaryPath(filePath) {
	if (BINARY_BASENAMES.has(basename(filePath).toLowerCase())) return true;
	return BINARY_EXTENSIONS.has(extname(filePath).toLowerCase());
}

/**
 * @param {string} filePath - Path or file name
 * @returns {boolean} True if the file looks like it contains secrets
 */
export function isSecretFile(filePath) {
	const name = basename(filePath);
	return SECRET_PATTERNS.some((re) => re.test(name));
}

/**
 * @param {string} content - File content as string
 * @returns {boolean} True if null bytes are found
 */
export function hasNullBytes(content) {
	return content.includes("\0");
}

let cachedMaxFileSize;

/**
 * Default max file size from config (loaded once).
 * @returns {number}
 */
export function getDefaultMaxFileSize() {
	cachedMaxFileSize ??= loadConfig().vector.maxFileSize;
	return cachedMaxFileSize;
}

/**
 * Log a warning to stderr.
 * @param {string} msg - Message
 */
export function warn(msg) {
	process.stderr.write(`[vector] warn: ${msg}\n`);
}

/**
 * Log a debug message to stderr when DEBUG includes "vector".
 * @param {string} msg - Message
 */
export function debug(msg) {
	if ((process.env.DEBUG ?? "").includes("vector")) {
		process.stderr.write(`[vector] debug: ${msg}\n`);
	}
}
