import { createAgentDefinition } from "./factory.js";

/**
 * Translator agent definition for multi-language translation and language detection.
 */
export const translatorAgent = createAgentDefinition(
	"translator",
	"TRANSLATOR.md",
	"Specialized agent for multi-language translation and language detection.",
);
