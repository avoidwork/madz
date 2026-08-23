import { createAgentDefinition } from "./factory.js";

/**
 * Text editor agent definition for copywriting, editing, summarization, and rewriting.
 */
export const textEditorAgent = createAgentDefinition(
	"textEditor",
	"TEXT_EDITOR.md",
	"Specialized agent for text processing — summarize, rewrite, tone adjustment, grammar correction, shorten, and expand.",
);
