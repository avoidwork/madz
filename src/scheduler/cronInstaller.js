import { execSync } from "node:child_process";
import { resolve } from "node:path";

// Block delimiters for madz-managed crontab entries
const BLOCK_START = "# --- BEGIN madz-schedules ---";
const BLOCK_END = "# --- END madz-schedules ---";

/**
 * CronInstaller manages madz schedule entries in the user's crontab.
 * Each entry is written as: <cron>  <command-prefix>  <name>  # madz-schedule: <name>
 */
export const CronInstaller = {
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
		execSync("crontab -", { input: content, stdio: ["pipe", "pipe", "pipe"] });
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
