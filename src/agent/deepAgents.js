import {
	createDeepAgent,
	CompositeBackend,
	registerHarnessProfile,
	createHarnessProfile,
} from "deepagents";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { InMemoryStore } from "@langchain/langgraph-checkpoint";
import { RemoveMessage } from "@langchain/core/messages";
import { loadConfig } from "../config/loader.js";
import { loadSystemPrompt } from "../memory/prompts.js";
import { SkillRegistry } from "../skills/registry.js";
import { createChatModel, resolveCopilotModel } from "../provider/openai.js";
import { getModelContextLength } from "../provider/modelInfo.js";
import { getActiveProviderConfig, getActiveProviderName } from "../provider/index.js";
import { createTokenBudgetMiddleware } from "../provider/tokenBudgetMiddleware.js";
import {
	createSummarizationMiddlewareFromConfig,
	forceSummarize,
} from "../provider/summarizationMiddleware.js";
import { createImageDispatchMiddleware } from "../provider/imageDispatchMiddleware.js";
import {
	buildToolConfig,
	getToolsForAgentTypes,
	MCP_TOOL_CLASSIFICATIONS,
	ORCHESTRATOR_TOOLS,
	TOOLS,
} from "../tools/index.js";
import { createEmailProvider, validateProviderConfig } from "../tools/email/index.js";
import { createCoreBackend } from "./coreBackend.js";
import { createContextBackend } from "./contextBackend.js";
import { getAllAgents } from "./agentDefinitions.js";
import { logger } from "../shared/logger.js";
import { createCodeInterpreterMiddleware } from "@langchain/quickjs";
import { createTurnTransformer } from "../stream/transformers/index.js";

/**
 * Get tool classifications for an agent by name.
 * Maps agent names to their required tool classifications.
 * @param {string} agentName - Agent name
 * @returns {string[]} Array of tool classifications
 */
function getAgentClassifications(agentName) {
	return [agentName];
}

/**
 * Create subagent definitions with filtered tools and agent-specific skills.
 * @param {Object[]} allTools - Array of built tool instances
 * @param {Object} model - Chat model instance (orchestrator model)
 * @param {SkillRegistry} skillRegistry - Skill registry instance
 * @param {Object} config - Resolved config object
 * @returns {Object[]} Array of subagent definitions
 */
export function createSubagentDefinitions(allTools, model, skillRegistry, config) {
	const allAgents = getAllAgents();
	const providerConfig = getActiveProviderConfig(config);

	return allAgents.map((agentDef) => {
		const classifications = getAgentClassifications(agentDef.name);
		const filteredToolNames = getToolsForAgentTypes(classifications, TOOLS);
		// Map tool names back to actual tool instances — SubAgent.specs
		// require StructuredTool[], not string names.
		const filteredTools = filteredToolNames
			.map((name) => allTools.find((t) => t.name === name))
			.filter(Boolean);

		// Get skills specific to this agent (metadata.agent === agentName)
		const agentSkills = skillRegistry.getSkillPathsForAgent(agentDef.name);

		// Determine per-agent temperature from config
		const agentTemp = config.subAgentsTemperature?.[agentDef.name];

		// Create a per-agent model instance when a specific temperature is configured
		let agentModel = model;
		if (agentTemp !== undefined) {
			agentModel = createChatModel({
				...providerConfig,
				temperature: agentTemp,
			});
		}

		// Surface the tool list in the description so the orchestrator can see
		// which tools each subagent carries (deepagents renders this via
		// describeSubagentForTool() as `- <name>: <description>`).
		const toolList = filteredToolNames.length > 0 ? ` Tools: ${filteredToolNames.join(", ")}` : "";

		const definition = {
			...agentDef,
			description: `${agentDef.description}${toolList}`,
			model: agentModel,
			tools: filteredTools,
		};

		// Attach skills array only if this agent has coding-specific skills
		if (agentSkills.length > 0) {
			definition.skills = agentSkills;
		}

		return definition;
	});
}

