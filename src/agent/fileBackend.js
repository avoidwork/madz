import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve, relative, dirname, extname } from "node:path";

/**
 * File-based backend for deepagents middleware.
 * Implements BackendProtocolV2 for file storage in a specific directory.
 */
export class FileBackend {
	/**
	 * @param {string} rootDir - Root directory for file storage
	 * @param {object} [options] - Backend options
	 * @param {string[]} [options.allowedPaths] - Allowed paths for file operations
	 * @param {string} [options.maxReadSize] - Maximum read size (e.g., "1mb")
	 */
	constructor(rootDir, options = {}) {
		this.rootDir = resolve(rootDir);
		this.allowedPaths = options.allowedPaths || [this.rootDir];
		this.maxReadSize = options.maxReadSize || "1mb";
	}

	/**
	 * Resolve a file path relative to the root directory.
	 * @param {string} filePath - File path to resolve
	 * @returns {string} Resolved absolute path
	 */
	_resolvePath(filePath) {
		const resolved = resolve(this.rootDir, filePath);
		// Check if resolved path is within allowed paths
		for (const allowed of this.allowedPaths) {
			if (resolved.startsWith(allowed)) {
				return resolved;
			}
		}
		throw new Error(`Permission denied: ${filePath} is outside allowed paths`);
	}

	/**
	 * Parse maxReadSize string to bytes.
	 * @param {string} sizeStr - Size string (e.g., "1mb", "500kb")
	 * @returns {number} Size in bytes
	 */
	_parseSize(sizeStr) {
		const match = sizeStr.match(/^(\d+)(kb|mb|gb)?$/i);
		if (!match) return 1048576; // default 1mb
		const value = parseInt(match[1], 10);
		const unit = (match[2] || "b").toLowerCase();
		const multipliers = { b: 1, kb: 1024, mb: 1048576, gb: 1073741824 };
		return value * (multipliers[unit] || 1);
	}

	/**
	 * Get MIME type from file extension.
	 * @param {string} filePath - File path
	 * @returns {string} MIME type
	 */
	_getMimeType(filePath) {
		const ext = extname(filePath).toLowerCase();
		const mimeTypes = {
			".txt": "text/plain",
			".js": "text/javascript",
			".ts": "text/typescript",
			".json": "application/json",
			".md": "text/markdown",
			".html": "text/html",
			".css": "text/css",
			".py": "text/x-python",
			".yaml": "text/yaml",
			".yml": "text/yaml",
			".xml": "application/xml",
			".csv": "text/csv",
			".png": "image/png",
			".jpg": "image/jpeg",
			".jpeg": "image/jpeg",
			".gif": "image/gif",
			".svg": "image/svg+xml",
			".pdf": "application/pdf",
		};
		return mimeTypes[ext] || "application/octet-stream";
	}

	/**
	 * Check if file is binary based on MIME type.
	 * @param {string} filePath - File path
	 * @returns {boolean} True if binary
	 */
	_isBinary(filePath) {
		const mime = this._getMimeType(filePath);
		return !mime.startsWith("text/");
	}

	// --- BackendProtocolV2 methods ---

	/**
	 * Structured listing with file metadata.
	 * @param {string} path - Absolute path to directory
	 * @returns {{ error?: string, files?: import("./types.js").FileInfo[] }}
	 */
	ls(path) {
		try {
			const resolved = this._resolvePath(path);
			if (!existsSync(resolved)) {
				return { error: `Directory not found: ${path}` };
			}
			if (!statSync(resolved).isDirectory()) {
				return { error: `Not a directory: ${path}` };
			}
			const entries = readdirSync(resolved, { withFileTypes: true });
			const files = entries.map((entry) => {
				const entryPath = join(path, entry.name);
				const fullEntryPath = join(resolved, entry.name);
				const stat = statSync(fullEntryPath);
				return {
					path: entryPath,
					is_dir: entry.isDirectory(),
					size: stat.size,
					modified_at: stat.mtime.toISOString(),
				};
			});
			return { files };
		} catch (err) {
			return { error: err.message };
		}
	}

