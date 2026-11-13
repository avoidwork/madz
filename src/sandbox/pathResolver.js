import { lstatSync, readlinkSync, realpathSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";

const MAX_LINK_DEPTH = 40;

/**
 * Resolve a path to its real location, following symlinks. Unlike
 * `fs.realpathSync` this also works for paths that do not exist yet (the deepest
 * existing ancestor is resolved and the remainder appended) and follows dangling
 * symlinks to the location they would create, so writes cannot be redirected
 * outside the sandbox through a link.
 * @param {string} absPath - Absolute path
 * @param {number} [depth] - Symlink hops followed so far
 * @returns {string} The real path
 * @throws {Error} On symlink loops or unexpected filesystem errors
 */
function realResolve(absPath, depth = 0) {
	if (depth > MAX_LINK_DEPTH) throw new Error("too many levels of symbolic links");
	try {
		return realpathSync(absPath);
	} catch (err) {
		if (err.code !== "ENOENT" && err.code !== "ENOTDIR") throw err;
	}
	try {
		if (lstatSync(absPath).isSymbolicLink()) {
			return realResolve(resolve(dirname(absPath), readlinkSync(absPath)), depth + 1);
		}
	} catch (err) {
		if (err.code !== "ENOENT" && err.code !== "ENOTDIR") throw err;
	}
	const parent = dirname(absPath);
	if (parent === absPath) return absPath;
	return join(realResolve(parent, depth), basename(absPath));
}

/**
 * Resolve a path to its real location, or null when it cannot be resolved.
 * With `noFollow`, a symlink in the final component is not followed (the parent
 * directory is resolved instead), so a link itself can be removed or renamed.
 * @param {string} absPath - Absolute path
 * @param {boolean} [noFollow] - Do not follow the final path component
 * @returns {string | null} The real path, or null on failure
 */
function realResolveSafe(absPath, noFollow = false) {
	try {
		if (noFollow) {
			const parent = dirname(absPath);
			return parent === absPath ? absPath : join(realResolve(parent), basename(absPath));
		}
		return realResolve(absPath);
	} catch {
		return null;
	}
}

/**
 * Real location of a sandbox rule path, falling back to its lexical form.
 * @param {string} rulePath - The rule path (without leading "!")
 * @returns {string} Absolute path
 */
function realRule(rulePath) {
	return realResolveSafe(resolve(rulePath)) ?? resolve(rulePath);
}

/**
 * Split allowedPaths into positive rules and negative (exclusion) rules.
 * Negative rules start with "!". Non-string and empty rules are skipped (fail closed).
 * @param {string[]} allowedPaths - Raw rules
 * @returns {{ positives: string[], negatives: string[] }}
 */
function splitRules(allowedPaths) {
	const positives = [];
	const negatives = [];
	for (const p of allowedPaths) {
		if (typeof p !== "string" || p === "") continue;
		if (p.startsWith("!")) {
			if (p.length > 1) negatives.push(p.slice(1));
		} else {
			positives.push(p);
		}
	}
	return { positives, negatives };
}

/**
 * Check if a resolved path matches a rule (positive or negative). Matching is
 * case-sensitive: on case-insensitive filesystems it relies on realpath returning the
 * canonical case for the checked path and for the rule.
 * @param {string} resolvedPath - The resolved absolute path to check
 * @param {string} rulePath - The rule path (without leading "!")
 * @returns {boolean}
 */
function pathMatches(resolvedPath, rulePath) {
	const resolvedRule = resolve(rulePath);
	const prefix = resolvedRule.endsWith(sep) ? resolvedRule : resolvedRule + sep;
	return resolvedPath === resolvedRule || resolvedPath.startsWith(prefix);
}

/**
 * Check if a resolved path falls within the allowed sandbox scope.
 * Negative rules (prefixed with "!") are checked first — if a path matches
 * any exclusion rule, access is denied regardless of positive rules.
 * Relative rule paths resolve against `process.cwd()` at call time.
 *
 * Uses blocking fs calls (realpathSync etc.) on purpose: callers invoke this synchronously
 * via validatePath in many tools, and making it async would ripple through all of them.
 * Note the check-then-use gap: callers should open `realPath`, not the unresolved path.
 * @param {string} requestedPath - The absolute file path to check
 * @param {string[]} allowedPaths - List of allowed base paths (may include "!exclude/" patterns)
 * @param {{ noFollow?: boolean }} [options] - `noFollow` leaves a symlink in the final path
 *   component unresolved so the link itself, not its target, is checked
 * @returns {{ allowed: boolean, path: string, realPath?: string }}
 */
export function resolvePath(requestedPath, allowedPaths, options = {}) {
	if (!allowedPaths || allowedPaths.length === 0) {
		return { allowed: false, path: requestedPath };
	}

	const resolved = resolve(requestedPath);
	const real = realResolveSafe(resolved, options.noFollow);
	if (real === null) {
		// Unresolvable (symlink loop, permission error): fail closed.
		return { allowed: false, path: resolved };
	}

	const { positives, negatives } = splitRules(allowedPaths);

	// Check negative rules first — a match on the logical or the real location denies access
	for (const neg of negatives) {
		if (pathMatches(resolved, neg) || pathMatches(real, neg) || pathMatches(real, realRule(neg))) {
			return { allowed: false, path: resolved, realPath: real };
		}
	}

	// Check positive rules against the symlink-resolved location, so a link inside
	// the sandbox cannot reach files outside it.
	for (const pos of positives) {
		if (pathMatches(real, realRule(pos))) {
			return { allowed: true, path: resolved, realPath: real };
		}
	}

	return { allowed: false, path: resolved, realPath: real };
}

/**
 * Verify a file path is within the sandbox scope.
 * Throws AccessDeniedError if not allowed.
 * @param {string} requestedPath - The path to verify
 * @param {string[]} allowedPaths - Allowed directories
 * @returns {string} The resolved absolute path
 * @throws {Error} If the path is outside the sandbox
 */
export function assertPathAllowed(requestedPath, allowedPaths) {
	const { allowed, path } = resolvePath(requestedPath, allowedPaths);
	if (!allowed) {
		const err = new Error(`Access denied: ${requestedPath} is outside sandbox scope`);
		err.name = "AccessDeniedError";
		throw err;
	}
	return path;
}
