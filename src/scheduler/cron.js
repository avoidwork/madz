import { execSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

// Block delimiters for madz-managed crontab entries
const BLOCK_START = "# --- BEGIN madz-schedules ---";
const BLOCK_END = "# --- END madz-schedules ---";

/**
 * Cron manages madz schedule entries in the user's system crontab.
 * Entries are written as: <cron>  <command>  # madz-schedule: <name>
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
	 * @param {{ name: string, cron: string, command: string }} job - Schedule job to add
	 * @returns {{ added: boolean, error?: string }}
	 */
	add(job) {
		const { available, error } = this.isAvailable();
		if (!available) {
			return { added: false, error: error || "System crontab is not available" };
		}

		if (!job.command) {
			return { added: false, error: "Job requires a 'command' field" };
		}

		const crontab = this._readCrontab();
		const { outsideLines, blockLines } = this._splitBlock(crontab);

		const newEntry = `${job.cron}  ${job.command}  # madz-schedule: ${job.name}`;

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
	 * @param {Array<{ name: string, cron: string, command: string, paused?: boolean }>} schedules
	 * @returns {{ installed: number, error?: string }}
	 */
	install(schedules) {
		const { available, error } = this.isAvailable();
		if (!available) {
			return { installed: 0, error: error || "System crontab is not available" };
		}

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
				return `${s.cron}  ${s.command}  # madz-schedule: ${s.name}`;
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
	 * @returns {number} Number of entries removed
	 */
	uninstall() {
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
	 * @returns {Array<{ name: string, cron: string, command: string }>}
	 */
	list() {
		const crontab = this._readCrontab();
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

			const cronEnd = line.indexOf("  ");
			const cron = cronEnd !== -1 ? line.slice(0, cronEnd).trim() : line.trim();

			const commandStart = cronEnd !== -1 ? cronEnd + 2 : 0;
			const commandEnd = line.indexOf("  # madz-schedule:");
			const command =
				commandEnd !== -1
					? line.slice(commandStart, commandEnd).trim()
					: line.slice(commandStart).trim();

			if (cron) {
				entries.push({ name: name || "unknown", cron, command });
			}
		}

		return entries;
	},

	/**
	 * Parse a crontab entry line into its components.
	 * @param {string} line - Crontab entry line
	 * @returns {{ name: string, cron: string, command: string } | null}
	 * @private
	 */
	_parseEntry(line) {
		let name = null;
		const nameCommentIdx = line.indexOf("# madz-schedule: ");
		if (nameCommentIdx !== -1) {
			name = line.slice(nameCommentIdx + "# madz-schedule: ".length).trim();
		}

		const cronEnd = line.indexOf("  ");
		const cron = cronEnd !== -1 ? line.slice(0, cronEnd).trim() : line.trim();

		const commandStart = cronEnd !== -1 ? cronEnd + 2 : 0;
		const commandEnd = line.indexOf("  # madz-schedule:");
		const command =
			commandEnd !== -1
				? line.slice(commandStart, commandEnd).trim()
				: line.slice(commandStart).trim();

		if (cron) {
			return { name: name || "unknown", cron, command };
		}
		return null;
	},

	/**
	 * Read all job definitions from the schedules directory.
	 * @param {string} schedulesDir - Path to the schedules directory
	 * @returns {Promise<Array<{ name: string, cron: string, command: string, enabled: boolean }>>}
	 * @private
	 */
	async _readJobsFromDisk(schedulesDir) {
		const jobs = [];
		try {
			const files = await readdir(schedulesDir);
			for (const file of files) {
				if (!file.endsWith(".json")) continue;
				try {
					const content = await readFile(join(schedulesDir, file), "utf-8");
					const job = JSON.parse(content);
					if (job.name && job.cron && job.command) {
						jobs.push({
							name: job.name,
							cron: job.cron,
							command: job.command,
							enabled: job.enabled !== false,
						});
					}
				} catch {
					// Skip unreadable or malformed JSON files
				}
			}
		} catch {
			// Directory doesn't exist or can't be read — return empty
		}
		return jobs;
	},

	/**
	 * Synchronize persisted job definitions with the system crontab.
	 * Reads all JSON files from the schedules directory, compares against
	 * the current crontab block, and writes a reconciled block.
	 *
	 * Jobs with `enabled: false` are excluded. Jobs without a `command`
	 * field are skipped. The entire madz-schedules block is replaced
	 * atomically to prevent duplicates.
	 *
	 * @param {string} schedulesDir - Path to the schedules directory
	 * @returns {Promise<{ added: number, removed: number, updated: number, skipped: number, error?: string }>}
	 */
	async sync(schedulesDir) {
		const { available, error } = this.isAvailable();
		if (!available) {
			return {
				added: 0,
				removed: 0,
				updated: 0,
				skipped: 0,
				error: error || "System crontab is not available",
			};
		}

		// Read desired state from disk
		const jobs = await this._readJobsFromDisk(schedulesDir);
		const desiredEntries = jobs
			.filter((j) => j.enabled)
			.map((j) => `${j.cron}  ${j.command}  # madz-schedule: ${j.name}`);

		// Parse current crontab block entries
		const crontab = this._readCrontab();
		const { outsideLines, blockLines } = this._splitBlock(crontab);

		const currentEntries = [];
		for (const line of blockLines) {
			if (!line.trim()) continue;
			const parsed = this._parseEntry(line);
			if (parsed) currentEntries.push(parsed);
		}

		// Build maps for comparison (name -> entry)
		const currentMap = new Map();
		for (const entry of currentEntries) {
			currentMap.set(entry.name, entry);
		}

		const desiredMap = new Map();
		for (const job of jobs) {
			if (job.enabled) {
				desiredMap.set(job.name, { name: job.name, cron: job.cron, command: job.command });
			}
		}

		// Compute diff
		let added = 0;
		let removed = 0;
		let updated = 0;
		let skipped = 0;

		// Find new and updated entries
		for (const [name, desired] of desiredMap) {
			const current = currentMap.get(name);
			if (!current) {
				added++;
			} else if (current.cron !== desired.cron || current.command !== desired.command) {
				updated++;
			} else {
				skipped++;
			}
		}

		// Find removed entries
		for (const name of currentMap.keys()) {
			if (!desiredMap.has(name)) {
				removed++;
			}
		}

		// Build the new block (same format as install())
		const newBlockLines = desiredEntries;

		while (outsideLines.length > 0 && outsideLines[outsideLines.length - 1].trim() === "") {
			outsideLines.pop();
		}
		if (newBlockLines.length > 0) {
			outsideLines.push(BLOCK_START);
			for (const line of newBlockLines) outsideLines.push(line);
			outsideLines.push(BLOCK_END);
		}

		try {
			this._writeCrontab(outsideLines.join("\n"));
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			return { added, removed, updated, skipped, error: `Failed to write crontab: ${msg}` };
		}

		return { added, removed, updated, skipped };
	},
};
