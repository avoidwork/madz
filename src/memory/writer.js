import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { dump } from "js-yaml";
import { loadConfig } from "../config/loader.js";
import { ensureDir } from "./paths.js";
import { writeFileAtomic } from "./fsUtil.js";

const FRONTMATTER_DELIMITER = "---";
const MAX_SLUG_LENGTH = 60;
const KEY_RE = /^[A-Za-z_][\w-]*$/;
const RESERVED_KEYS = Object.freeze(["title", "timestamp"]);

/**
 * Validate caller frontmatter and drop undefined values.
 * @param {Object} frontmatter - Caller-supplied metadata
 * @returns {Object} A clean plain object safe to serialise
 * @throws {TypeError} For non-object frontmatter
 * @throws {RangeError} For invalid or reserved keys
 */
function sanitizeFrontmatter(frontmatter) {
	if (frontmatter === null || typeof frontmatter !== "object" || Array.isArray(frontmatter)) {
		throw new TypeError("frontmatter must be a plain object");
	}
	const clean = {};
	for (const [key, value] of Object.entries(frontmatter)) {
		if (!KEY_RE.test(key)) throw new RangeError(`Invalid frontmatter key: ${key}`);
		if (RESERVED_KEYS.includes(key)) {
			throw new RangeError(`Frontmatter key "${key}" is reserved and set by the writer`);
		}
		if (value !== undefined) clean[key] = value;
	}
	return clean;
}

/**
 * Write a memory file with YAML frontmatter.
 * Creates a timestamped markdown file in the specified directory, resolved
 * relative to config.cwd (the subdirectory must stay inside config.cwd).
 * The file is written atomically with owner-only permissions. The frontmatter
 * `timestamp` is a real ISO-8601 string; only the filename is sanitised.
 * @param {string} subdirectory - The subdirectory relative to config.cwd
 * @param {string} title - A short title for the entry (must be a string)
 * @param {Object} [frontmatter] - YAML frontmatter metadata (keys `title` and `timestamp` are reserved)
 * @param {string} [body] - The markdown body content
 * @returns {Promise<string>} The path of the created file
 * @throws {TypeError} When title is not a string or frontmatter is not an object
 * @throws {RangeError} When a frontmatter key is invalid or reserved
 */
export async function writeMemoryFile(subdirectory, title, frontmatter = {}, body = "") {
	if (typeof title !== "string") throw new TypeError("title must be a string");
	const extra = sanitizeFrontmatter(frontmatter);
	const config = loadConfig();
	const directory = await ensureDir(config.cwd, subdirectory);
	const now = new Date().toISOString();
	const slug = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, MAX_SLUG_LENGTH)
		.replace(/-$/, "");
	const suffix = randomBytes(3).toString("hex");
	const filename = `${now.replace(/[:.]/g, "-")}-${slug || "entry"}-${suffix}.md`;
	const filepath = join(directory, filename);

	// Reserved keys first so callers cannot override or duplicate them.
	const yamlText = dump({ title, timestamp: now, ...extra }, { lineWidth: -1, noRefs: true });
	const content = [FRONTMATTER_DELIMITER, yamlText.trimEnd(), FRONTMATTER_DELIMITER, "", body, ""];
	await writeFileAtomic(filepath, content.join("\n"));
	return filepath;
}
