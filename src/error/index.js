/**
 * Base application error class that extends Error.
 * Carries a machine-readable code and HTTP status code.
 */
export class AppError extends Error {
	/**
	 * Create an AppError.
	 * @param {string} message - The human-readable error message.
	 * @param {string} code - A machine-readable error code.
	 * @param {number} status - The associated HTTP status code.
	 */
	constructor(message, code, status) {
		super(message);
		this.name = "AppError";
		this.code = code;
		this.status = status;
	}
}

/**
 * Error class for LLM authentication failures (e.g., invalid/expired API key).
 * Auth errors are permanent and should NOT trigger provider fallback.
 */
export class AuthError extends AppError {
	/**
	 * Create an AuthError.
	 * @param {string} message - The human-readable error message.
	 * @param {string} code - The machine-readable error code (default: "invalid_api_key").
	 */
	constructor(message, code = "invalid_api_key") {
		super(message, code, 401);
		this.name = "AuthError";
	}
}

/**
 * Error class for LLM rate limit errors (HTTP 429).
 * Rate limit errors are transient — provider fallback may succeed.
 */
export class RateLimitError extends AppError {
	/**
	 * Create a RateLimitError.
	 * @param {string} message - The human-readable error message.
	 */
	constructor(message) {
		super(message, "rate_limited", 429);
		this.name = "RateLimitError";
	}
}

/**
 * Error class for LLM timeout errors (HTTP 408, network timeouts).
 * Timeout errors are transient — provider fallback may succeed.
 */
export class TimeoutError extends AppError {
	/**
	 * Create a TimeoutError.
	 * @param {string} message - The human-readable error message.
	 */
	constructor(message) {
		super(message, "timeout", 408);
		this.name = "TimeoutError";
	}
}

/**
 * Error class for network-related errors (connection refused, reset, etc.).
 * Network errors are transient — provider fallback may succeed.
 */
export class NetworkError extends AppError {
	/**
	 * Create a NetworkError.
	 * @param {string} message - The human-readable error message.
	 */
	constructor(message) {
		super(message, "network_error", 503);
		this.name = "NetworkError";
	}
}

/**
 * Classify an error into a structured AppError subclass based on its
 * properties. Checks in priority order: agent interrupt, auth, rate limit,
 * timeout, network, then wraps unknown errors as AppError.
 * @param {Error} err - The error to classify.
 * @returns {AppError} A classified error instance.
 */
export function classifyError(err) {
	// Agent interrupt errors pass through without classification
	if (isAgentInterrupt(err)) {
		return err;
	}

	// Auth: check first (highest priority)
	if (isAuthError(err)) {
		return new AuthError(err.message || "Authentication failed: Invalid API key");
	}

	// Rate limit: check before network errors
	if (isRateLimitError(err)) {
		return new RateLimitError(err.message || "Request was rate-limited");
	}

	// Timeout: check before generic network errors
	if (isTimeoutError(err)) {
		return new TimeoutError(err.message || "Request timed out");
	}

	// Wrap unknown errors
	return new AppError(err.message || "An unexpected error occurred");
}

/**
 * Check if an error is from a LangGraph agent user interrupt.
 * @param {Error} err - The error to check.
 * @returns {boolean} True if the error is a user interrupt.
 */
export function isAgentInterrupt(err) {
	const e = err;
	if (e && e.interruptedReason && /user interrupted/i.test(e.interruptedReason)) {
		return true;
	}
	return false;
}

/**
 * Check if an error indicates an authentication failure.
 * @param {Error} err - The error to check.
 * @returns {boolean} True if the error indicates auth failure.
 */
export function isAuthError(err) {
	if (err.code === "invalid_api_key") return true;
	if (err.lc_error_code === "MODEL_AUTHENTICATION") return true;
	return false;
}

/**
 * Check if an error indicates a rate limit (HTTP 429).
 * @param {Error} err - The error to check.
 * @returns {boolean} True if the error indicates a rate limit.
 */
export function isRateLimitError(err) {
	if (err.status === 429) return true;
	if (err.statusCode === 429) return true;
	return false;
}

/**
 * Check if an error indicates a timeout.
 * @param {Error} err - The error to check.
 * @returns {boolean} True if the error indicates a timeout.
 */
export function isTimeoutError(err) {
	if (err.status === 408) return true;
	if (err.code === "ECONNREFUSED" || err.code === "ECONNRESET" || err.code === "ETIMEDOUT") {
		return true;
	}
	if (err.isNetworkError) return true;
	const msg = err.message || "";
	if (/timed?\s*out/i.test(msg)) return true;
	if (/deadline\s*exceeded/i.test(msg)) return true;
	return false;
}
