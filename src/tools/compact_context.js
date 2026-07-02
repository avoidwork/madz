import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Regex patterns to detect context length errors across providers.
 * Pattern 1: Standard format - "maximum context length is/of X tokens"
 * Pattern 2: Context limit format - requires "context" before "limit" to avoid false positives on rate limit errors
 */
const CONTEXT_LENGTH_PATTERN_1 = /maximum\s+context\s+length[^0-9]*?(\d+)\s*tokens?/i;
const CONTEXT_LENGTH_PATTERN_2 = /context.*limit[:\s]*(\d+)/i;

/**
 * Extract the maximum context length from an error message.
 * @param {string} errorMessage - The error message from the LLM
 * @returns {number|null} The extracted context length, or null if not found
 */
export function extractContextLength(errorMessage) {
	if (!errorMessage || typeof errorMessage !== "string") return null;

	// Try standard format first
	let match = errorMessage.match(CONTEXT_LENGTH_PATTERN_1);
	if (match) return parseInt(match[1], 10);

	// Fall back to limit format
	match = errorMessage.match(CONTEXT_LENGTH_PATTERN_2);
	if (match) return parseInt(match[1], 10);

	return null;
}

/**
 * Check if an error is a context length exceeded error.
 * @param {Error} err - The error to check
 * @returns {boolean}
 */
export function isContextLengthError(err) {
	if (!err || !err.message) return false;
	return CONTEXT_LENGTH_PATTERN_1.test(err.message) || CONTEXT_LENGTH_PATTERN_2.test(err.message);
}

/**
 * Estimate token count from text using a rough heuristic.
 * ~1 token per 4 characters for English text.
 * @param {string} text - Text to estimate tokens for
 * @returns {number}
 */
function estimateTokens(text) {
	if (!text) return 0;
	return Math.ceil(text.length / 4);
}

/**
 * Summarize a conversation exchange (user message or assistant response).
 * @param {string} role - Message role
 * @param {string} content - Message content
 * @returns {string} Summary string
 */
function summarizeExchange(role, content) {
	if (!content) return "";
	const maxSummaryLength = 200;
	const preview = content.slice(0, maxSummaryLength);
	const truncated = content.length > maxSummaryLength ? "..." : "";
	const roleLabel = role === "user" ? "User" : "Assistant";
	return `[${roleLabel}]: ${preview}${truncated}`;
}

/**
 * Compact a conversation to fit within a token budget using tiered retention.
 *
 * Tier 1 (Always Retain): System prompt, most recent user message, last 3 assistant responses with tool calls
 * Tier 2 (Summarize): Previous 5-10 exchanges summarized into concise summaries
 * Tier 3 (Drop): Oldest exchanges beyond the summary window are dropped
 *
 * @param {Object} options - Compaction options
 * @param {string} options.systemPrompt - The system prompt to always include
 * @param {Array} options.conversation - Array of {role, content} conversation messages
 * @param {number} options.targetTokens - Target token budget
 * @param {Object} [options.options] - Additional options
 * @param {number} [options.options.retainRecent=3] - Number of recent exchanges to retain fully
 * @param {number} [options.options.summarizeWindow=10] - Number of older exchanges to summarize
 * @returns {{ ok: boolean, compactedMessages: Array, compactedTokenCount: number, strategy: string, originalTokenCount: number }}
 */
