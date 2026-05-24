import { loadContext } from "../memory/context.js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Execute a scheduled skill within the sandbox with inherited memory context.
 * @param {Object} schedule - The parsed schedule entry
 * @param {Object} sandbox - The sandbox runner
 * @param {Object} [sessionState] - Current session state
 * @returns {Promise<{ stdout: string, stderr: string, exitCode: number }>}
 */
export async function runScheduledSkill(schedule, sandbox, sessionState = {}) {
  const { name, skill, input, contextFile } = schedule;

  // Load context file if specified
  let contextPrefix = "";
  if (contextFile && existsSync(contextFile)) {
    contextPrefix = readFileSync(contextFile, "utf-8");
  } else if (contextFile) {
    // Try loading from memory/context
    contextPrefix = loadContext("memory/context/");
  }

  // Run skill through sandbox
  const result = await sandbox({
    skillName: skill,
    input,
    context: contextPrefix,
    permissions: sessionState.skills || [],
  });

  return result;
}