	/**
	 * Read file content.
	 * @param {string} filePath - Absolute file path
	 * @param {number} [offset=0] - Line offset to start reading from
	 * @param {number} [limit=500] - Maximum number of lines to read
	 * @returns {{ error?: string, content?: string, mimeType?: string }}
	 */
	read(filePath, offset = 0, limit = 500) {
		try {
			const resolved = this._resolvePath(filePath);
			if (!existsSync(resolved)) {
				return { error: `File not found: ${filePath}` };
			}
			if (this._isBinary(filePath)) {
				return { error: `Binary file not supported for text read: ${filePath}` };
			}
			const content = readFileSync(resolved, "utf-8");
			const maxBytes = this._parseSize(this.maxReadSize);
			if (content.length > maxBytes) {
				return { error: `File exceeds max read size: ${filePath}` };
			}
			const lines = content.split("\n");
			const start = Math.max(0, offset);
			const end = Math.min(lines.length, start + limit);
			const sliced = lines.slice(start, end).join("\n");
			return { content: sliced, mimeType: this._getMimeType(filePath) };
		} catch (err) {
			return { error: err.message };
		}
	}

	/**
	 * Read file content as raw FileData.
	 * @param {string} filePath - Absolute file path
	 * @returns {{ error?: string, data?: { content: string | Uint8Array, mimeType: string, created_at: string, modified_at: string } }}
	 */
	readRaw(filePath) {
		try {
			const resolved = this._resolvePath(filePath);
			if (!existsSync(resolved)) {
				return { error: `File not found: ${filePath}` };
			}
			const stat = statSync(resolved);
			const content = readFileSync(resolved);
			const mimeType = this._getMimeType(filePath);
			const isText = mimeType.startsWith("text/");
			return {
				data: {
					content: isText ? content.toString("utf-8") : content,
					mimeType,
					created_at: stat.birthtime.toISOString(),
					modified_at: stat.mtime.toISOString(),
				},
			};
		} catch (err) {
			return { error: err.message };
		}
	}

	/**
	 * Search file contents for a literal text pattern.
	 * @param {string} pattern - Literal text pattern to search for
	 * @param {string|null} [path=null] - Base path to search from
	 * @param {string|null} [glob=null] - Optional glob pattern to filter files
	 * @returns {{ error?: string, matches?: { path: string, line: number, text: string }[] }}
	 */
	grep(pattern, path = null, glob = null) {
		try {
			const searchRoot = path ? this._resolvePath(path) : this.rootDir;
			if (!existsSync(searchRoot)) {
				return { error: `Path not found: ${path || searchRoot}` };
			}
			const matches = [];
			const walk = (dir) => {
				const entries = readdirSync(dir, { withFileTypes: true });
				for (const entry of entries) {
					const fullPath = join(dir, entry.name);
					if (entry.isDirectory()) {
						walk(fullPath);
					} else {
						// Check glob filter
						if (glob) {
							const fileName = entry.name;
							const globPattern = glob.replace(/\*/g, ".*");
							const regex = new RegExp(`^${globPattern}$`);
							if (!regex.test(fileName)) continue;
						}
						// Skip binary files
						if (this._isBinary(entry.name)) continue;
						// Read and search
						try {
							const content = readFileSync(fullPath, "utf-8");
							const lines = content.split("\n");
							for (let i = 0; i < lines.length; i++) {
								if (lines[i].includes(pattern)) {
									const relPath = relative(this.rootDir, fullPath);
									matches.push({
										path: relPath,
										line: i + 1,
										text: lines[i],
									});
								}
							}
						} catch {
							// Skip files that can't be read
						}
					}
				}
			};
			walk(searchRoot);
			return { matches };
		} catch (err) {
			return { error: err.message };
		}
	}

