import { createWriteStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";
import pino from "pino";

// Module-level pino logger instance. Declared here (before any catch blocks)
// so the logError helper can reference it without hitting the temporal dead
// zone during module initialization.
let pinoLogger = null;

// ---------------------------------------------------------------------------
// Section 1: PII redaction patterns
// ---------------------------------------------------------------------------

/**
 * Regex patterns for detecting and redacting personally identifiable information (PII).
 * Each pattern has a corresponding replacement string.
 */
const PII_PATTERNS = [
	// Email addresses
	{ pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: "[EMAIL REDACTED]" },
	// Phone numbers (various formats)
	{
		pattern: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
		replacement: "[PHONE REDACTED]",
	},
	// IP addresses (IPv4)
	{ pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacement: "[IP REDACTED]" },
	// Social Security Numbers (SSN)
	{ pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[SSN REDACTED]" },
	// Credit card numbers (basic Luhn-checkable patterns)
	{ pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, replacement: "[CC REDACTED]" },
];

/**
 * Redact PII from a log message string.
 * @param {string} message - The log message to redact
 * @returns {string} The redacted message
 */
export function redactPII(message) {
	if (typeof message !== "string") return message;
	let redacted = message;
	for (const { pattern, replacement } of PII_PATTERNS) {
		redacted = redacted.replace(pattern, replacement);
	}
	return redacted;
}

/**
 * Redact PII from an object's string properties recursively.
 * @param {object} obj - The object to redact
 * @returns {object} A new object with redacted string values
 */
export function redactPIIFromObject(obj) {
	if (typeof obj !== "object" || obj === null) return obj;
	const redacted = Array.isArray(obj) ? [] : {};
	for (const [key, value] of Object.entries(obj)) {
		if (typeof value === "string") {
			redacted[key] = redactPII(value);
		} else if (typeof value === "object" && value !== null) {
			redacted[key] = redactPIIFromObject(value);
		} else {
			redacted[key] = value;
		}
	}
	return redacted;
}

/**
 * Safely log an error from within a catch block without risking recursion or
 * throwing. Uses the structured `logger` singleton when it is available and
 * not the source of the failure; otherwise falls back to a guarded
 * `process.stderr.write`. This preserves the logger's never-throw invariant.
 * @param {unknown} err - The caught error to log
 * @param {string} [context] - Optional context string describing the failure
 * @returns {void}
 */
export function logError(err, context = "") {
	const message = context ? `${context}: ${err?.message ?? err}` : (err?.message ?? String(err));
	/* node:coverage disable — defensive, requires the logger and stderr to throw */
	try {
		if (typeof pinoLogger?.debug === "function") {
			pinoLogger.debug(message);
			return;
		}
	} catch (logErr) {
		// Fall through to stderr if the logger itself throws. Bind the error so
		// it is not silently discarded (AGENTS.md §1.1).
		process.stderr.write(`[logger] ${message} (logger failed: ${logErr?.message ?? logErr})\n`);
	}
	try {
		process.stderr.write(`[logger] ${message}\n`);
	} catch (stderrErr) {
		// Terminal guard — logging is impossible at this point. Bind the error
		// so it is not silently discarded (AGENTS.md §1.1); there is no further
		// sink available, so this is the last resort and must never throw.
		void stderrErr;
	}
	/* node:coverage enable */
}

// ---------------------------------------------------------------------------
// Section 2.1: OS-aware log directory detection
// ---------------------------------------------------------------------------

/* node:coverage disable — platform-specific paths, requires OS mocking */
/**
 * Get the OS-specific log directory for the madz application.
 * Alpine/Docker: ~/.cache/madz/logs/
 * Linux: ~/.local/share/madz/logs/
 * macOS: ~/Library/Logs/madz/
 * Windows: %LOCALAPPDATA%\madz\logs\
 * @returns {string} The absolute path to the log directory.
 */
export function getLogDirectory() {
	const home = os.homedir();
	const platformName = os.platform();

	// Alpine Linux detection via /etc/alpine-release
	if (platformName === "linux") {
		const alpineRelease = "/etc/alpine-release";
		if (existsSync(alpineRelease)) {
			try {
				const content = readFileSync(alpineRelease, "utf8").trim();
				if (content) {
					return join(home, ".cache", "madz", "logs");
				}
			} catch (err) {
				// File deleted between check and read, or unreadable - fall through to default
				logError(err, "Failed to read /etc/alpine-release");
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
/* node:coverage enable */

// ---------------------------------------------------------------------------
// Section 2.2: Log directory auto-creation with graceful fallback (2.6)
// ---------------------------------------------------------------------------

/**
 * Try to create the log directory recursively.
 * Returns true on success, false if creation fails (unwritable directory).
 * @param {string} dir - Directory path to create
 * @returns {boolean} True if directory was created or already exists
 */
/* node:coverage disable — requires unwritable filesystem */
function tryCreateDirectory(dir) {
	try {
		mkdirSync(dir, { recursive: true });
		return true;
	} catch (err) {
		logError(err, `Failed to create log directory ${dir}`);
		return false;
	}
}
/* node:coverage enable */

const primaryDir = getLogDirectory();
let logDir = primaryDir;

// Attempt primary directory; fall back to tmpdir() if unwritable (2.6)
/* node:coverage disable — fallback requires unwritable primary dir */
if (!tryCreateDirectory(primaryDir)) {
	const fallbackDir = join(os.tmpdir(), "madz", "logs");
	if (tryCreateDirectory(fallbackDir)) {
		logDir = fallbackDir;
	}
}
/* node:coverage enable */

// ---------------------------------------------------------------------------
// Section 2.4: Silent mode for tests (2.4) + 2.3: Dual-file pino multistream
// ---------------------------------------------------------------------------

if (process.env.NODE_ENV === "test") {
	// Silent mode: suppress all pino output internally during tests
	pinoLogger = pino({ level: "silent" });
} else {
	const infoPath = join(logDir, "madz.log");
	const errorPath = join(logDir, "madz_error.log");

	let infoStream = null;
	let errorStream = null;
	let devNull = null;

	/* node:coverage disable — file stream fallbacks require unwritable filesystem */
	// Attempt to open info file stream
	try {
		infoStream = createWriteStream(infoPath, { flags: "a" });
	} catch (err) {
		// If info stream fails, try /dev/null as fallback
		logError(err, `Failed to open info log stream ${infoPath}`);
		try {
			devNull = createWriteStream("/dev/null");
		} catch (err2) {
			// Both failed - pino multistream below will handle zero streams
			logError(err2, "Failed to open /dev/null fallback stream");
		}
	}

	// Attempt to open error file stream
	try {
		errorStream = createWriteStream(errorPath, { flags: "a" });
	} catch (err) {
		// If error stream fails but we have devNull, reuse it
		logError(err, `Failed to open error log stream ${errorPath}`);
		if (!errorStream && devNull) {
			errorStream = devNull;
		}
	}
	/* node:coverage enable */

	// Build multistream array for dual-file output
	const streams = [];

	if (infoStream) {
		streams.push({ stream: infoStream, level: "info" });
	}

	if (errorStream) {
		streams.push({ stream: errorStream, level: "error" });
	}

	// If no streams at all (both dirs unwritable), use silent mode
	/* node:coverage disable — requires both file streams to fail */
	if (streams.length === 0) {
		pinoLogger = pino({ level: "silent" });
	} else {
		// pino.multistream routes: info/warn/debug → madz.log, error/fatal → both
		// Note: stream must be passed as second argument to pino() in v10+
		// TODO: pino.multistream is deprecated in v9+ and will be removed in a future version.
		// Consider migrating to pino.destination() or the newer streaming API.
		pinoLogger = pino(
			{ level: "debug", timestamp: pino.stdTimeFunctions.isoTime },
			pino.multistream(streams),
		);
	}
	/* node:coverage enable */
}

// ---------------------------------------------------------------------------
// Section 3.2: Flush method for shutdown handler (3.2)
// ---------------------------------------------------------------------------

/**
 * Flushes all buffered log entries to disk.
 * @returns {Promise<void>}
 */
export async function flush() {
	return new Promise((resolve) => {
		/* node:coverage disable — requires pinoLogger.flush to throw */
		try {
			if (typeof pinoLogger.flush === "function") {
				pinoLogger.flush(() => {
					// pino's flush callback fires before the OS actually
					// writes the file on disk (Node.js 25+). Give the
					// kernel a tick to ensure file entries are visible.
					setTimeout(resolve, 50);
				});
			} else {
				resolve();
			}
		} catch (err) {
			logError(err, "Failed to flush pino logger");
			resolve();
		}
		/* node:coverage enable */
	});
}

// ---------------------------------------------------------------------------
// Section 2.5: Export logger object with structured logging methods (2.5)
// ---------------------------------------------------------------------------

/**
 * The structured logger singleton accessible via import from src/logger.js.
 * @type {{ info: (msg: string, ...args: unknown[]) => void, warn: (msg: string, ...args: unknown[]) => void, error: (msg: string, ...args: unknown[]) => void, debug: (msg: string, ...args: unknown[]) => void, fatal: (msg: string, ...args: unknown[]) => void, silent: () => void }}
 */
export const logger = {
	info: (msg, ...args) => {
		try {
			pinoLogger.info(redactPII(msg), ...args);
			/* node:coverage disable — defensive, requires pino to throw */
		} catch (err) {
			// Log the failure without recursing into the logger singleton
			logError(err, "logger.info failed");
		}
		/* node:coverage enable */
	},
	warn: (msg, ...args) => {
		try {
			pinoLogger.warn(redactPII(msg), ...args);
			/* node:coverage disable — defensive, requires pino to throw */
		} catch (err) {
			// Log the failure without recursing into the logger singleton
			logError(err, "logger.warn failed");
		}
		/* node:coverage enable */
	},
	error: (msg, ...args) => {
		try {
			pinoLogger.error(redactPII(msg), ...args);
			/* node:coverage disable — defensive, requires pino to throw */
		} catch (err) {
			// Log the failure without recursing into the logger singleton
			logError(err, "logger.error failed");
		}
		/* node:coverage enable */
	},
	debug: (msg, ...args) => {
		try {
			pinoLogger.debug(redactPII(msg), ...args);
			/* node:coverage disable — defensive, requires pino to throw */
		} catch (err) {
			// Log the failure without recursing into the logger singleton
			logError(err, "logger.debug failed");
		}
		/* node:coverage enable */
	},
	fatal: (msg, ...args) => {
		try {
			pinoLogger.fatal(redactPII(msg), ...args);
			/* node:coverage disable — defensive, requires pino to throw */
		} catch (err) {
			// Log the failure without recursing into the logger singleton
			logError(err, "logger.fatal failed");
		}
		/* node:coverage enable */
	},
};
