/**
 * Module-level store for the active project working directory.
 *
 * The TUI writes to it when the user selects or clears a project; path-based
 * tools (e.g. `file`) read from it at call time to default the `path` argument
 * and resolve relative paths. Kept separate from `config.cwd` because the
 * active project is runtime state that changes as the user switches projects,
 * whereas `config.cwd` is captured once at load.
 */

/** @type {string} The active project cwd, or "" when no project is active. */
let activeProjectCwd = "";

/**
 * Get the active project working directory.
 * @returns {string} The active project cwd, or "" if none is set
 */
export function getProjectCwd() {
	return activeProjectCwd;
}

/**
 * Set the active project working directory.
 * @param {string} cwd - The project directory path, or "" to clear it
 */
export function setProjectCwd(cwd) {
	activeProjectCwd = cwd || "";
}
