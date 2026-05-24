import { readFileSync, existsSync } from "node:fs";
import { resolve, isAbsolute, sep } from "node:path";

/**
 * Check if a resolved path falls within the allowed sandbox scope.
 * @param {string} requestedPath - The absolute file path to check
 * @param {string[]} allowedPaths - List of allowed base paths
 * @returns {{ allowed: boolean, path: string }}
 */
export function resolvePath(requestedPath, allowedPaths) {
  if (!allowedPaths || allowedPaths.length === 0) {
    return { allowed: false, path: requestedPath };
  }

  const resolved = resolve(requestedPath);

  for (const allowedDir of allowedPaths) {
    const allowedResolved = resolve(allowedDir);
    if (resolved === allowedResolved || resolved.startsWith(allowedResolved + sep)) {
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
