import { DEFAULT_PERMS } from "./types.js";

/**
 * Resolve combined permissions for a skill by merging
 * skill-scoped permissions with default scopes.
 * @param {Object} skillMetadata - The skill metadata
 * @returns {string[]} Merged list of permission scopes
 */
export function resolvePermissions(skillMetadata) {
	if (!skillMetadata || typeof skillMetadata !== "object") {
		return [...DEFAULT_PERMS];
	}

	const skillPerms = Array.isArray(skillMetadata.permissions) ? skillMetadata.permissions : [];

	// Merge and deduplicate
	const combined = new Set([...DEFAULT_PERMS, ...skillPerms]);
	return Array.from(combined);
}

// hasPermission and resolveCapabilities were removed — never imported or used
// anywhere in the codebase. resolvePermissions remains as it's used by index.js.
