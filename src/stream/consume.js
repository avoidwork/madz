import { surfaceInterrupt } from "./interrupt.js";
import { isSubagentNamespace } from "./namespace.js";

/**
 * Extract the stable per-subagent id from a subagent-scoped namespace. A subagent
 * run is nested under a `tools:<id>` segment, so the id is the text after the
 * `tools:` prefix of the first matching segment. Used to key subagent reasoning
 * in the loop detector so concurrent subagents never share detector state.
 * @param {unknown} namespace - The namespace from a `[namespace, mode, payload]` stream tuple.
 * @returns {string | undefined} The subagent id, or undefined when not subagent-scoped.
 */
function subagentId(namespace) {
	if (!Array.isArray(namespace)) return undefined;
	for (const part of namespace) {
		if (typeof part === "string" && part.startsWith("tools:")) return part.slice("tools:".length);
	}
	return undefined;
}

/**
 * Consume an agent stream, forwarding events to `streamingCallback` and
 * collecting the orchestrator's own text and reasoning.
 *
 * Tracks the last non-subagent event type forwarded to the callback so the
 * TUI can detect a turn that ended on reasoning or a tool message (the model
 * produced no final message content) and nudge it with a silent "Continue".
 *
 * @param {AsyncIterable} stream - The agent stream (subgraphs mode)
 * @param {Function} [streamingCallback] - Callback for streamed chunks
 * @param {Object} [options] - Options
 * @param {boolean} [options.showToolResults=true] - Whether to emit `tool` events
 * @param {boolean} [options.silent=false] - Silent mode (`agent.silent`). When a second
 *   text-bearing assistant message starts while the turn is still streaming, the stream is
 *   abandoned before that text is forwarded and `silentViolation` is returned true.
 * @param {boolean} [options.subagent=true] - Whether loop detection also applies to
 *   subagent reasoning and message streams. When false, subagent reasoning and
 *   message text are not fed to the detector.
 * @param {{push: Function, settle?: Function, reset: Function}} [options.loopDetector] - Loop
 *   detector. Each non-subagent message/reasoning delta is pushed to it together with
 *   the stream block's id (the content-block index for messages, `block.id` for
 *   Responses API reasoning), so detection is restricted to one block and concurrent
 *   blocks never mix. Chat Completions `reasoning_content` carries no id. When it
 *   flags a loop the stream is abandoned (closing the underlying iterator) and
 *   `loopDetected` is returned true. Checks run in a worker, so a loop can be
 *   flagged after the stream ends; `settle()` is awaited to collect it. When a
 *   message turn ends (its last chunk carries a `finish_reason`, a different message
 *   id arrives, or a tool result follows) `end()` collects the verdict and releases
 *   the detector's word and sentence lists. The detector is also reset when the
 *   stream itself ends, however it ends.
 * @returns {Promise<{content: string, reasoning: string, interrupted: boolean, lastEventType: string | null, loopDetected: boolean, silentViolation: boolean}>}
 */
export async function consumeStream(stream, streamingCallback, options = {}) {
	try {
		return await drainStream(stream, streamingCallback, options);
	} finally {
		// The turn is over (finished, interrupted, abandoned on a loop, or thrown):
		// release the detector's lists so nothing from this turn is retained.
		options.loopDetector?.reset();
	}
}

/**
 * Drain the agent stream. See `consumeStream`.
 * @param {AsyncIterable} stream - The agent stream (subgraphs mode)
 * @param {Function} [streamingCallback] - Callback for streamed chunks
 * @param {Object} options - Options
 * @returns {Promise<{content: string, reasoning: string, interrupted: boolean, lastEventType: string | null, loopDetected: boolean, silentViolation: boolean}>}
 */
