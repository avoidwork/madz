/**
 * Category enums and validation for prompt classification.
 * Defines valid values for intent, domain, and complexity categories.
 */

/**
 * Valid intent categories for prompt classification.
 * @type {readonly string[]}
 */
export const INTENT_CATEGORIES = Object.freeze([
	"question",
	"task",
	"creative",
	"analysis",
	"other",
]);

/**
 * Valid domain categories for prompt classification.
 * @type {readonly string[]}
 */
export const DOMAIN_CATEGORIES = Object.freeze([
	"coding",
	"writing",
	"analysis",
	"general",
	"other",
]);

/**
 * Valid complexity categories for prompt classification.
 * @type {readonly string[]}
 */
export const COMPLEXITY_CATEGORIES = Object.freeze(["simple", "moderate", "complex"]);

/**
 * Default classification metadata used when LLM classification fails.
 * @type {{ intent: string; domain: string; complexity: string }}
 */
export const DEFAULT_METADATA = Object.freeze({
	intent: "other",
	domain: "general",
	complexity: "moderate",
});

/**
 * Validate that a value is a valid intent category.
 * @param {string} value - The value to validate
 * @returns {boolean} True if the value is a valid intent category
 */
export function isValidIntent(value) {
	return INTENT_CATEGORIES.includes(value);
}

/**
 * Validate that a value is a valid domain category.
 * @param {string} value - The value to validate
 * @returns {boolean} True if the value is a valid domain category
 */
export function isValidDomain(value) {
	return DOMAIN_CATEGORIES.includes(value);
}

/**
 * Validate that a value is a valid complexity category.
 * @param {string} value - The value to validate
 * @returns {boolean} True if the value is a valid complexity category
 */
export function isValidComplexity(value) {
	return COMPLEXITY_CATEGORIES.includes(value);
}

/**
 * Validate classification metadata — all three fields must be valid categories.
 * @param {Object} metadata - Classification metadata to validate
 * @param {string} metadata.intent - The intent category
 * @param {string} metadata.domain - The domain category
 * @param {string} metadata.complexity - The complexity category
 * @returns {boolean} True if all fields are valid categories
 */
export function isValidMetadata(metadata) {
	return (
		typeof metadata === "object" &&
		metadata !== null &&
		isValidIntent(metadata.intent) &&
		isValidDomain(metadata.domain) &&
		isValidComplexity(metadata.complexity)
	);
}