	/**
	 * Structured glob matching returning FileInfo objects.
	 * @param {string} pattern - Glob pattern
	 * @param {string} [path="/"] - Base path to search from
	 * @returns {{ error?: string, files?: { path: string, is_dir?: boolean, size?: number, modified_at?: string }[] }}
	 */
	glob(pattern, path = "/") {
		try {
			const searchRoot = path === "/" ? this.rootDir : this._resolvePath(path);
			if (!existsSync(searchRoot)) {
				return { error: `Path not found: ${path}` };
			}
			const files = [];
			const globPattern = pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*");
			const regex = new RegExp(`^${globPattern}$`);
			const walk = (dir) => {
				const entries = readdirSync(dir, { withFileTypes: true });
				for (const entry of entries) {
					const relPath = relative(this.rootDir, join(dir, entry.name));
					if (regex.test(relPath)) {
						const fullEntryPath = join(dir, entry.name);
						const stat = statSync(fullEntryPath);
						files.push({
							path: relPath,
							is_dir: entry.isDirectory(),
							size: stat.size,
							modified_at: stat.mtime.toISOString(),
						});
					}
					if (entry.isDirectory()) {
						walk(join(dir, entry.name));
					}
				}
			};
			walk(searchRoot);
			return { files };
		} catch (err) {
			return { error: err.message };
		}
	}

	// --- BackendProtocolV1 methods (required by v2) ---

	/**
	 * Structured listing with file metadata (v1).
	 * @param {string} path - Absolute path to directory
	 * @returns {import("./types.js").FileInfo[]}
	 */
	lsInfo(path) {
		const result = this.ls(path);
		if (result.error) throw new Error(result.error);
		return result.files || [];
	}

	/**
	 * Search file contents (v1).
	 * @param {string} pattern - Pattern to search
	 * @param {string|null} [path=null] - Base path
	 * @param {string|null} [glob=null] - Glob filter
	 * @returns {import("./types.js").GrepMatch[] | string}
	 */
	grepRaw(pattern, path = null, glob = null) {
		const result = this.grep(pattern, path, glob);
		if (result.error) return result.error;
		return result.matches || [];
	}

	/**
	 * Structured glob matching (v1).
	 * @param {string} pattern - Glob pattern
	 * @param {string} [path="/"] - Base path
	 * @returns {import("./types.js").FileInfo[]}
	 */
	globInfo(pattern, path = "/") {
		const result = this.glob(pattern, path);
		if (result.error) throw new Error(result.error);
		return result.files || [];
	}

	/**
	 * Create a new file.
	 * @param {string} filePath - Absolute file path
	 * @param {string} content - File content
	 * @returns {{ error?: string, path?: string, filesUpdate?: null, metadata?: Record<string, unknown> }}
	 */
	write(filePath, content) {
		try {
			const resolved = this._resolvePath(filePath);
			const dir = dirname(resolved);
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true });
			}
			writeFileSync(resolved, content, "utf-8");
			return { path: filePath, filesUpdate: null };
		} catch (err) {
			return { error: err.message };
		}
	}

	/**
	 * Edit a file by replacing string occurrences.
	 * @param {string} filePath - Absolute file path
	 * @param {string} oldString - String to find
	 * @param {string} newString - Replacement string
	 * @param {boolean} [replaceAll=false] - Replace all occurrences
	 * @returns {{ error?: string, path?: string, filesUpdate?: null, occurrences?: number }}
	 */
	edit(filePath, oldString, newString, replaceAll = false) {
		try {
			const resolved = this._resolvePath(filePath);
			if (!existsSync(resolved)) {
				return { error: `File not found: ${filePath}` };
			}
			let content = readFileSync(resolved, "utf-8");
			const flags = replaceAll ? "g" : "";
			const regex = new RegExp(oldString.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);
			const matches = content.match(regex);
			const occurrences = matches ? matches.length : 0;
			content = content.replace(regex, newString);
			writeFileSync(resolved, content, "utf-8");
			return { path: filePath, filesUpdate: null, occurrences };
		} catch (err) {
			return { error: err.message };
		}
	}
}
