import { mkdir, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

/** Filename of the user profile inside the context directory. */
export const PROFILE_FILENAME = "profile.md";
/** Filename of the reflection summary inside the context directory. */
export const REFLECTION_FILENAME = "reflection.md";

/**
 * Error thrown when a path would escape its base directory.
 */
export class PathContainmentError extends Error {
	/**
	 * @param {string} message - Description of the violation
	 */
	constructor(message) {
		super(message);
		this.name = "PathContainmentError";
		this.code = "EPATHESCAPE";
	}
}

/**
 * Check whether `target` equals `root` or lives beneath it.
 * @param {string} root - Absolute, normalised root path
 * @param {string} target - Absolute, normalised candidate path
 * @returns {boolean} True when contained
 */
function isInside(root, target) {
	const prefix = root.endsWith(sep) ? root : root + sep;
	return target === root || target.startsWith(prefix);
}

/**
 * Lexically resolve `rel` beneath `base`, rejecting absolute paths, NUL bytes
 * and `..` escapes.
 * @param {string} base - Base directory
 * @param {string} rel - Relative path beneath the base
 * @returns {string} The resolved absolute path (equal to base or beneath it)
 * @throws {PathContainmentError} When the path escapes the base
 */
export function resolveInside(base, rel) {
	if (typeof rel !== "string" || rel.includes("\0")) {
		throw new PathContainmentError("Path must be a string without NUL bytes");
	}
	if (isAbsolute(rel)) throw new PathContainmentError(`Absolute path not allowed: ${rel}`);
	const root = resolve(base);
	const target = resolve(root, rel);
	if (!isInside(root, target)) {
		throw new PathContainmentError(`Path escapes base directory: ${rel}`);
	}
	return target;
}

/**
 * Resolve the real path of the nearest existing ancestor of `p`.
 * @param {string} p - Absolute path that may not exist yet
 * @returns {Promise<string>} Real path of the nearest existing ancestor
 */
async function realpathOfExisting(p) {
	let probe = p;
	for (;;) {
		try {
			return await realpath(probe);
		} catch (err) {
			const parent = dirname(probe);
			if (err.code !== "ENOENT" || parent === probe) throw err;
			probe = parent;
		}
	}
}

/**
 * Like {@link resolveInside} but also verifies, via realpath of the nearest
 * existing ancestor, that symlinks do not lead outside the base.
 * @param {string} base - Base directory
 * @param {string} rel - Relative path beneath the base
 * @returns {Promise<string>} The resolved absolute path
 * @throws {PathContainmentError} When the path or a symlink escapes the base
 */
export async function resolveInsideReal(base, rel) {
	const target = resolveInside(base, rel);
	const [realRoot, realTarget] = await Promise.all([
		realpathOfExisting(resolve(base)),
		realpathOfExisting(target),
	]);
	if (!isInside(realRoot, realTarget)) {
		throw new PathContainmentError(`Path resolves outside base directory: ${rel}`);
	}
	return target;
}

/**
 * Convert an absolute path to a path relative to `base`; relative inputs are
 * returned unchanged. An absolute path outside `base` yields a `..` path that
 * the containment helpers then reject.
 * @param {string} base - Base directory
 * @param {string} p - Relative or absolute path
 * @returns {string} Path relative to base
 */
function toRelative(base, p) {
	return typeof p === "string" && isAbsolute(p) ? relative(resolve(base), p) : p;
}

/**
 * Resolve a (configured) context directory beneath `base`. Absolute inputs
 * are accepted only when they lie inside `base`; anything else is rejected.
 * @param {string} contextDir - Relative or absolute directory
 * @param {string} base - Base directory for relative paths
 * @returns {string} The resolved absolute directory
 * @throws {PathContainmentError} When the directory escapes the base
 */
export function resolveContextDir(contextDir, base) {
	return resolveInside(base, toRelative(base, contextDir));
}

/**
 * Create `rel` beneath `base` (recursively) after verifying it
 * stays inside the base, including through symlinks. Absolute `rel` values
 * are accepted only when inside `base`.
 * @param {string} base - Base directory
 * @param {string} rel - Directory path relative to base
 * @returns {Promise<string>} The absolute directory path
 */
export async function ensureDir(base, rel) {
	const dir = await resolveInsideReal(base, toRelative(base, rel));
	await mkdir(dir, { recursive: true });
	return dir;
}