export function compactConversation({
	systemPrompt,
	conversation,
	targetTokens,
	recentCount = 3,
	summarizeWindow = 10,
}) {
	const result = {
		ok: false,
		compactedMessages: [],
		compactedTokenCount: 0,
		originalTokenCount: 0,
		strategy: "tiered-retention",
	};

	if (!conversation || conversation.length === 0) {
		return {
			...result,
			ok: true,
			compactedMessages: [],
			compactedTokenCount: 0,
		};
	}

	// Calculate original token count
	const allText = [systemPrompt, ...conversation.map((m) => m.content)].filter(Boolean);
	result.originalTokenCount = allText.reduce((sum, t) => sum + estimateTokens(t), 0);

	// Group conversation into exchange pairs (user + assistant)
	const exchanges = [];
	for (let i = 0; i < conversation.length; i += 2) {
		const userMsg = conversation[i];
		const assistantMsg = conversation[i + 1];
		if (userMsg) {
			exchanges.push({
				user: userMsg,
				assistant: assistantMsg || null,
				index: i,
			});
		}
	}

	if (exchanges.length === 0) {
		return {
			...result,
			ok: true,
			compactedMessages: [],
			compactedTokenCount: 0,
		};
	}

	// Build compacted messages using tiered retention
	const compacted = [];
	let currentTokenCount = estimateTokens(systemPrompt || "");

	// Add system prompt
	if (systemPrompt) {
		compacted.push({ role: "system", content: systemPrompt });
	}

	// Tier 1: Always retain the most recent exchanges in full
	const recentExchanges = exchanges.slice(-recentCount);
	for (const exchange of recentExchanges) {
		if (exchange.user) {
			compacted.push(exchange.user);
			currentTokenCount += estimateTokens(exchange.user.content);
		}
		if (exchange.assistant) {
			compacted.push(exchange.assistant);
			currentTokenCount += estimateTokens(exchange.assistant.content);
		}
	}

	// Tier 2: Summarize older exchanges
	const olderExchanges = exchanges.slice(0, -recentCount);
	const summarizeCount = Math.min(summarizeWindow, olderExchanges.length);
	const exchangesToSummarize = olderExchanges.slice(-summarizeCount);

	for (const exchange of exchangesToSummarize) {
		const summaryParts = [];
		if (exchange.user) {
			summaryParts.push(summarizeExchange("user", exchange.user.content));
		}
		if (exchange.assistant) {
			summaryParts.push(summarizeExchange("assistant", exchange.assistant.content));
		}
		const summaryText = summaryParts.join("\n");
		if (summaryText) {
			const summaryMsg = {
				role: "system",
				content: `[Conversation Summary]\n${summaryText}`,
			};
			compacted.push(summaryMsg);
			currentTokenCount += estimateTokens(summaryText);
		}
	}

	// Check if we're within budget
	if (currentTokenCount <= targetTokens) {
		return {
			...result,
			ok: true,
			compactedMessages: compacted,
			compactedTokenCount: currentTokenCount,
		};
	}

	// Tier 3: If still over budget, progressively reduce
	// First, try reducing the summarize window
	if (summarizeCount > 1) {
		const reducedCompacted = [];
		let reducedTokens = estimateTokens(systemPrompt || "");

		// Keep only the most recent exchange in full
		const latestExchange = exchanges[exchanges.length - 1];
		if (latestExchange.user) {
			reducedCompacted.push(latestExchange.user);
			reducedTokens += estimateTokens(latestExchange.user.content);
		}
		if (latestExchange.assistant) {
			reducedCompacted.push(latestExchange.assistant);
			reducedTokens += estimateTokens(latestExchange.assistant.content);
		}

		// Summarize remaining
		const remainingExchanges = exchanges.slice(0, -1);
		for (const exchange of remainingExchanges) {
			const summaryParts = [];
			if (exchange.user) summaryParts.push(summarizeExchange("user", exchange.user.content));
			if (exchange.assistant)
				summaryParts.push(summarizeExchange("assistant", exchange.assistant.content));
			const summaryText = summaryParts.join("\n");
			if (summaryText) {
				reducedCompacted.push({
					role: "system",
					content: `[Conversation Summary]\n${summaryText}`,
				});
				reducedTokens += estimateTokens(summaryText);
			}
		}

		if (reducedTokens <= targetTokens) {
			return {
				...result,
				ok: true,
				compactedMessages: reducedCompacted,
				compactedTokenCount: reducedTokens,
				strategy: "tiered-retention-reduced",
			};
		}

		// Try minimal: just system prompt + last user message
		const minimalCompacted = [];
		let minimalTokens = estimateTokens(systemPrompt || "");

		if (systemPrompt) {
			minimalCompacted.push({ role: "system", content: systemPrompt });
		}

		const lastUserMsg = exchanges[exchanges.length - 1]?.user;
		if (lastUserMsg) {
			minimalCompacted.push(lastUserMsg);
			minimalTokens += estimateTokens(lastUserMsg.content);
		}

		if (minimalTokens <= targetTokens) {
			return {
				...result,
				ok: true,
				compactedMessages: minimalCompacted,
				compactedTokenCount: minimalTokens,
				strategy: "minimal-retention",
			};
		}

		// Even minimal doesn't fit — return what we can
		if (minimalCompacted.length > 0) {
			return {
				...result,
				ok: true,
				compactedMessages: minimalCompacted,
				compactedTokenCount: minimalTokens,
				strategy: "minimal-over-budget",
				warning: "Even minimal context exceeds target budget",
			};
		}
	}

	// Last resort: return last user message only
	const lastUserMsg = exchanges[exchanges.length - 1]?.user;
	if (lastUserMsg) {
		return {
			...result,
			ok: true,
			compactedMessages: [lastUserMsg],
			compactedTokenCount: estimateTokens(lastUserMsg.content),
			strategy: "last-message-only",
			warning: "Only last user message could be retained",
		};
	}

	return {
		...result,
		warning: "Could not produce any compacted messages",
	};
}

