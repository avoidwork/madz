import {
	createDeepAgent,
	createSummarizationMiddleware,
	CompositeBackend,
	registerHarnessProfile,
	createHarnessProfile,
} from "deepagents";
import { join, resolve } from "node:path";
import { InMemoryStore } from "@langchain/langgraph-checkpoint";
import { RemoveMessage } from "@langchain/core/messages";
import { isCancelledToolMessage } from "../shared/cancelledToolMessage.js";
import { loadConfig } from "../config/loader.js";
import { loadSystemPrompt } from "../memory/prompts.js";
import { SkillRegistry } from "../skills/registry.js";
import { createChatModel, resolveCopilotModel } from "../provider/openai.js";
import { getModelContextLength } from "../provider/modelInfo.js";
import { getActiveProviderConfig, getActiveProviderName } from "../provider/index.js";
import { createTokenBudgetMiddleware } from "../provider/tokenBudgetMiddleware.js";
import { createCopilotRetryMiddleware } from "../provider/copilotRetryMiddleware.js";
import { createEvictionAwareFilesystemMiddleware } from "./evictionCeiling.js";
import { createSkillsMiddleware } from "./skillsMiddleware.js";
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
import { compactMessages, compactRequest } from "./compaction.js";
import { getEffectiveMessages } from "./effectiveMessages.js";
import { createTurnTransformer } from "../stream/transformers/index.js";

/**
 * Cached number of recent messages kept verbatim after compaction. Read once
 * from `loadConfig().summarization.keepMessages` so `compactAgentContext` does
 * not re-load the config on every invocation. `loadConfig()` is itself cached,
 * so this mirrors the same value without the per-call lookup.
 * @type {number}
 */
const KEEP_MESSAGES = loadConfig().summarization?.keepMessages;

/**
 * Build the model-config overrides for a subagent from its per-agent
 * temperature and reasoning-effort settings. Returns an empty object when
 * neither is configured, so callers can skip creating a per-agent model.
 * @param {number | undefined} temperature - Per-agent temperature, or undefined
 * @param {"low" | "medium" | "high" | undefined} reasoning - Per-agent reasoning effort, or undefined
 * @returns {Object} Overrides to merge onto the active provider config
 */
export function buildSubAgentModelOverrides(temperature, reasoning) {
	const overrides = {};
	if (temperature !== undefined) {
		overrides.temperature = temperature;
	}
	if (reasoning !== undefined) {
		overrides.reasoning = { effort: reasoning };
	}
	return overrides;
}

/**
 * Create subagent definitions with filtered tools and agent-specific skills.
 * @param {Object[]} allTools - Array of built tool instances
 * @param {Object} model - Chat model instance (orchestrator model)
 * @param {SkillRegistry} skillRegistry - Skill registry instance
 * @param {Object} config - Resolved config object
 * @param {Object} [backend] - Backend shared with the agent, used by each
 *   subagent's filesystem middleware. Defaults to the library's StateBackend
 *   when omitted.
 * @returns {Promise<Object[]>} Array of subagent definitions
 */
