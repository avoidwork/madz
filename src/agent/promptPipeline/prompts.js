/**
 * Prompt templates for the prompt classification and rewriting pipeline.
 * Contains templates for both classification and rewriting LLM calls.
 * Rewriting templates are loaded from external files in ./prompts/ based on intent.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = join(__dirname, "../../../prompts");

/**
 * Classification prompt template.
 * Instructs the LLM to analyze a user prompt and return structured metadata
 * with intent, domain, and complexity categories.
 *
 * @param {string} userPrompt - The raw user prompt to classify
 * @returns {string} The classification prompt template with the user prompt inserted
 */
export function createClassificationPrompt(userPrompt) {
	return `You are a prompt classification engine. Analyze the following user prompt and classify it into structured metadata.

User prompt: "${userPrompt}"

Classify the prompt into exactly these categories:

**Intent** (one of): question, task, creative, analysis, other
- question: The user is asking for information or explanation
- task: The user wants you to do something or create something
- creative: The user wants creative content (stories, poems, art descriptions, etc.)
- analysis: The user wants you to analyze, compare, or evaluate something
- other: Doesn't fit neatly into the above categories

**Domain** (one of): coding, writing, analysis, general, other
- coding: Related to programming, software development, or technical implementation
- writing: Related to content creation, editing, or language work
- analysis: Related to data analysis, research, or evaluation
- general: Everyday questions or tasks not specific to a domain
- other: Doesn't fit neatly into the above categories

**Complexity** (one of): simple, moderate, complex
- simple: Straightforward, single-concept request that can be answered directly
- moderate: Requires some reasoning, multiple steps, or context
- complex: Requires deep reasoning, multiple concepts, or significant context

Return your classification as a JSON object with exactly this structure:
{
  "intent": "<category>",
  "domain": "<category>",
  "complexity": "<category>"
}

Do not include any explanation or additional text — only the JSON object.`;
}

/**
 * Load an external rewriting template from ./prompts/ based on intent.
 * Falls back to a default template if the intent-specific file is not found.
 *
 * @param {string} intent - The classified intent (question, task, creative, analysis, other)
 * @returns {string} The template content with placeholders
 */
function loadRewritingTemplate(intent) {
	const intentUpper = (intent || "other").toUpperCase();
	const templatePath = join(PROMPTS_DIR, `REWRITE_${intentUpper}.md`);

	try {
		return readFileSync(templatePath, "utf-8");
	} catch {
		// Fall back to default template if intent-specific file not found
		const defaultPath = join(PROMPTS_DIR, "REWRITE_OTHER.md");
		try {
			return readFileSync(defaultPath, "utf-8");
		} catch {
			// Ultimate fallback: inline default template
			return getDefaultRewritingTemplate();
		}
	}
}

/**
 * Get the default inline rewriting template (fallback).
 * @returns {string} The default rewriting template
 */
function getDefaultRewritingTemplate() {
	return `You are a prompt optimization engine. Your job is to rewrite user prompts into a clear, structured, and optimized format that helps an AI assistant understand and act on the request more effectively.

**Original prompt:** "{{userPrompt}}"

**Classification metadata:**
- Intent: {{intent}}
- Domain: {{domain}}
- Complexity: {{complexity}}

**Rewriting guidelines:**

1. **Preserve the original intent** — Do not change what the user is asking for. Only improve clarity and structure.

2. **Add structure** — If the prompt is vague or unstructured, add clear sections:
   - What the user wants to accomplish
   - Any specific requirements or constraints
   - Expected output format (if implied)

3. **Clarify ambiguity** — If the prompt has ambiguous terms, add brief clarifications based on the classified domain.

4. **Match complexity** — For "simple" prompts, keep the rewrite concise. For "moderate" or "complex" prompts, add relevant context and structure.

5. **Do NOT add requirements** that weren't in the original prompt. Only restructure and clarify.

Return ONLY the rewritten prompt as a plain string. Do not include any explanation, metadata, or additional text — only the optimized prompt text.`;
}

/**
 * Replace placeholders in a template with actual values.
 * Placeholders use {{key}} syntax.
 *
 * @param {string} template - The template string with placeholders
 * @param {Object} values - Key-value pairs to replace placeholders
 * @returns {string} The template with placeholders replaced
 */
function replacePlaceholders(template, values) {
	let result = template;
	for (const [key, value] of Object.entries(values)) {
		const placeholder = `{{${key}}}`;
		result = result.replaceAll(placeholder, String(value ?? ""));
	}
	return result;
}

/**
 * Rewriting prompt template.
 * Loads an intent-specific external template from ./prompts/ and fills in
 * the user prompt and classification metadata.
 *
 * @param {string} userPrompt - The original user prompt
 * @param {Object} metadata - Classification metadata with intent, domain, complexity
 * @param {string} metadata.intent - The classified intent
 * @param {string} metadata.domain - The classified domain
 * @param {string} metadata.complexity - The classified complexity
 * @returns {string} The rewriting prompt template with all parameters inserted
 */
export function createRewritingPrompt(userPrompt, metadata) {
	const { intent, domain, complexity } = metadata;
	const template = loadRewritingTemplate(intent);
	return replacePlaceholders(template, {
		userPrompt,
		intent,
		domain,
		complexity,
	});
}