async function drainStream(stream, streamingCallback, options) {
	const showToolResults = options.showToolResults;
	const includeSubagent = options.subagent !== false;
	let content = "";
	let reasoning = "";
	let interrupted = false;
	let lastEventType = null;
	let loopDetected = false;
	let silentViolation = false;
	/** Id of the last assistant message that carried text, and how many have. */
	let lastTextMsgId = null;
	let textMessageCount = 0;
	const loopDetector = options.loopDetector;
	/** The id shared by the chunks of the message currently streaming. */
	let currentMsgId = null;
	/** The id of the subagent message currently streaming, tracked separately so it
	 * never interferes with the orchestrator's own message-end detection. */
	let currentSubagentMsgId = null;

	// A message turn is start, stream, end. When it ends, collect the verdict of
	// any worker check still running and release the detector's lists.
	const endMessage = async () => {
		currentMsgId = null;
		if (loopDetector?.end && (await loopDetector.end())) loopDetected = true;
	};

	// A subagent's reasoning turn is keyed by its namespace id. When it ends,
	// release that stream's state so it does not leak into the next turn, without
	// disturbing the orchestrator's own streams.
	const endSubagentMessage = (namespace) => {
		const id = subagentId(namespace);
		if (loopDetector?.release && id != null) loopDetector.release("reasoning", id);
	};

	for await (const [namespace, mode, payload] of stream) {
		// Subagent runs are nested under a `tools:<id>` namespace segment. Their
		// events get a `subagent_` prefix so the TUI routes them separately.
		const isSubagent = isSubagentNamespace(namespace);

		// A human-in-the-loop interrupt (e.g. `clarify`) pauses the agent; stop
		// consuming so the caller can ask the question and resume.
		if (surfaceInterrupt(mode, payload, streamingCallback)) {
			interrupted = true;
			break;
		}

		if (mode === "messages") {
			const [msg] = payload;
			const msgType = msg?._getType ? msg._getType() : msg?.type;
			const text = msg?.text ?? "";

			// Human messages are inputs or injected nudges (e.g. the loop-detection
			// "You're looping" nudge), not assistant output. Skip them so they are
			// never rendered into the assistant's streaming bubble.
			if (msgType === "human") continue;

			if (!isSubagent) {
				// A different message id means the previous message's turn has ended.
				if (msg?.id != null && currentMsgId != null && msg.id !== currentMsgId) await endMessage();
				if (msg?.id != null) currentMsgId = msg.id;
				// A tool result means the AI message that called the tool has ended.
				if (msgType === "tool") await endMessage();
			} else if (includeSubagent) {
				// A subagent's reasoning turn ends when a different message id arrives
				// or a finish reason is carried; release its detector state then.
				if (msg?.id != null && currentSubagentMsgId != null && msg.id !== currentSubagentMsgId)
					endSubagentMessage(namespace);
				if (msg?.id != null) currentSubagentMsgId = msg.id;
			}

			if (text) {
				// ToolMessage text is emitted as a distinct `tool` event, never
				// folded into the message segment.
				if (msgType === "tool") {
					if (showToolResults !== false && streamingCallback) {
						streamingCallback({
							type: isSubagent ? "subagent_tool" : "tool",
							text,
							name: msg?.name,
							namespace,
						});
					}
					if (!isSubagent) lastEventType = "tool";
					continue;
				}

				// Silent mode: a second text-bearing message in the same turn means the
				// assistant is narrating. Stop before its text reaches the bubble.
				if (options.silent && !isSubagent && currentMsgId != null) {
					if (currentMsgId !== lastTextMsgId) {
						lastTextMsgId = currentMsgId;
						textMessageCount += 1;
					}
					if (textMessageCount >= 2) {
						silentViolation = true;
						break;
					}
				}

				if (!isSubagent) {
					content += text;
					const blockIndex = msg?.content?.[0]?.index;
					if (loopDetector?.push("message", text, blockIndex)) loopDetected = true;
				} else if (includeSubagent) {
					// Subagent message text is keyed per subagent so concurrent subagents
					// never share detector state, mirroring subagent reasoning.
					if (loopDetector?.push("message", text, subagentId(namespace))) loopDetected = true;
				}

				if (streamingCallback) {
					streamingCallback({
						type: isSubagent ? "subagent_message" : "message",
						text,
						namespace,
						// The content-block index is the stable identifier for a streamed
						// text block; it is normalized to `id` downstream.
						...(msg?.content?.[0]?.index != null ? { index: msg.content[0].index } : {}),
					});
				}
				if (!isSubagent) lastEventType = "message";
			}

			// Reasoning from additional_kwargs (Chat Completions API)
			const reasoningContent =
				msg?.additional_kwargs?.reasoning_content ?? msg?.additional_kwargs?.reasoning;
			if (reasoningContent) {
				if (!isSubagent) {
					reasoning += reasoningContent;
					if (loopDetector?.push("reasoning", reasoningContent)) loopDetected = true;
				} else if (includeSubagent) {
					// Subagent reasoning is keyed per subagent so concurrent subagents
					// never share detector state.
					if (loopDetector?.push("reasoning", reasoningContent, subagentId(namespace)))
						loopDetected = true;
				}
				if (streamingCallback) {
					streamingCallback({
						type: isSubagent ? "subagent_reasoning" : "reasoning",
						text: reasoningContent,
						namespace,
					});
				}
				if (!isSubagent) lastEventType = "reasoning";
			} else if (Array.isArray(msg?.content)) {
				// Reasoning from content blocks (Responses API). Skipped when
				// additional_kwargs already supplied it, to avoid double-counting.
				for (const block of msg.content) {
					if (block?.type === "reasoning" && block.reasoning) {
						if (!isSubagent) {
							reasoning += block.reasoning;
							if (loopDetector?.push("reasoning", block.reasoning, block.id)) loopDetected = true;
						} else if (includeSubagent) {
							// Subagent reasoning is keyed per subagent so concurrent subagents
							// never share detector state.
							if (loopDetector?.push("reasoning", block.reasoning, subagentId(namespace)))
								loopDetected = true;
						}
						if (streamingCallback) {
							streamingCallback({
								type: isSubagent ? "subagent_reasoning" : "reasoning",
								text: block.reasoning,
								id: block.id,
								namespace,
							});
						}
						if (!isSubagent) lastEventType = "reasoning";
					}
				}
			}
			// The chunk that carries a finish reason is the last of its message.
			if (!isSubagent && msg?.response_metadata?.finish_reason) await endMessage();
			if (isSubagent && includeSubagent && msg?.response_metadata?.finish_reason)
				endSubagentMessage(namespace);
		} else if (mode === "tools" && streamingCallback) {
			if (payload?.event === "on_tool_start") {
				streamingCallback({
					type: isSubagent ? "subagent_tool_start" : "on_tool_start",
					name: payload.name,
					data: { input: payload.input },
					namespace,
				});
				if (!isSubagent) lastEventType = "on_tool_start";
			}
			if (payload?.event === "on_tool_end") {
				streamingCallback({
					type: isSubagent ? "subagent_tool_end" : "on_tool_end",
					name: payload.name,
					data: { output: payload.output },
					namespace,
				});
				if (!isSubagent) lastEventType = "on_tool_end";
			}
		}

		// Abandon the stream; leaving the for-await closes the iterator.
		if (loopDetected) break;
	}

	// Worker checks may still be in flight when the stream ends; collect them so
	// a loop in the final deltas is not missed.
	if (!loopDetected && loopDetector?.settle) loopDetected = await loopDetector.settle();

	return { content, reasoning, interrupted, lastEventType, loopDetected, silentViolation };
}
