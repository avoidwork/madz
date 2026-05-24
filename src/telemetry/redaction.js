const REDACTED = "[REDACTED]";

/**
 * Create a redaction function that masks attributes matching configured paths.
 * @param {string[]} redactPaths - Dotted paths to redact (e.g., "credentials.apiKey")
 * @returns {Function} A function that redacts an attributes object
 */
export function createRedactionMiddleware(redactPaths = []) {
  /**
   * Apply redaction to a flat attributes object.
   * @param {Record<string, unknown>} attributes - Span attributes
   * @returns {Record<string, unknown>} Redacted attributes
   */
  return function redact(attributes) {
    if (!attributes || typeof attributes !== "object") return attributes;

    const result = { ...attributes };

    for (const path of redactPaths) {
      const keys = path.split(".");
      redactNested(result, keys, 0);
    }

    return result;
  };
}

/**
 * Recursively redact a value at a dotted path.
 * @param {Object} obj - The object to modify
 * @param {string[]} keys - Remaining keys in the path
 * @param {number} index - Current key index
 */
function redactNested(obj, keys, index) {
  if (!obj || index >= keys.length) return;

  const key = keys[index];
  if (index === keys.length - 1) {
    obj[key] = REDACTED;
  } else {
    if (obj[key] && typeof obj[key] === "object") {
      redactNested(obj[key], keys, index + 1);
    }
  }
}

/**
 * Check if an attribute name matches any redaction path.
 * @param {string} attrName - The attribute name
 * @param {string[]} redactPaths - Paths to check
 * @returns {boolean}
 */
function matchesRedactionPath(attrName, redactPaths) {
  return redactPaths.some((path) => {
    const lastKey = path.split(".").pop();
    return attrName.endsWith(lastKey);
  });
}

/**
 * Simple attribute redactor for shallow objects.
 * @param {Record<string, unknown>} attrs - Attributes to redact
 * @param {string[]} redactKeys - Keys that should be redacted
 * @returns {Record<string, unknown>}
 */
export function redactAttributes(attrs, redactKeys = []) {
  if (!attrs) return {};

  const result = { ...attrs };
  for (const key of Object.keys(result)) {
    if (redactKeys.some((rk) => key.includes(rk.toLowerCase()))) {
      result[key] = REDACTED;
    }
  }
  return result;
}
