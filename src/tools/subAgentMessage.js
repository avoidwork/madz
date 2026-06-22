import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { processTracker } from "./terminal.js";

/**
 * Send a message to a subAgent process via stdin.
 * @param {z.infer<typeof SubAgentMessageSchema>} input
 * @returns {Promise<string>} Result of the write operation
 */
export async function subAgentMessageImpl(input) {
	const { pid, message } = input;

	if (pid === undefined || pid === null) {
		return JSON.stringify({
			ok: false,
			error: "PID is required",
		});
	}

	if (message === undefined || message === null) {
		return JSON.stringify({
			ok: false,
			error: "Message is required",
		});
	}

	const entry = processTracker.get(pid);
	if (!entry) {
		return JSON.stringify({
			ok: false,
			error: `Process ${pid} not found in tracker`,
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
			pid,
			messageSent: true,
		});
	} catch (err) {
		return JSON.stringify({
			ok: false,
			error: `Failed to write to process ${pid}: ${err.message}`,
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
				.describe("Process ID of the subAgent to send the message to"),
			message: z
				.string()
				.describe("Message to send to the subAgent process stdin"),
		}),
	});
}