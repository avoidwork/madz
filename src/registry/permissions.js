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

/**
 * Check if a skill has a specific permission.
 * @param {string[]} permissions - The resolved permission list
 * @param {string} permission - The permission to check
 * @returns {boolean}
 */
export function hasPermission(permissions, permission) {
	return permissions.includes(permission);
}

/**
 * Resolve capability rules from permissions.
 * Maps permission scopes to resource access rules.
 * @param {Object} skillMetadata - The skill metadata
 * @returns {{ filesystem: string[], network: string[] }}
 */
export function resolveCapabilities(skillMetadata) {
	const perms = resolvePermissions(skillMetadata);
	const capabilities = {
		filesystem: [],
		network: [],
		env: [],
		process: [],
	};

	for (const perm of perms) {
		switch (perm) {
			case "filesystem:read":
				capabilities.filesystem.push("read");
				break;
			case "filesystem:write":
				capabilities.filesystem.push("read");
				capabilities.filesystem.push("write");
				break;
			case "filesystem:exec":
				capabilities.filesystem.push("read");
				capabilities.filesystem.push("exec");
				break;
			case "network:outbound":
				capabilities.network.push("outbound");
				break;
			case "process:spawn":
				capabilities.process.push("spawn");
				break;
			case "env:read":
				capabilities.env.push("read");
				break;
		}
	}

	return capabilities;
}