/**
 * Determine whether a message contains a vision block (base64 image data).
 *
 * A message is considered vision-bearing when it is either:
 * - A `readImage` ToolMessage whose content JSON has a non-empty `data` field
 *   (the base64-encoded image payload), or
 * - A message whose content array contains an `image_url` content block.
 *
 * @param {Object} message - A LangChain message
 * @returns {boolean} True if the message contains a vision block
 */
export function hasVisionBlock(message) {
	const type = message?._getType?.() ?? message?.type ?? message?.role;

	// A `readImage` ToolMessage whose content JSON has a non-empty `data` field.
	if (type === "tool" && message.name === "readImage") {
		const content = message.content;
		if (typeof content === "string") {
			try {
				const parsed = JSON.parse(content);
				if (parsed?.ok === true && parsed?.data && parsed.data.length > 0) return true;
			} catch {
				// Not JSON — not a vision block.
			}
		}
	}

	// A message whose content array contains an `image_url` content block.
	if (Array.isArray(message?.content)) {
		return message.content.some((block) => block?.type === "image_url");
	}

	return false;
}

/**
 * Convert a LangChain message to the simplified `{ role, content }` shape used
 * by `sessionState.getConversation()`.
 * @param {Object} message - A LangChain message
 * @returns {{ role: string, content: string }} The simplified message
 */
function toConversationExchange(message) {
	const type = message?._getType?.() ?? message?.type ?? message?.role;
	let role = type;
	if (type === "human") role = "user";
	else if (type === "ai") role = "assistant";
	else if (type === "tool") role = "tool";
	else if (type === "system") role = "system";

	// Flatten content blocks to a single string so the TUI conversation view
	// does not render `[object Object]` for multimodal parts.
	let content = message?.content;
	if (Array.isArray(content)) {
		content = content
			.map((block) => {
				if (typeof block === "string") return block;
				if (!block || typeof block !== "object") return "";
				switch (block.type) {
					case "text":
						return block.text ?? "";
					case "reasoning":
						return block.reasoning ?? "";
					case "image_url": {
						const iu = block.image_url;
						return typeof iu === "string" ? iu : (iu?.url ?? "");
					}
					case "image":
					case "video":
					case "audio":
					case "file":
						return block.url ?? block.data ?? block.fileId ?? "";
					case "text-plain":
						return block.text ?? "";
					default:
						return JSON.stringify(block);
				}
			})
			.join("");
	} else if (content && typeof content === "object") {
		content = JSON.stringify(content);
	}

	return { role, content: content ?? "" };
}

/**
 * Compact the agent's message state by removing messages that contain vision
 * blocks (base64 image data) and trimming the remaining older messages so the
 * context window is compressed.
 *
 * The routine walks the agent's message state (via `agent.getState`), filters
 * out vision-bearing messages, trims the remaining messages to the most recent
 * `keepRecent`, and writes the result back to the checkpointer via
 * `agent.updateState`. Because the `messages` channel uses a reducer that
 * merges by message ID, the update is prefixed with a `RemoveMessage` carrying
 * the `__remove_all__` sentinel so the existing history is fully replaced
 * rather than appended.
 *
 * When a `sessionState` is supplied, the TUI's conversation view is also
 * updated (via `loadConversation`) so the TUI and the model agree on the
 * compacted history.
 *
 * @param {Object} agent - The deepagents orchestrator instance
 * @param {Object} config - LangGraph runnable config (with `thread_id`)
 * @param {Object} [sessionState] - Optional session state manager to sync
 * @param {Object} [options] - Compaction options
 * @param {number} [options.keepRecent=20] - Number of recent messages to retain after trimming
 * @param {Object} [options.backend] - The deepagents backend used for history offload
 * @param {Object} [options.model] - The chat model used to generate the summary
 * @returns {Promise<{ok: boolean, removedVision: number, trimmed: number, remaining: number, error?: string}>}
 *   Result describing what was removed and trimmed
 */
