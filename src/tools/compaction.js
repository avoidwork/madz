import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { readFileSync } from "node:fs";
import { loadConfig } from "../config/loader.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const COMPACTION_MARKER = "# Compaction";

// Load the compaction prompt template once at module load time
const cwd = loadConfig().cwd;
const compactionTemplatePath = join(cwd, "prompts", "COMPACTION.md");
const compactionTemplate = readFileSync(compactionTemplatePath, "utf-8").trim();
const compactionTemplateEscaped = compactionTemplate.replace(/\n/g, "\\n");

/**
 * Split stdout on the compaction marker and return the content after it.
 * @param {string} stdout - Raw stdout from the spawned process
 * @returns {{ ok: boolean, summary: string, error?: string }}
 */
export function parseCompactionOutput(stdout) {
	if (!stdout || typeof stdout !== "string") {
		return {
			ok: false,
			summary: "",
			error: "No output received from compaction process",
		};
	}

	const parts = stdout.split(COMPACTION_MARKER);
	if (parts.length < 2) {
		return {
			ok: false,
			summary: "",
			error: `Compaction marker "${COMPACTION_MARKER}" not found in output`,
		};
	}

	// Take index[1] — everything after the first marker occurrence
	const summary = parts[1].trim();

	if (!summary) {
		return {
			ok: false,
			summary: "",
			error: `Compaction marker found but no summary content after it`,
		};
	}

	return {
		ok: true,
		summary: `${COMPACTION_MARKER}\n\n${summary}`,
	};
}

/**
 * Spawn a node process to run the compaction script.
 * @param {string} command - The command string to pass to the script
 * @param {string} sessionsDir - Path to sessions directory
 * @returns {Promise<{ ok: boolean, summary: string, error?: string }>}
 */
function spawnCompactionProcess(command, sessionsDir) {
	return new Promise((resolve) => {
		const indexPath = join(cwd, "index.js");

		const child = spawn("node", [indexPath, `"${command}"`, sessionsDir], {
			timeout: 60000,
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";

		child.stdout.on("data", (data) => {
			stdout += data.toString();
		});

		child.stderr.on("data", (data) => {
			stderr += data.toString();
		});

		child.on("exit", (_code) => {
			const parsed = parseCompactionOutput(stdout);
			if (!parsed.ok) {
				parsed.error = `${parsed.error}${stderr ? ` | stderr: ${stderr.trim()}` : ""}`;
			}
			resolve(parsed);
		});

		child.on("error", (err) => {
			resolve({
				ok: false,
				summary: "",
				error: `Process spawn error: ${err.message}`,
			});
		});
	});
}

/**
 * Compaction tool implementation for LangChain.
 * Spawns a node process to produce a semantic summarization of the current session.
 *
 * @param {Object} options - Runtime options
 * @param {string} [options.sessionsDir] - Path to sessions directory
 * @returns {object} LangChain tool instance
 */
export function createCompactionTool(options = {}) {
	const { sessionsDir = "./memory/sessions/" } = options;

	return tool(
		async (input) => {
			try {
				const { threadID, maxMessages } = input;

				// Build the command string for the compaction script
				let command = `read ${sessionsDir}${threadID}.md and produce a summarization, structured as: ${compactionTemplateEscaped}`;

				if (maxMessages) {
					command += `\nLimit to ${maxMessages} messages`;
				}

				// Spawn the process
				const result = await spawnCompactionProcess(command, sessionsDir);

				return JSON.stringify(result);
			} catch (err) {
				return JSON.stringify({
					ok: false,
					summary: "",
					error: `Compaction error: ${err.message}`,
				});
			}
		},
		{
			name: "compaction",
			description:
				"Generate a semantic summarization of the current session — distilling conversation history into core decisions, key design points, open questions, and next steps. Unlike compactContext (which is a mechanical context-window reducer), this tool produces a curated, human-readable summary suitable for passing to sub-agents or for session archival. Return the result exactly as generated, without modification or formatting.",
			schema: z.object({
				threadID: z
					.string()
					.optional()
					.describe(
						"Session identifier. Defaults to the current session's threadId when omitted.",
					),
				maxMessages: z
					.number()
					.int()
					.positive()
					.optional()
					.describe("Maximum number of messages to include in the summary"),
			}),
		},
	);
}