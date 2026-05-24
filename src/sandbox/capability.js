/**
 * Map skill permissions to resource access rules for sandbox enforcement.
 * @param {string[]} permissions - List of granted permission scopes
 * @returns {{ resources: string[], rules: Object[] }}
 */
export function enforceCapabilities(permissions = []) {
	const rules = [];
	const resources = new Set();

	for (const perm of permissions) {
		switch (perm) {
			case "filesystem:read": {
				resources.add("filesystem:read");
				rules.push({ resource: "filesystem", action: "read" });
				break;
			}
			case "filesystem:write": {
				resources.add("filesystem:read");
				resources.add("filesystem:write");
				rules.push({ resource: "filesystem", action: "read" });
				rules.push({ resource: "filesystem", action: "write" });
				break;
			}
			case "filesystem:exec": {
				resources.add("filesystem:read");
				resources.add("filesystem:exec");
				rules.push({ resource: "filesystem", action: "read" });
				rules.push({ resource: "filesystem", action: "execute" });
				break;
			}
			case "network:outbound": {
				resources.add("network:outbound");
				rules.push({ resource: "network", action: "outbound" });
				break;
			}
			case "process:spawn": {
				resources.add("process:spawn");
				rules.push({ resource: "process", action: "spawn" });
				break;
			}
			case "env:read": {
				resources.add("env:read");
				rules.push({ resource: "env", action: "read" });
				break;
			}
		}
	}

	return {
		resources: Array.from(resources),
		rules,
	};
}