export async function compactAgentContext(agent, config, sessionState, options = {}) {
	const keepRecent = options.keepRecent ?? 20;
	const backend = options.backend;
	const model = options.model;

	let state;
	try {
		state = await agent.getState(config);
	} catch (err) {
		return { ok: false, removedVision: 0, trimmed: 0, remaining: 0, error: err.message };
	}

	const messages = state?.values?.messages || [];
	if (messages.length === 0) {
		return { ok: true, removedVision: 0, trimmed: 0, remaining: 0 };
	}

	// Force a real summarization through the deepagents SummarizationMiddleware,
	// bypassing the configured trigger threshold. This produces a summary message
	// plus the preserved recent messages. When the middleware is unavailable
	// (no backend/model), fall back to the legacy trim-only behavior.
	let summarized;
	if (backend && model) {
		try {
			summarized = await forceSummarize({
				backend,
				keep: { type: "messages", value: keepRecent },
				state: state.values,
				model,
			});
		} catch (err) {
			logger.warn(
				{ error: err.message },
				"[compact] forced summarization failed; falling back to trim",
			);
		}
	}

	// Filter out vision-bearing messages (readImage ToolMessages with base64
	// data and image_url content blocks) from the summarized set.
	const filtered = (summarized || messages).filter((m) => !hasVisionBlock(m));
	const removedVision = (summarized ? summarized.length : messages.length) - filtered.length;

	// When summarization succeeded, the middleware already applied the keep
	// policy (summary + preserved recent messages). Re-trimming here would drop
	// the summary message, so only trim on the fallback path.
	let trimmed = 0;
	let finalMessages = filtered;
	if (!summarized && filtered.length > keepRecent) {
		trimmed = filtered.length - keepRecent;
		finalMessages = filtered.slice(-keepRecent);
	}

	// Replace the checkpointer state with the compacted message set.
	// The `model_request` node is the graph node that owns the `messages`
	// channel — targeting it lets updateState replace the message history.
	try {
		await agent.updateState(
			config,
			{ messages: [new RemoveMessage({ id: "__remove_all__" }), ...finalMessages] },
			"model_request",
		);
	} catch (err) {
		return {
			ok: false,
			removedVision,
			trimmed,
			remaining: finalMessages.length,
			error: err.message,
		};
	}

	// Sync the TUI conversation view so it agrees with the compacted model state.
	if (sessionState) {
		sessionState.loadConversation(finalMessages.map(toConversationExchange));
	}

	return { ok: true, removedVision, trimmed, remaining: finalMessages.length };
}

/**
 * Create a Deep Agents orchestrator with coding and utility sub-agents.
 * Uses deepagents middleware for filesystem, memory, skills, and summarization.
 * @param {import("@langchain/langgraph").BaseCheckpointSaver | null} [checkpointer=null] - Optional checkpointer
 * @returns {Promise<{agent: Object, model: Object}>} The orchestrator agent and its chat model
 */
