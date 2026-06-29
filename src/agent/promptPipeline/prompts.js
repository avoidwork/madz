/**
 * Prompt templates for the prompt classification and rewriting pipeline.
 * Contains templates for both classification and rewriting LLM calls.
 */

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
 * Rewriting prompt template.
 * Instructs the LLM to rewrite a user prompt into an optimized, structured format
 * using the classification metadata to inform the rewrite.
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
	return `You are a prompt optimization engine. Your job is to rewrite user prompts into a clear, structured, and optimized format that helps an AI assistant understand and act on the request more effectively.

**Original prompt:** "${userPrompt}"

**Classification metadata:**
- Intent: ${intent}
- Domain: ${domain}
- Complexity: ${complexity}

**Rewriting guidelines:**

1. **Preserve the original intent** — Do not change what the user is asking for. Only improve clarity and structure.

2. **Add structure** — If the prompt is vague or unstructured, add clear sections:
   - What the user wants to accomplish
   - Any specific requirements or constraints
   - Expected output format (if implied)

3. **Clarify ambiguity** — If the prompt has ambiguous terms, add brief clarifications based on the classified domain.

4. **Match complexity** — For "simple" prompts, keep the rewrite concise. For "moderate" or "complex" prompts, add relevant context and structure.

5. **Do NOT add requirements** that weren't in the original prompt. Only restructure and clarify.

**Examples:**

Input: "fix it"
Classification: { intent: "task", domain: "coding", complexity: "simple" }
Output: "Fix the code issue in the current project. Identify and resolve any bugs or errors present."

Input: "write a story"
Classification: { intent: "creative", domain: "writing", complexity: "moderate" }
Output: "Write a creative short story. The story should have a clear narrative arc with characters, setting, and a resolution."

Input: "compare python and javascript"
Classification: { intent: "analysis", domain: "coding", complexity: "moderate" }
Output: "Compare Python and JavaScript as programming languages. Cover key differences in syntax, use cases, performance, and ecosystem. Present the comparison in a structured format."

Return ONLY the rewritten prompt as a plain string. Do not include any explanation, metadata, or additional text — only the optimized prompt text.`;
}
