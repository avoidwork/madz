/** A leading list number a model may add to a choice, such as `1. ` or `2) `. */
const LEADING_NUMBER = /^\s*\d+\s*[.)]\s+/;

/** A reply that is only a list number: `2`, `2.` or `2)`. */
const NUMERIC_REPLY = /^\s*(\d+)\s*[.)]?\s*$/;

/**
 * Clean a list of choices: strip any number the model added (the prompt numbers
 * them itself), trim, and drop empties.
 * @param {unknown} choices - Choices as supplied to the clarify tool
 * @returns {string[]} The cleaned choices; empty when none were given
 */
export function normalizeChoices(choices) {
	if (!Array.isArray(choices)) return [];
	return choices.map((choice) => String(choice).replace(LEADING_NUMBER, "").trim()).filter(Boolean);
}

/**
 * Format choices as a numbered markdown list, one per line.
 * @param {string[]} choices - The choices to number
 * @returns {string} The list, e.g. `1. A\n2. B`
 */
export function formatChoices(choices) {
	return choices.map((choice, index) => `${index + 1}. ${choice}`).join("\n");
}

/**
 * Build the text shown to the user for a clarification: the question, then its
 * choices as a numbered list.
 * @param {string} question - The clarification question
 * @param {string[]} [choices] - The choices, if any
 * @returns {string} The prompt text
 */
export function formatClarifyPrompt(question, choices = []) {
	return choices.length > 0 ? `${question}\n\nOptions:\n${formatChoices(choices)}` : question;
}

/**
 * Resolve a reply to a numbered list. A reply that is just a number in range
 * (`2`, `2.`, `2)`) becomes that choice; anything else is returned unchanged.
 * @param {unknown} reply - The user's reply
 * @param {string[]} choices - The choices that were shown
 * @returns {unknown} The chosen option, or the reply unchanged
 */
export function resolveChoice(reply, choices) {
	if (typeof reply !== "string") return reply;
	const match = NUMERIC_REPLY.exec(reply);
	if (!match) return reply;
	const index = Number(match[1]);
	return index >= 1 && index <= choices.length ? choices[index - 1] : reply;
}
