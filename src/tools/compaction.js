import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { loadSession } from "../session/loader.js";

/**
 * Extract key points from conversation messages using heuristic analysis.
 * @param {Array} conversation - Array of conversation messages
 * @returns {{ decisions: string[], designPoints: string[], openQuestions: string[], nextSteps: string[] }}
 */
function summarizeConversation(conversation) {
	const decisions = [];
	const designPoints = [];
	const openQuestions = [];
	const nextSteps = [];

	// Keywords that indicate different types of content
	const decisionKeywords = [
		"decided", "let's go with", "the plan is", "we'll use", "we're going with",
		"agreed", "chose", "selected", "finalized", "settled on", "confirmed",
		"the approach is", "we decided to", "going to use", "will use",
	];

	const designKeywords = [
		"architecture", "design", "structure", "pattern", "implementation",
		"how it works", "the tool", "the system", "the feature", "the approach",
		"uses", "handles", "manages", "processes", "integrates",
	];

	const questionKeywords = [
		"question", "unclear", "not sure", "should we", "what about",
		"how should", "is there", "does this", "any concerns", "open question",
		"TODO", "need to decide", "to be determined", "TBD",
	];

	const nextStepKeywords = [
		"next", "after this", "then we", "follow up", "action item",
		"todo", "implement", "create", "add", "build", "write",
		"when we", "once we", "before we", "later", "upcoming",
	];

	for (const msg of conversation) {
		const content = (msg.content || "").toString().toLowerCase();
		const role = msg.role || "";

		// Focus on assistant messages and user messages that contain decisions
		if (role === "system") continue;

		const text = content.trim();
		if (!text) continue;

		// Check for decision indicators
		if (decisionKeywords.some((kw) => text.includes(kw))) {
			decisions.push(text.slice(0, 200));
			continue;
		}

		// Check for open questions
		if (questionKeywords.some((kw) => text.includes(kw))) {
			openQuestions.push(text.slice(0, 200));
			continue;
		}

		// Check for next steps
		if (nextStepKeywords.some((kw) => text.includes(kw))) {
			nextSteps.push(text.slice(0, 200));
			continue;
		}

		// Check for design/technical content
		if (designKeywords.some((kw) => text.includes(kw))) {
			designPoints.push(text.slice(0, 200));
			continue;
		}
	}

	// Deduplicate and limit results
	const dedup = (arr) => [...new Set(arr)].slice(0, 10);

	return {
		decisions: dedup(decisions),
		designPoints: dedup(designPoints),
		openQuestions: dedup(openQuestions),
		nextSteps: dedup(nextSteps),
	};
}

/**
 * Format a summary into a structured string.
 * @param {object} summary - The summarized content
 * @returns {string} Formatted summary string
 */
function formatSummary(summary) {
	const lines = [];

	lines.push("## Session Summary\n");

	if (summary.decisions.length > 0) {
		lines.push("### Core Decisions");
		for (const d of summary.decisions) {
			lines.push(`- ${d}`);
		}
		lines.push("");
	}

	if (summary.designPoints.length > 0) {
		lines.push("### Key Design Points");
		for (const d of summary.designPoints) {
			lines.push(`- ${d}`);
		}
		lines.push("");
	}

	if (summary.openQuestions.length > 0) {
		lines.push("### Open Questions");
		for (const q of summary.openQuestions) {
			lines.push(`- ${q}`);
		}
		lines.push("");
	}

	if (summary.nextSteps.length > 0) {
		lines.push("### Next Steps");
		for (const s of summary.nextSteps) {
			lines.push(`- ${s}`);
		}
		lines.push("");
	}

	// If nothing was found, provide a fallback
	if (
		summary.decisions.length === 0 &&
		summary.designPoints.length === 0 &&
		summary.openQuestions.length === 0 &&
		summary.nextSteps.length === 0
	) {
		lines.push("No structured summary could be extracted from the conversation.");
		lines.push("");
		lines.push("The conversation may be too short or lack clear decision/question markers.");
	}

	return lines.join("\n");
}

/**
 * Compaction tool: produces a semantic summarization of the current session.
 * @param {z.infer<typeof CompactionSchema>} input - Tool input
 * @param {object} options - Runtime options
 * @param {string} options.sessionsDir - Path to sessions directory
 * @returns {string} Formatted session summary
 */
export async function compactionImpl(input, options) {
	const { sessionId, maxMessages } = input;
	const sessionsDir = options?.sessionsDir || "memory/sessions/";

	// Load the session
	const session = loadSession(sessionsDir, maxMessages || 50, sessionId || "");

	if (!session.conversation || session.conversation.length === 0) {
		return "No conversation history found in the current session.";
	}

	// Summarize the conversation
	const summary = summarizeConversation(session.conversation);

	// Format and return
	return formatSummary(summary);
}

const CompactionSchema = z.object({
	sessionId: z
		.string()
		.optional()
		.describe("Optional session/thread ID to load (defaults to latest session)"),
	maxMessages: z
		.number()
		.int()
		.min(1)
		.optional()
		.describe("Maximum number of messages to include in the summary (default: 50)"),
});

/**
 * Compaction tool for session summarization.
 */
export const compaction = tool(compactionImpl, {
	name: "compaction",
	description:
		"Produces a semantic summarization of the current session, distilling conversation history into core decisions, key design points, open questions, and next steps. Useful for passing context to sub-agents or for session archival.",
	schema: CompactionSchema,
});

/**
 * Create a compaction tool with runtime options.
 * @param {object} options - Runtime options
 * @param {string} options.sessionsDir - Path to sessions directory
 * @returns {object} LangChain Tool instance
 */
export function createCompactionTool(options) {
	return tool((input) => compactionImpl(input, options), {
		name: "compaction",
		description:
			"Produces a semantic summarization of the current session, distilling conversation history into core decisions, key design points, open questions, and next steps. Useful for passing context to sub-agents or for session archival.",
		schema: CompactionSchema,
	});
}