export async function createDeepAgentsOrchestrator(checkpointer = null) {
	const config = loadConfig();
	let systemPrompt = await loadSystemPrompt();
	const agentsPath = join(config.cwd, "AGENTS.md");

	// Discover skills from configured scopes
	const skillRegistry = new SkillRegistry();
	await skillRegistry.discover();
	const skillPaths = skillRegistry.getSkillPaths();

	// Load AGENTS.md directly into the system prompt to avoid deepagents'
	// MemoryMiddleware injecting its own hardcoded memory guidelines.
	try {
		const agentsContent = await readFile(agentsPath, "utf-8");
		systemPrompt = systemPrompt + "\n\n---\n\n" + agentsContent;
	} catch {
		logger.debug(`[deepAgents] Failed to load AGENTS.md: ${agentsPath}`);
	}

	// Create model from config
	const providerName = getActiveProviderName(config);
	const providerConfig = getActiveProviderConfig(config);
	// For GitHub Copilot, resolve the configured model against the tenant's
	// available models (best-effort; falls back to the configured string).
	if (providerConfig.type === "github-copilot") {
		providerConfig.model = await resolveCopilotModel(providerConfig);
	}
	const model = createChatModel(providerConfig);

	// Validate email provider config at startup (non-blocking)
	if (config.email?.provider?.type) {
		const validation = validateProviderConfig(config.email.provider);
		if (!validation.valid) {
			logger.warn(
				{ errors: validation.errors },
				`[email] Provider config validation failed: ${validation.errors.join("; ")}`,
			);
		} else {
			// Attempt to create the provider to catch runtime errors early
			try {
				const provider = createEmailProvider(config.email.provider);
				const configValidation = provider.validateConfig();
				if (!configValidation.valid) {
					logger.warn(
						{ errors: configValidation.errors },
						`[email] Provider instance validation failed: ${configValidation.errors.join("; ")}`,
					);
				} else {
					logger.info(`[email] Provider "${config.email.provider.type}" validated successfully`);
				}
			} catch (err) {
				logger.warn(`[email] Provider creation failed: ${err.message}`);
			}
		}
	}

	// Register harness profile for subagents using config-derived model identifier.
	// The model name may contain colons (e.g. "qwen3.8:27b-mlx"), so we replace
	// them with hyphens to keep the "provider:model" key format valid — the
	// deepagents library rejects keys with more than one colon.
	const modelIdentifier = `${providerName}:${providerConfig.model.replace(/:/g, "-")}`;
	registerHarnessProfile(
		modelIdentifier,
		createHarnessProfile({
			excludedTools: ["execute", "grep", "ls"],
		}),
	);

	// Build tools from config — filter to orchestrator-only tools
	const buildOptions = {
		permissions: config.sandbox.permissions || [],
		allowedPaths: config.sandbox.paths,
		maxReadSize: config.sandbox.maxReadSize || "1mb",
		registry: skillRegistry,
		sessionsDir: join(config.cwd, config.memory.sessionsDir),
		safety: config.sandbox.safety,
		timeout: config.sandbox.timeout,
		memoryLimit: config.sandbox.memoryLimit,
		contextDir: join(config.cwd, config.memory.contextDir),
		ephemeralTtlDays: config.memory?.ephemeral?.ttlDays || 7,
		ephemeralMaxEntries: config.memory?.ephemeral?.maxEntries || 10,
		config,
	};

	// Build all tools, then filter to orchestrator-only set
	const allTools = await buildToolConfig(buildOptions);
	logger.info(
		{ tools: allTools.map((t) => ({ name: t.name, type: typeof t, lc: t?.lc })) },
		`All tools: ${allTools.length}`,
	);

	// Filter to orchestrator tools only — domain-specific tools go to subagents.
	// MCP tools are dynamic; include those classified for the orchestrator.
	const orchestratorToolNames = new Set(ORCHESTRATOR_TOOLS);
	const orchestratorTools = allTools.filter(
		(t) =>
			orchestratorToolNames.has(t.name) ||
			(MCP_TOOL_CLASSIFICATIONS[t.name] || []).includes("orchestrator"),
	);
	logger.info(
		{ tools: orchestratorToolNames.size },
		`Orchestrator tools: ${orchestratorToolNames.size}`,
	);

	const coreBackend = createCoreBackend();
	const contextBackend = createContextBackend();
	const contextRoute = "/" + config.memory.contextDir.replace(/^\.?\//, "");

	// Create subagent definitions with filtered tools and agent-specific skills
	const subagentDefinitions = createSubagentDefinitions(allTools, model, skillRegistry, config);

	// All discovered skills are available to the orchestrator

	// Composite backend shared by the orchestrator and the summarization
	// middleware (which offloads conversation history to it).
	const backend = new CompositeBackend(coreBackend, {
		[contextRoute]: contextBackend,
	});

	// Token-budget enforcement middleware. Registered LAST: AgentNode composes
	// the wrapModelCall chain backwards, so the last entry is innermost and
	// observes the final post-summarization/post-truncation message set.
	// Returns null when maxTokensMinute is 0/unset, so it is spread in conditionally.
	// The `onContextWindowExceeded` callback compacts the context via the agent's
	// exposed compaction path and lets the middleware re-send the request once.
	let compactOnContextWindowExceeded;
	const tokenBudgetMiddleware = createTokenBudgetMiddleware({
		maxTokensMinute: providerConfig.rateLimit?.maxTokensMinute,
		model,
		maxTokens: providerConfig.maxTokens,
		onContextWindowExceeded: async (err, request) => {
			if (typeof compactOnContextWindowExceeded === "function") {
				await compactOnContextWindowExceeded(err, request);
			}
		},
	});

	// Configurable summarization middleware. Registered BEFORE the token-budget
	// middleware so the budget observes the post-summarization message set.
	// Returns null when the `summarization` config section is absent or
	// `enabled` is false, so unset config is a true no-op (deepagents' library
	// default of 170k trigger / keep 6 applies). When enabled, the returned
	// middleware is named `SummarizationMiddleware`, which displaces the library
	// default via same-name merge semantics in `createDeepAgent`.
	// Derive the summarization trigger from the provider model context length.
	// The configured token value is a guess that drifts from reality as models
	// change. When the model's real context window is smaller than the
	// configured trigger, the conversation overflows before summarization fires;
	// when larger, we summarize too early. Resolve the context length at init
	// and override the trigger with 80% of it. The 80% is hardcoded; no config
	// schema change. If the context length cannot be resolved (unreachable,
	// model not found, field absent), fall back to the configured token value so
	// startup never blocks on a network call.
	const contextLength = await getModelContextLength(providerConfig);
	if (contextLength !== undefined) {
		const triggerTokens = Math.floor(contextLength * 0.8);
		logger.info(
			{ contextLength, triggerTokens },
			"[summarization] derived trigger from provider model context length",
		);
		// Mutate the shared config singleton so the /settings view reflects the
		// live derived trigger. `loadConfig()` is cached, so this is the same
		// object the SettingsPanel reads.
		config.summarization.trigger = { type: "tokens", value: triggerTokens };
	}

	const summarizationMiddleware = createSummarizationMiddlewareFromConfig({
		backend,
		config: config.summarization,
	});

	// Image-dispatch middleware. Registered AFTER summarization and BEFORE
	// token-budget: AgentNode composes the wrapModelCall chain backwards, so the
	// last entry is innermost. Registering after summarization means this
	// middleware observes the final post-summarization message set; registering
	// before token-budget means the budget sees the injected image when
	// estimating context cost.
	const imageDispatchMiddleware = createImageDispatchMiddleware();

	const agent = createDeepAgent({
		model,
		tools: orchestratorTools,
		systemPrompt,
		store: new InMemoryStore(),
		backend,
		subagents: subagentDefinitions,
		...(skillPaths.length > 0 && { skills: skillPaths }),
		...(checkpointer && { checkpointer }),
		middleware: [
			createCodeInterpreterMiddleware(),
			...(summarizationMiddleware ? [summarizationMiddleware] : []),
			imageDispatchMiddleware,
			...(tokenBudgetMiddleware ? [tokenBudgetMiddleware] : []),
		],
		streamTransformers: [() => createTurnTransformer()],
	});

	// Expose a compaction path so the TUI can manually compress the context
	// window on demand. The callback is bound to the agent instance and accepts
	// a LangGraph runnable config (with `thread_id`), an optional session state
	// manager to sync, plus optional options.
	agent.compactContext = async (config, sessionState, options) =>
		compactAgentContext(agent, config, sessionState, { ...options, backend, model });

	// Wire the middleware's 400 context-window handler to the agent's compaction
	// path. The middleware is created before the agent, so this closure is set
	// once the agent exists. It extracts the thread_id from the request runtime
	// and compacts the context for that thread, then the middleware re-sends.
	compactOnContextWindowExceeded = async (err, request) => {
		const threadId = request?.runtime?.configurable?.thread_id;
		const config = threadId ? { configurable: { thread_id: threadId } } : undefined;
		await agent.compactContext(config);
	};

	// Expose the MCP adapter (if any) so the caller can close it on shutdown.
	// `allTools` is an array with the adapter attached as a property when MCP
	// servers are configured.
	const mcpAdapter = allTools.mcpAdapter;

	return { agent, model, systemPrompt, mcpAdapter };
}
