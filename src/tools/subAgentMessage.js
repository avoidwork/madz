import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { processTracker } from "./terminal.js";

/**
 * Send a message to a subAgent process via stdin.
 * @param {z.infer<typeof SubAgentMessageSchema>} input
 * @returns {Promise<string>} Result of the write operation
 */
export async function subAgentMessageImpl(input) {
	const { pid, sessionId, message } = input;

	if (pid === undefined && sessionId === undefined) {
		return JSON.stringify({
			ok: false,
			error: "PID or sessionId is required",
		});
	}

	if (message === undefined || message === null) {
		return JSON.stringify({
			ok: false,
			error: "Message is required",
		});
	}

	// Look up by sessionId first, fall back to pid for backward compatibility
	let entry = null;
	if (sessionId !== undefined) {
		for (const [, e] of processTracker) {
			if (e.sessionId === sessionId) {
				entry = e;
				break;
			}
		}
	}
	if (!entry && pid !== undefined) {
		entry = processTracker.get(pid);
	}

	if (!entry) {
		const id = sessionId !== undefined ? sessionId : pid;
		return JSON.stringify({
			ok: false,
			error: `Process ${id} not found in tracker`,
		});
	}

	if (entry.status === "exited" || entry.status === "error") {
		return JSON.stringify({
			ok: false,
			error: `Process ${pid} is not running (status: ${entry.status})`,
		});
	}

	try {
		entry.child.stdin.write(message + "\n");
		return JSON.stringify({
			ok: true,
			pid: entry.pid,
			sessionId: entry.sessionId,
			messageSent: true,
		});
	} catch (err) {
		return JSON.stringify({
			ok: false,
			error: `Failed to write to process ${entry.pid}: ${err.message}`,
		});
	}
}

/**
 * Create a subAgentMessage tool for sending messages to subAgent processes via stdin.
 * @returns {object} LangChain Tool instance
 */
export function createSubAgentMessageTool() {
	return tool(subAgentMessageImpl, {
		name: "subAgentMessage",
		description:
			"Send a message to a running subAgent process via stdin. The target process must be tracked (spawned via subAgent tool) and have stdin exposed. Returns success/failure status.",
		schema: z.object({
			pid: z
				.number()
				.int()
				.positive()
				.optional()
				.describe(
					"Process ID of the subAgent to send the message to (required if sessionId not provided)",
				),
			sessionId: z
				.string()
				.optional()
				.describe("Session ID of the subAgent to send the message to (alternative to pid)"),
			message: z.string().describe("Message to send to the subAgent process stdin"),
		}),
	});
}
