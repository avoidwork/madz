import { createWriteStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";
import pino from "pino";

// ---------------------------------------------------------------------------
// Section 1: OS-aware log directory detection (reuse pattern from src/logger.js)
// ---------------------------------------------------------------------------

/**
 * Get the OS-specific log directory for the madz application.
 * Alpine/Docker: ~/.cache/madz/logs/
 * Linux: ~/.local/share/madz/logs/
 * macOS: ~/Library/Logs/madz/
 * Windows: %LOCALAPPDATA%\madz\logs\
 * @returns {string} The absolute path to the log directory.
 */
function getLogDirectory() {
	const home = os.homedir();
	const platformName = os.platform();

	// Alpine Linux detection via /etc/alpine-release
	if (platformName === "linux") {
		const alpineRelease = "/etc/alpine-release";
		if (existsSync(alpineRelease)) {
			const content = readFileSync(alpineRelease, "utf8").trim();
			if (content) {
				return join(home, ".cache", "madz", "logs");
			}
		}
	}

	switch (platformName) {
		case "darwin":
			return join(home, "Library", "Logs", "madz");
		case "win32": {
			const localAppData = process.env.LOCALAPPDATA || join(home, "AppData", "Local");
			return join(localAppData, "madz", "logs");
		}
		default:
			return join(home, ".local", "share", "madz", "logs");
	}
}

/**
 * Try to create the log directory recursively.
 * @param {string} dir - Directory path to create
 * @returns {boolean} True if directory was created or already exists
 */
function tryCreateDirectory(dir) {
	try {
		mkdirSync(dir, { recursive: true });
		return true;
	} catch {
		return false;
	}
}

// ---------------------------------------------------------------------------
// Section 2: Config-driven logger factory
// ---------------------------------------------------------------------------

/**
 * Create a config-driven pino logger instance.
 * Reads the `logging` section from config and creates a pino logger at the configured level.
 * Falls back to "info" level on invalid values.
 * @param {object} [config] - Resolved config object from loadConfig()
 * @param {string} [config.logging.level] - Log level: debug|info|warn|error (default: "info")
 * @param {string} [config.logging.format] - Log format: json|text (default: "json")
 * @returns {import("pino").Logger} A pino logger instance
 */
export function createLogger(config = {}) {
	const logLevel = config?.logging?.level || "info";
	const validLevels = ["debug", "info", "warn", "error"];

	if (!validLevels.includes(logLevel)) {
		process.stderr.write(`[madz] Warning: Invalid log level "${logLevel}", falling back to "info"\n`);
	}

	const effectiveLevel = validLevels.includes(logLevel) ? logLevel : "info";

	// Silent mode for tests
	if (process.env.NODE_ENV === "test") {
		return pino({ level: "silent" });
	}

	// OS-aware log directory
	const primaryDir = getLogDirectory();
	let logDir = primaryDir;

	if (!tryCreateDirectory(primaryDir)) {
		const fallbackDir = join(os.tmpdir(), "madz", "logs");
		if (tryCreateDirectory(fallbackDir)) {
			logDir = fallbackDir;
		} else {
			// Can't create log directory — use silent mode
			return pino({ level: "silent" });
		}
	}

	const infoPath = join(logDir, "madz.log");
	const errorPath = join(logDir, "madz_error.log");

	let infoStream = null;
	let errorStream = null;
	let devNull = null;

	// Attempt to open info file stream
	try {
		infoStream = createWriteStream(infoPath, { flags: "a" });
	} catch {
		try {
			devNull = createWriteStream("/dev/null");
		} catch {
			// ignore
		}
	}

	// Attempt to open error file stream
	try {
		errorStream = createWriteStream(errorPath, { flags: "a" });
	} catch {
		if (!errorStream && devNull) {
			try {
				errorStream = createWriteStream("/dev/null");
			} catch {
				// ignore
			}
		}
	}

	// Build multistream array
	const streams = [];

	if (infoStream) {
		streams.push({ stream: infoStream, level: "info" });
	}

	if (errorStream) {
		streams.push({ stream: errorStream, level: "error" });
	}

	if (streams.length === 0) {
		return pino({ level: "silent" });
	}

	return pino(
		{ level: effectiveLevel, timestamp: pino.stdTimeFunctions.isoTime },
		pino.multistream(streams),
	);
}

// ---------------------------------------------------------------------------
// Section 3: Export logger object with structured logging methods
// ---------------------------------------------------------------------------

/**
 * The structured logger singleton.
 * @type {{ info: (msg: string | object, ...args: unknown[]) => void, warn: (msg: string | object, ...args: unknown[]) => void, error: (msg: string | object, ...args: unknown[]) => void, debug: (msg: string | object, ...args: unknown[]) => void, fatal: (msg: string | object, ...args: unknown[]) => void, silent: () => void }}
 */
export const logger = {
	info: (msg, ...args) => {
		try {
			pinoLogger.info(msg, ...args);
		} catch {
			// Silently discard
		}
	},
	warn: (msg, ...args) => {
		try {
			pinoLogger.warn(msg, ...args);
		} catch {
			// Silently discard
		}
	},
	error: (msg, ...args) => {
		try {
			pinoLogger.error(msg, ...args);
		} catch {
			// Silently discard
		}
	},
	debug: (msg, ...args) => {
		try {
			pinoLogger.debug(msg, ...args);
		} catch {
			// Silently discard
		}
	},
	fatal: (msg, ...args) => {
		try {
			pinoLogger.fatal(msg, ...args);
		} catch {
			// Silently discard
		}
	},
	silent: () => {
		// No-op
	},
};

/**
 * Flushes all buffered log entries to disk.
 * @returns {Promise<void>}
 */
export async function flush() {
	return new Promise((resolve) => {
		try {
			if (typeof pinoLogger.flush === "function") {
				pinoLogger.flush(() => {
					setTimeout(resolve, 50);
				});
			} else {
				resolve();
			}
		} catch {
			resolve();
		}
	});
}

// Create the pino logger instance (module-level, after exports for circular safety)
let pinoLogger;
try {
	pinoLogger = createLogger({});
} catch {
	pinoLogger = pino({ level: "silent" });
}