export async function createSubagentDefinitions(allTools, model, skillRegistry, config, backend) {
	const allAgents = await getAllAgents();
	const providerConfig = getActiveProviderConfig(config);
	// Build a Map keyed by tool name once so per-agent tool lookups are O(1)
	// instead of O(n*m) via `allTools.find()`.
	const toolMap = new Map(allTools.map((tool) => [tool.name, tool]));

	return allAgents.map((agentDef) => {
		const filteredToolNames = getToolsForAgentTypes([agentDef.name], TOOLS);
		// Map tool names back to actual tool instances — SubAgent.specs
		// require StructuredTool[], not string names.
		const filteredTools = filteredToolNames.map((name) => toolMap.get(name)).filter(Boolean);

		// Get skills specific to this agent (metadata.agent === agentName)
		const agentSkills = skillRegistry.getSkillPathsForAgent(agentDef.name);

		// Determine per-agent temperature and reasoning effort from config
		const agentTemp = config.subAgentsTemperature?.[agentDef.name];
		const agentReasoning = config.subAgentsReasoning?.[agentDef.name];
		const overrides = buildSubAgentModelOverrides(agentTemp, agentReasoning);

		// Create a per-agent model instance when a specific temperature or
		// reasoning effort is configured. Overrides are merged onto the active
		// provider config so the model keeps its base URL, credentials, and
		// rate limits while applying the per-agent tuning.
		let agentModel = model;
		if (Object.keys(overrides).length > 0) {
			agentModel = createChatModel(
				{
					...providerConfig,
					...overrides,
				},
				{ memoryDir: resolve(config.cwd ?? ".", config.memory?.directory || "memory/") },
			);
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
			// deepagents does NOT propagate the orchestrator's custom middleware to
			// inline subagents — `buildSubagentMiddleware` merges only each spec's own
			// `middleware` (parent custom middleware reaches just the auto-injected
			// `general-purpose` subagent). Without this, every configured subagent
			// keeps deepagents' 20,000-token eviction default and destroys
			// `readImage` results before the model can see them.
			// A fresh instance per subagent mirrors the library's own per-subagent
			// `createSubagentDefaultMiddleware`.
			middleware: [createEvictionAwareFilesystemMiddleware({ backend, model: agentModel })],
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
export function toConversationExchange(message) {
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

	const exchange = { role, content: content ?? "" };
	if (type === "tool" && isCancelledToolMessage(message)) exchange.cancelled = true;
	return exchange;
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
 * @param {number} [options.keepRecent=5] - Number of recent messages to retain after trimming
 * @param {Object} [options.backend] - The deepagents backend used for history offload
 * @param {Object} [options.model] - The chat model used to generate the summary
 * @returns {Promise<{ok: boolean, removedVision: number, trimmed: number, remaining: number, error?: string}>}
 *   Result describing what was removed and trimmed
 */
export async function compactAgentContext(agent, config, sessionState, options = {}) {
	const keepRecent = options.keepRecent ?? KEEP_MESSAGES;
	const backend = options.backend;
	const model = options.model;

	let state;
	try {
		state = await agent.getState(config);
	} catch (err) {
		return { ok: false, removedVision: 0, trimmed: 0, remaining: 0, error: err.message };
	}

	// Compact what the model currently sees, not the raw checkpointer history
	// (the summarization middleware leaves `messages` untouched and tracks its
	// cutoff in `_summarizationEvent`).
	const messages = getEffectiveMessages(state?.values);
	if (messages.length === 0) {
		return { ok: true, removedVision: 0, trimmed: 0, remaining: 0 };
	}

	// Summarize everything but the last `keepRecent` messages into one summary
	// message. When the backend/model are unavailable, or summarization fails,
	// fall back to the legacy trim-only behavior.
	let summarized;
	if (model) {
		try {
			const result = await compactMessages({
				messages,
				model,
				backend,
				keep: keepRecent,
				threadId: config?.configurable?.thread_id,
			});
			summarized = result?.messages;
		} catch (err) {
			logger.warn({ error: err.message }, "[compact] summarization failed; falling back to trim");
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

	// Replace the checkpointer state with the compacted message set. A leading
	// summary is stored the way the summarization middleware expects it
	// (`_summarizationEvent` with cutoff 0) so the effective window is exactly
	// `finalMessages` and nothing is applied twice. The event channel cannot be
	// cleared, so a previous summary is carried over when one existed.
	const previousEvent = state?.values?._summarizationEvent;
	const isSummary = (m) =>
		m?.additional_kwargs?.madz_summary === true || m === previousEvent?.summaryMessage;
	const hasSummary = finalMessages.length > 0 && isSummary(finalMessages[0]);
	const summaryMessage = hasSummary ? finalMessages[0] : previousEvent?.summaryMessage;
	const rest = hasSummary ? finalMessages.slice(1) : finalMessages;
	try {
		await agent.updateState(
			config,
			{
				messages: [new RemoveMessage({ id: "__remove_all__" }), ...rest],
				...(summaryMessage && {
					_summarizationEvent: {
						cutoffIndex: 0,
						summaryMessage,
						filePath: previousEvent?.filePath ?? null,
					},
				}),
			},
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
 * Uses deepagents middleware for filesystem, memory, and skills.
 * @param {import("@langchain/langgraph").BaseCheckpointSaver | null} [checkpointer=null] - Optional checkpointer
 * @returns {Promise<{agent: Object, model: Object}>} The orchestrator agent and its chat model
 */
export async function createDeepAgentsOrchestrator(checkpointer = null) {
	const config = loadConfig();
	let systemPrompt = await loadSystemPrompt();

	// Discover skills from configured scopes
	const skillRegistry = new SkillRegistry();
	await skillRegistry.discover();
	const skillPaths = skillRegistry.getSkillPaths();

	// Create model from config
	const providerName = getActiveProviderName(config);
	const providerConfig = getActiveProviderConfig(config);
	if (!providerName) {
		throw new Error("No enabled provider found: configure and enable a provider in `providers`");
	}
	const memoryDir = resolve(config.cwd ?? ".", config.memory?.directory || "memory/");
	// For GitHub Copilot, resolve the configured model against the tenant's
	// available models (best-effort; falls back to the configured string).
	if (providerConfig.type === "github-copilot") {
		providerConfig.model = await resolveCopilotModel(providerConfig, { memoryDir });
	}
	const model = createChatModel(providerConfig, { memoryDir });

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
		registry: skillRegistry,
		sessionsDir: join(config.cwd, config.memory.sessionsDir),
		contextDir: join(config.cwd, config.memory.contextDir),
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

	// Composite backend shared by the orchestrator, the summarization middleware
	// (which offloads conversation history to it), and the subagent filesystem
	// middleware built below — deepagents binds each subagent's filesystem tools
	// and eviction writes to the same backend the agent uses.
	const backend = new CompositeBackend(coreBackend, {
		[contextRoute]: contextBackend,
	});

	// Create subagent definitions with filtered tools and agent-specific skills
	const subagentDefinitions = await createSubagentDefinitions(
		allTools,
		model,
		skillRegistry,
		config,
		backend,
	);

	// All discovered skills are available to the orchestrator

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
				return compactOnContextWindowExceeded(err, request);
			}
		},
	});

	// Resolve the model's real context length at init. If it cannot be resolved
	// (unreachable, model not found, field absent) startup continues and the
	// configured context window is used.
	const contextLength = await getModelContextLength(providerConfig, { memoryDir });
	// Mutate the shared config singleton so the server-derived context window is
	// visible everywhere it is read (e.g. the /settings view and the TUI
	// status-bar context meter). `loadConfig()` is cached, so this is the same
	// object the SettingsPanel reads.
	if (contextLength !== undefined) {
		// Update the active provider's context window so the TUI status bar
		// spinner reflects the real model context length rather than the
		// configured default. `providerName` is the config key (e.g. "openai").
		if (config.providers?.[providerName]) {
			config.providers[providerName].contextWindow = contextLength;
		}
	}

	// Copilot 403 retry middleware. Registered LAST so it is innermost and
	// retries the raw model call. Only wired for GitHub Copilot connections,
	// which signal rate limiting with 403 (the OpenAI SDK only retries
	// 408/409/429/>=500, so a Copilot 403 would otherwise pass through).
	const copilotRetryMiddleware =
		providerConfig.type === "github-copilot"
			? createCopilotRetryMiddleware({ maxRetries: 3 })
			: null;

	// Replacement for deepagents' FilesystemMiddleware with an eviction ceiling
	// fixed to fit image payloads. The library evicts any ToolMessage whose
	// stringified content exceeds `toolTokenLimitBeforeEvict * 4` characters
	// (default 20,000 tokens -> 80,000 chars), which destroys `readImage`'s
	// base64 JSON before the model can see it.
	// Displaces the library default via same-name merge in `mergeMiddlewareStack`.
	// The name is asserted in tests: if it drifts, a second copy stacks and the
	// bug survives while looking fixed.
	const filesystemMiddleware = createEvictionAwareFilesystemMiddleware({
		backend,
		permissions: [],
		model,
	});

	// Summarization middleware: compacts the conversation when the context
	// reaches `contextFraction` of the resolved context window. The trigger is
	// expressed in tokens because the model instance does not expose
	// `profile.maxInputTokens` (which the fraction trigger requires); the
	// resolved context length is the authoritative window. When the window
	// cannot be resolved, the middleware falls back to the library's
	// model-profile defaults.
	const contextFraction = config.summarization?.contextFraction ?? 0.8;
	const keepMessages = config.summarization?.keepMessages;
	const summarizationMiddleware = createSummarizationMiddleware({
		model,
		backend,
		...(contextLength > 0
			? { trigger: { type: "tokens", value: Math.floor(contextLength * contextFraction) } }
			: {}),
		keep: { type: "messages", value: keepMessages },
	});

	const agent = createDeepAgent({
		model,
		tools: orchestratorTools,
		systemPrompt,
		generalPurposeAgent: false,
		store: new InMemoryStore(),
		backend,
		subagents: subagentDefinitions,
		...(skillPaths.length > 0 && { skills: skillPaths }),
		...(checkpointer && { checkpointer }),
		middleware: [
			filesystemMiddleware,
			createCodeInterpreterMiddleware(),
			...(skillPaths.length > 0
				? [createSkillsMiddleware({ registry: skillRegistry, sources: skillPaths })]
				: []),
			summarizationMiddleware,
			...(copilotRetryMiddleware ? [copilotRetryMiddleware] : []),
			...(tokenBudgetMiddleware ? [tokenBudgetMiddleware] : []),
		],
		streamTransformers: [() => createTurnTransformer()],
	});

	// Expose a compaction path so the TUI can manually compress the context
	// window on demand. The callback is bound to the agent instance and accepts
	// a LangGraph runnable config (with `thread_id`), an optional session state
	// manager to sync, plus optional options.
	agent.compactContext = async (runnableConfig, sessionState, options) =>
		compactAgentContext(agent, runnableConfig, sessionState, {
			keepRecent: keepMessages,
			...options,
			backend,
			model,
		});

	// Wire the middleware's 400 context-window handler. It runs inside a graph
	// step, so it compacts the request in memory and hands back the matching
	// `_summarizationEvent` for the middleware to persist via a `Command`;
	// `updateState` from here would be overwritten when the step commits.
	compactOnContextWindowExceeded = async (err, request) =>
		compactRequest(request, {
			model,
			backend,
			keep: keepMessages,
			threadId: request?.runtime?.configurable?.thread_id,
		});

	// Expose the MCP adapter (if any) so the caller can close it on shutdown.
	// `allTools` is an array with the adapter attached as a property when MCP
	// servers are configured.
	const mcpAdapter = allTools.mcpAdapter;

	// Expose the resolved model context length so the caller can propagate it to
	// the TUI explicitly (e.g. the status-bar context window) instead of the
	// orchestrator mutating the shared config singleton. `undefined` when the
	// context length could not be resolved.
	return { agent, model, systemPrompt, mcpAdapter, contextLength };
}
