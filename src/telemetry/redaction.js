import { redactPIIFromObject } from "../shared/logger.js";

/**
 * Redact PII from span attributes. Always applies the shared PII redactor,
 * then an optional caller-supplied redactor.
 * @param {Object} attributes - Span attributes
 * @param {Function} [redact] - Extra redaction function (attrs) => attrs
 * @returns {Object} Redacted attributes
 */
export function redactAttributes(attributes, redact) {
	const base = redactPIIFromObject(attributes);
	return typeof redact === "function" ? redact(base) : base;
}
