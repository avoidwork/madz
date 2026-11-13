import { spawn } from "node:child_process";
import { logger } from "../shared/logger.js";

/** URL protocols that may be opened. Everything else is rejected. */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/**
 * Validate a link href from (untrusted) model output.
 * @param {string} href - Raw href
 * @returns {URL|null} Parsed URL when the protocol is http, https or mailto; otherwise null
 */
export function parseSafeUrl(href) {
	if (typeof href !== "string" || href.length === 0) return null;
	let url;
	try {
		url = new URL(href.trim());
	} catch {
		return null;
	}
	if (!ALLOWED_PROTOCOLS.has(url.protocol)) return null;
	// Reject embedded credentials (https://trusted.com@evil.com style spoofing).
	if (url.username || url.password) return null;
	return url;
}

/**
 * Build the platform opener command. Always an args array, never a shell string.
 * @param {string} target - Normalized URL
 * @param {string} [platform=process.platform] - Node platform id
 * @returns {{cmd: string, args: string[]}} Command and arguments
 */
export function buildOpenCommand(target, platform = process.platform) {
	if (platform === "darwin") return { cmd: "open", args: [target] };
	// `start` is a cmd.exe builtin and would need a shell (and URLs contain `&`).
	// rundll32 reaches the same default handler without one.
	if (platform === "win32") {
		return { cmd: "rundll32", args: ["url.dll,FileProtocolHandler", target] };
	}
	return { cmd: "xdg-open", args: [target] };
}

/**
 * Open a URL in the system handler after validating its protocol.
 * Failures to launch are logged, never thrown.
 * @param {string} href - Link href
 * @param {Object} [deps] - Injection points for tests
 * @param {Function} [deps.spawnFn=spawn] - child_process.spawn replacement
 * @param {string} [deps.platform=process.platform] - Platform id
 * @returns {boolean} True when a launch was attempted, false when rejected
 */
export function openUrl(href, { spawnFn = spawn, platform = process.platform } = {}) {
	const url = parseSafeUrl(href);
	if (!url) {
		logger.warn("Refusing to open link with disallowed or invalid URL");
		return false;
	}
	const { cmd, args } = buildOpenCommand(url.href, platform);
	try {
		const child = spawnFn(cmd, args, { stdio: "ignore", detached: true });
		child.on?.("error", (err) => {
			logger.error(`Failed to open ${url.protocol} link with ${cmd}: ${err.message}`);
		});
		child.unref?.();
		logger.info(`Opening ${url.protocol} link with ${cmd}`);
		return true;
	} catch (err) {
		logger.error(`Failed to spawn ${cmd}: ${err.message}`);
		return false;
	}
}
