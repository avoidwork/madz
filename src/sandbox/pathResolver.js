import { resolve, sep } from "node:path";

/**
 * Split allowedPaths into positive rules and negative (exclusion) rules.
 * Negative rules start with "!".
 * @param {string[]} allowedPaths
 * @returns {{ positives: string[], negatives: string[] }}
 */
function splitRules(allowedPaths) {
	const positives = [];
	const negatives = [];
	for (const p of allowedPaths) {
		if (typeof p === "string" && p.startsWith("!")) {
			negatives.push(p.slice(1));
		} else {
			positives.push(p);
		}
	}
	return { positives, negatives };
}

/**
 * Check if a resolved path matches a rule (positive or negative).
 * @param {string} resolvedPath - The resolved absolute path to check
 * @param {string} rulePath - The rule path (without leading "!")
 * @returns {boolean}
 */
function pathMatches(resolvedPath, rulePath) {
	const resolvedRule = resolve(rulePath);
	return resolvedPath === resolvedRule || resolvedPath.startsWith(resolvedRule + sep);
}

/**
 * Check if a resolved path falls within the allowed sandbox scope.
 * Negative rules (prefixed with "!") are checked first — if a path matches
 * any exclusion rule, access is denied regardless of positive rules.
 * @param {string} requestedPath - The absolute file path to check
 * @param {string[]} allowedPaths - List of allowed base paths (may include "!exclude/" patterns)
 * @returns {{ allowed: boolean, path: string }}
 */
export function resolvePath(requestedPath, allowedPaths) {
	if (!allowedPaths || allowedPaths.length === 0) {
		return { allowed: false, path: requestedPath };
	}

	const resolved = resolve(requestedPath);
	const { positives, negatives } = splitRules(allowedPaths);

	// Check negative rules first — any match denies access
	for (const neg of negatives) {
		if (pathMatches(resolved, neg)) {
			return { allowed: false, path: resolved };
		}
	}

	// Check positive rules
	for (const pos of positives) {
		if (pathMatches(resolved, pos)) {
			return { allowed: true, path: resolved };
		}
	}

	return { allowed: false, path: resolved };
}

/**
 * Verify a file path is within the sandbox scope.
 * Throws AccessDeniedError if not allowed.
 * @param {string} requestedPath - The path to verify
 * @param {string[]} allowedPaths - Allowed directories
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
