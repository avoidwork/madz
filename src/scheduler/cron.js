import { execSync } from "node:child_process";
import { resolve } from "node:path";

// Block delimiters for madz-managed crontab entries
const BLOCK_START = "# --- BEGIN madz-schedules ---";
const BLOCK_END = "# --- END madz-schedules ---";

/**
 * Cron manages madz schedule entries in the user's system crontab.
 * Entries are written as: <cron>  <command-prefix>  <name>  # madz-schedule: <name>
 */
export const Cron = {
	/**
	 * Check if the system crontab binary is available.
	 * @returns {{ available: boolean, error?: string }}
	 */
	isAvailable() {
		try {
			execSync("which crontab", { stdio: ["pipe", "pipe", "pipe"] });
			return { available: true };
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			return { available: false, error: `crontab not available: ${msg}` };
		}
	},

	/**
	 * Get the command prefix for scheduling jobs via system crontab.
	 * @param {string} [appPath] - Override the entry point path
	 * @returns {string}
	 * @private
	 */
	_getCommandPrefix(appPath) {
		const node = resolve(process.execPath);
		const path = appPath || resolve(process.argv[1] || "index.js");
		const safe = path.includes(" ") ? '"' + path + '"' : path;
		return `${node} ${safe} --run-schedule`;
	},

	/**
	 * Read the current user crontab.
	 * @returns {string} Crontab content (may be empty)
	 * @private
	 */
	_readCrontab() {
		try {
			return (
				execSync("crontab -l 2>&1", {
					encoding: "utf-8",
					stdio: ["pipe", "pipe", "pipe"],
				}).trim() || ""
			);
		} catch (err) {
			const msg = err instanceof Error ? err.message || "" : String(err);
			const stdout = err.stdout || "";
			if (/no crontab/i.test(msg) || /no crontab/i.test(stdout)) return "";
			throw new Error(`Failed to read crontab: ${msg}`);
		}
	},

	/**
	 * @param {string} content
	 * @private
	 */
	_writeCrontab(content) {
		// Ensure content ends with newline; empty content gets a newline to avoid crontab errors
		const safeContent = content.endsWith("\n") ? content : content + "\n";
		execSync("crontab -", { input: safeContent, stdio: ["pipe", "pipe", "pipe"] });
	},

	/**
	 * Extract madz-managed block lines and outside lines from crontab content.
	 * @param {string} crontab - Raw crontab content
	 * @returns {{ outsideLines: string[], blockLines: string[] }}
	 * @private
	 */
	_splitBlock(crontab) {
		const outsideLines = [];
		let inBlock = false;
		const blockLines = [];

		for (const line of crontab.split("\n")) {
			if (line === BLOCK_START) {
				inBlock = true;
				continue;
			}
			if (line === BLOCK_END) {
				inBlock = false;
				continue;
			}
			if (!inBlock) {
				outsideLines.push(line);
			} else {
				blockLines.push(line);
			}
		}

		return { outsideLines, blockLines };
	},

	/**
	 * Add a single crontab entry for a schedule job.
	 * Reads the current crontab, removes the existing madz block,
	 * appends the new entry, and writes back.
	 * @param {{ name: string, cron: string }} job - Schedule job to add
	 * @returns {{ added: boolean, error?: string }}
	 */
	add(job) {
		const { available, error } = this.isAvailable();
		if (!available) {
			return { added: false, error: error || "System crontab is not available" };
		}

		const prefix = this._getCommandPrefix();
		const crontab = this._readCrontab();
		const { outsideLines, blockLines } = this._splitBlock(crontab);

		const quotedName = JSON.stringify(job.name);
		const newEntry = `${job.cron}  ${prefix}  ${quotedName}  # madz-schedule: ${job.name}`;

		// Remove existing entry with same name if present
		const filtered = blockLines.filter((line) => {
			const nameCommentIdx = line.indexOf("# madz-schedule: ");
			if (nameCommentIdx !== -1) {
				const name = line.slice(nameCommentIdx + "# madz-schedule: ".length).trim();
				return name !== job.name;
			}
			return true;
		});

		filtered.push(newEntry);

		while (outsideLines.length > 0 && outsideLines[outsideLines.length - 1].trim() === "") {
			outsideLines.pop();
		}
		outsideLines.push(BLOCK_START);
		for (const line of filtered) outsideLines.push(line);
		outsideLines.push(BLOCK_END);

		try {
			this._writeCrontab(outsideLines.join("\n"));
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			return { added: false, error: `Failed to write crontab: ${msg}` };
		}

		return { added: true };
	},

	/**
	 * Remove a single crontab entry by name.
	 * Reads the current crontab, removes the madz block,
	 * writes back everything except the named entry.
	 * @param {string} name - Schedule job name
	 * @returns {{ removed: boolean, error?: string }}
	 */
	remove(name) {
		if (!this.isAvailable().available) {
			return { removed: false, error: "System crontab is not available" };
		}

		const crontab = this._readCrontab();
		const { outsideLines, blockLines } = this._splitBlock(crontab);

		// Remove the entry with matching name
		const filtered = blockLines.filter((line) => {
			const nameCommentIdx = line.indexOf("# madz-schedule: ");
			if (nameCommentIdx !== -1) {
				const entryName = line.slice(nameCommentIdx + "# madz-schedule: ".length).trim();
				return entryName !== name;
			}
			return true;
		});

		// Only write block if there are remaining entries
		while (outsideLines.length > 0 && outsideLines[outsideLines.length - 1].trim() === "") {
			outsideLines.pop();
		}
		if (filtered.length > 0) {
			outsideLines.push(BLOCK_START);
			for (const line of filtered) outsideLines.push(line);
			outsideLines.push(BLOCK_END);
		}

		try {
			this._writeCrontab(outsideLines.join("\n"));
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			return { removed: false, error: `Failed to write crontab: ${msg}` };
		}

		return { removed: true };
	},

	/**
	 * Install or replace the madz-schedules block in the user crontab.
	 * Paused schedules are excluded. Existing madz block is replaced entirely.
	 * @param {Array<{ name: string, cron: string, paused?: boolean }>} schedules
	 * @param {string} [appPath] - Optional override for the app entry path
	 * @returns {{ installed: number, error?: string }}
	 */
	install(schedules, appPath) {
		const { available, error } = this.isAvailable();
		if (!available) {
			return { installed: 0, error: error || "System crontab is not available" };
		}

		const prefix = this._getCommandPrefix(appPath);
		const crontab = this._readCrontab();

		const outsideLines = [];
		let inBlock = false;
		for (const line of crontab.split("\n")) {
			if (line === BLOCK_START) {
				inBlock = true;
				continue;
			}
			if (line === BLOCK_END) {
				inBlock = false;
				continue;
			}
			if (!inBlock) outsideLines.push(line);
		}

		const blockLines = schedules
			.filter((s) => !s.paused)
			.map((s) => {
				const quotedName = JSON.stringify(s.name);
				return `${s.cron}  ${prefix}  ${quotedName}  # madz-schedule: ${s.name}`;
			});

		while (outsideLines.length > 0 && outsideLines[outsideLines.length - 1].trim() === "") {
			outsideLines.pop();
		}
		if (blockLines.length > 0) {
			outsideLines.push(BLOCK_START);
			for (const bl of blockLines) outsideLines.push(bl);
			outsideLines.push(BLOCK_END);
		}

		try {
			this._writeCrontab(outsideLines.join("\n"));
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			return { installed: 0, error: `Failed to write crontab: ${msg}` };
		}

		return { installed: blockLines.length };
	},

	/**
	 * Remove all madz-schedules entries from the user crontab.
	 * @param {string} [_appPath] - Unused, kept for API compat
	 * @returns {number} Number of entries removed
	 */
	uninstall(_appPath) {
		if (!this.isAvailable().available) return 0;

		const crontab = this._readCrontab();
		let inBlock = false;

		const outsideLines = [];
		for (const line of crontab.split("\n")) {
			if (line === BLOCK_START) {
				inBlock = true;
				continue;
			}
			if (line === BLOCK_END) {
				inBlock = false;
				continue;
			}
			if (!inBlock) outsideLines.push(line);
		}

		this._writeCrontab(outsideLines.join("\n"));

		// Count entries removed from the block
		let realRemoved = 0;
		let counting = false;
		for (const line of crontab.split("\n")) {
			if (line === BLOCK_START) {
				counting = true;
				continue;
			}
			if (line === BLOCK_END) {
				counting = false;
				continue;
			}
			if (counting && line.trim()) realRemoved++;
		}

		return realRemoved;
	},

	/**
	 * List the schedule entries from the current crontab block.
	 * @param {string} [appPath] - Optional override for the app entry path
	 * @returns {Array<{ name: string, cron: string }>}
	 */
	list(appPath) {
		const crontab = this._readCrontab();
		const prefix = this._getCommandPrefix(appPath);
		let inBlock = false;
		const entries = [];

		for (const line of crontab.split("\n")) {
			if (line === BLOCK_START) {
				inBlock = true;
				continue;
			}
			if (line === BLOCK_END) {
				inBlock = false;
				continue;
			}
			if (!inBlock || !line.trim()) continue;

			let name = null;
			const nameCommentIdx = line.indexOf("# madz-schedule: ");
			if (nameCommentIdx !== -1) {
				name = line.slice(nameCommentIdx + "# madz-schedule: ".length).trim();
			}

			const cmdIdx = line.indexOf(prefix);
			if (cmdIdx !== -1) {
				const after = line.slice(cmdIdx + prefix.length).trim();
				if (after.startsWith('"') && after.endsWith('"')) {
					name = after.slice(1, -1);
				} else if (!name) {
					name = after.split("\t")[0].split(/\s+/)[0];
				}
			}

			const cronEnd = line.indexOf("  ");
			const cron = cronEnd !== -1 ? line.slice(0, cronEnd).trim() : line.trim();

			if (cron) {
				entries.push({ name: name || "unknown", cron });
			}
		}

		return entries;
	},
};