/**
 * CompactContext tool implementation for LangChain.
 * Allows the agent to compact conversation context when encountering
 * context length errors.
 *
 * @param {Object} options - Runtime options
 * @param {import("@langchain/langgraph").BaseCheckpointSaver | null} [options.checkpointer] - LangGraph checkpointer for accessing conversation history
 * @param {number} [options.maxContextLength] - Model's max context length (from error detection)
 * @param {number} [options.maxTokens] - Max output tokens from config
 * @param {string} [options.systemPrompt] - System prompt to include in compaction
 * @returns {object} LangChain tool instance
 */
export function createCompactContextTool(options = {}) {
	const { checkpointer, maxContextLength, maxTokens, systemPrompt } = options;

	return tool(
		async (input) => {
			try {
				const { action, targetTokens } = input;

				if (action !== "compact") {
					return JSON.stringify({
						ok: false,
						error: `Unknown action: "${action}". Valid action: "compact"`,
					});
				}

				if (!targetTokens || typeof targetTokens !== "number" || targetTokens <= 0) {
					return JSON.stringify({
						ok: false,
						error: `compact requires: targetTokens (positive number)`,
					});
				}

				// Try to get conversation from checkpointer
				let conversation = [];
				if (checkpointer) {
					try {
						// The checkpointer stores messages keyed by thread_id
						// We need to retrieve the latest state
						const config = options.threadConfig || {};
						const threadId = config.configurable?.thread_id || config.thread_id;
						if (threadId) {
							const state = await checkpointer.getTuple({
								config: { configurable: { thread_id: threadId } },
							});
							if (state && state.messages) {
								conversation = state.messages
									.filter((m) => m._getType && m._getType() !== "system")
									.map((m) => ({
										role:
											m._getType() === "human"
												? "user"
												: m._getType() === "ai"
													? "assistant"
													: m._getType(),
										content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
									}));
							}
						}
					} catch {
						// Checkpointer access failed — fall back to empty conversation
						conversation = [];
					}
				}

				// If checkpointer not available, use conversation from options
				if (conversation.length === 0 && options.conversation) {
					conversation = options.conversation;
				}

				// Calculate target tokens if not provided
				const effectiveTarget =
					targetTokens || (maxContextLength && maxTokens ? maxContextLength - maxTokens : 50000);

				// Perform compaction
				const compactionResult = compactConversation({
					systemPrompt: systemPrompt || "",
					conversation,
					targetTokens: effectiveTarget,
				});

				return JSON.stringify({
					ok: compactionResult.ok,
					compactedMessages: compactionResult.compactedMessages,
					compactedTokenCount: compactionResult.compactedTokenCount,
					originalTokenCount: compactionResult.originalTokenCount,
					strategy: compactionResult.strategy,
					...(compactionResult.warning ? { warning: compactionResult.warning } : {}),
				});
			} catch (err) {
				return JSON.stringify({
					ok: false,
					error: `Compaction error: ${err.message}`,
				});
			}
		},
		{
			name: "compactContext",
			description:
				"Compaction tool for automatically reducing conversation context when the LLM returns a context length error. Compacts the conversation to fit within a target token budget using tiered retention (always retain recent messages, summarize older ones, drop oldest). Use this when the LLM reports that the maximum context length has been exceeded.",
			schema: z.object({
				action: z
					.string()
					.optional()
					.describe("Action to perform — always 'compact' for this tool"),
				targetTokens: z
					.number()
					.optional()
					.describe(
						"Target token budget for the compacted conversation. Calculated as: maxContextLength - maxTokens. " +
							"Example: if the model's max context is 128000 and maxTokens is 4096, use 123904.",
					),
			}),
		},
	);
}
