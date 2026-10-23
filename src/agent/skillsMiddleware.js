import { createMiddleware } from "langchain";
import { StateSchema } from "@langchain/langgraph";
import { skillsMetadataValue, filesValue } from "deepagents";

/**
 * Skills System prompt template injected by the replacement middleware.
 *
 * This replaces deepagents' hardcoded `SKILLS_SYSTEM_PROMPT`, which instructs
 * the agent to `read_file` the SKILL.md path. madz ships a `skill` tool that
 * loads the body (and a supporting-file inventory) deterministically, so the
 * prompt directs the agent to that tool instead.
 */
const SKILLS_SYSTEM_PROMPT = `
  ## Skills System

  You have access to a skills library that provides specialized capabilities and domain knowledge.

  {skills_locations}

  **Available Skills:**

  {skills_list}

  **How to Use Skills (Progressive Disclosure):**

  Skills follow a **progressive disclosure** pattern - you know they exist (name + description above), but you only load the full instructions when needed:

  1. **Recognize when a skill applies**: Check if the user's task matches any skill's description.
  2. **Load the skill's instructions**: Use the \`skill\` tool with the skill's name. It returns the full SKILL.md body plus a list of the skill's supporting files (scripts/, references/, assets/).
  3. **Follow the skill's instructions**: SKILL.md contains step-by-step workflows, best practices, and examples.
  4. **Access supporting files**: Use the file paths returned by the \`skill\` tool, or read them from the skill's directory.

  **When to Use Skills:**
  - When the user's request matches a skill's domain (e.g., "research X" → web-research skill)
  - When you need specialized knowledge or structured workflows
  - When a skill provides proven patterns for complex tasks

  **Skills are Self-Documenting:**
  - Each SKILL.md tells you exactly what the skill does and how to use it
  - Use the \`skill\` tool to load a skill's instructions on demand

  **Example Workflow:**

  User: "Can you research the latest developments in quantum computing?"

  1. Check available skills above → See "web-research" skill
  2. Load the skill: \`skill({ name: "web-research" })\`
  3. Follow the skill's research workflow (search → organize → synthesize)
  4. Use any helper scripts or references listed in the skill's file inventory

  Remember: Skills are tools to make you more capable and consistent. When in doubt, check if a skill exists for the task!
`;

/**
 * Format the skill sources for display in the system prompt.
 * @param {string[]} sources - Skill source paths
 * @returns {string} Formatted sources section
 */
function formatSkillsLocations(sources) {
	if (sources.length === 0) return "**Skills Sources:** None configured";
	const lines = [];
	for (let i = 0; i < sources.length; i++) {
		const sourcePath = sources[i];
		const name =
			sourcePath
				.replace(/[/\\]$/, "")
				.split(/[/\\]/)
				.filter(Boolean)
				.pop()
				?.replace(/^./, (c) => c.toUpperCase()) || "Skills";
		const suffix = i === sources.length - 1 ? " (higher priority)" : "";
		lines.push(`**${name} Skills**: \`${sourcePath}\`${suffix}`);
	}
	return lines.join("\n");
}

/**
 * Format the skill catalog for display in the system prompt.
 *
 * Unlike the library's `formatSkillsList`, this does NOT append
 * "→ Read \`<path>\` for full instructions" — that line steers the agent toward
 * `read_file`. Instead it points at the `skill` tool.
 * @param {Array<{name: string, description: string}>} skills - Skill catalog entries
 * @returns {string} Formatted skill list
 */
function formatSkillsList(skills) {
	if (skills.length === 0) return "(No skills available yet.)";
	return skills.map((skill) => `- **${skill.name}**: ${skill.description}`).join("\n");
}

/**
 * Create the replacement `SkillsMiddleware`.
 *
 * Displaces deepagents' auto-created `SkillsMiddleware` via same-name merge in
 * `mergeMiddlewareStack` (the same mechanism the eviction-ceiling middleware
 * uses). It injects a prompt that directs the agent to the `skill` tool rather
 * than `read_file`, and it loads skill metadata from madz's already-discovered
 * `SkillRegistry` instead of re-reading the backend.
 *
 * @param {Object} options - Middleware options
 * @param {Object} options.registry - madz `SkillRegistry` instance (already discovered)
 * @param {string[]} options.sources - Skill source paths (for the locations section)
 * @returns {Object} The middleware
 */
export function createSkillsMiddleware(options = {}) {
	const { registry, sources = [] } = options;

	return createMiddleware({
		name: "SkillsMiddleware",
		stateSchema: new StateSchema({
			skillsMetadata: skillsMetadataValue,
			files: filesValue,
		}),
		wrapModelCall(request, handler) {
			const catalog = registry?.getCatalog?.() ?? [];
			const skillsLocations = formatSkillsLocations(sources);
			const skillsList = formatSkillsList(catalog);
			const skillsSection = SKILLS_SYSTEM_PROMPT.replace(
				"{skills_locations}",
				skillsLocations,
			).replace("{skills_list}", skillsList);

			const newSystemMessage = request.systemMessage.concat(skillsSection);
			return handler({
				...request,
				systemMessage: newSystemMessage,
			});
		},
	});
}
