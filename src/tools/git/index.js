import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { execFile } from "node:child_process";

const VALID_ACTIONS = [
	"status",
	"diff",
	"log",
	"branch",
	"add",
	"commit",
	"push",
	"checkout",
	"merge",
	"rebase",
	"stash",
	"show",
	"tag",
];

/**
 * Actions that require an explicit `force: true` opt-in before they may run.
 * These are destructive or history-rewriting operations that must never be
 * invoked implicitly.
 * @type {string[]}
 */
const FORCE_ACTIONS = ["push", "rebase"];

/**
 * Execute a git command with args passed as an array (never a shell string).
 * @param {string[]} args - Git arguments
 * @param {string} [cwd] - Working directory for the git process
 * @returns {Promise<{ code: number, stdout: string, stderr: string }>}
 */
function runGit(args, cwd) {
	return new Promise((resolve) => {
		execFile("git", args, { cwd, encoding: "utf-8" }, (err, stdout, stderr) => {
			if (err) {
				resolve({ code: err.code ?? 1, stdout: stdout || "", stderr: stderr || err.message });
			} else {
				resolve({ code: 0, stdout: stdout || "", stderr: stderr || "" });
			}
		});
	});
}

/**
 * Parse `git status --porcelain` output into a structured changes array.
 * @param {string} output - Raw porcelain status output
 * @returns {Array<{ path: string, status: string }>}
 */
function parseStatus(output) {
	return output
		.split("\n")
		.filter((line) => line.trim() !== "")
		.map((line) => ({
			path: line.slice(3).trim(),
			status: line.slice(0, 2).trim(),
		}));
}

/**
 * Parse `git diff --numstat` output into additions/deletions counts.
 * @param {string} output - Raw numstat output
 * @returns {{ files: string[], additions: number, deletions: number }}
 */
function parseDiff(output) {
	let additions = 0;
	let deletions = 0;
	const files = [];
	for (const line of output.split("\n")) {
		if (line.trim() === "") continue;
		const parts = line.split("\t");
		if (parts.length >= 3) {
			const a = parseInt(parts[0], 10);
			const d = parseInt(parts[1], 10);
			if (!Number.isNaN(a)) additions += a;
			if (!Number.isNaN(d)) deletions += d;
			files.push(parts[2]);
		}
	}
	return { files, additions, deletions };
}

/**
 * Parse `git log --oneline` output into a commits array.
 * @param {string} output - Raw log output
 * @returns {Array<{ hash: string, message: string }>}
 */
function parseLog(output) {
	return output
		.split("\n")
		.filter((line) => line.trim() !== "")
		.map((line) => {
			const idx = line.indexOf(" ");
			if (idx === -1) return { hash: line, message: "" };
			return { hash: line.slice(0, idx), message: line.slice(idx + 1) };
		});
}

/**
 * Parse `git branch` output into a branches array and current branch.
 * @param {string} output - Raw branch output
 * @returns {{ branches: string[], current: string | null }}
 */
function parseBranches(output) {
	const branches = [];
	let current = null;
	for (const line of output.split("\n")) {
		if (line.trim() === "") continue;
		const isCurrent = line.startsWith("*");
		const name = line.replace(/^\*\s+/, "").trim();
		branches.push(name);
		if (isCurrent) current = name;
	}
	return { branches, current };
}

/**
 * Parse `git tag` output into a tags array.
 * @param {string} output - Raw tag output
 * @returns {string[]}
 */
function parseTags(output) {
	return output.split("\n").filter((line) => line.trim() !== "");
}

/**
 * Core git tool logic implementing all 13 actions with guardrails.
 * @param {object} input - The tool input
 * @param {object} [options] - Runtime options
 * @param {string} [options.cwd] - Working directory for git commands
 * @returns {Promise<object>} Result of the operation
 */
export async function gitImpl(input, options = {}) {
	const { action } = input;
	const cwd = options.cwd;

	if (!VALID_ACTIONS.includes(action)) {
		return {
			ok: false,
			error: `Unknown action: '${action}'. Valid actions: ${VALID_ACTIONS.join(", ")}`,
		};
	}

	// Guardrail: destructive/force actions require explicit opt-in.
	if (FORCE_ACTIONS.includes(action) && input.force !== true) {
		return {
			ok: false,
			error: `Action '${action}' is destructive and requires force: true to proceed`,
		};
	}

	switch (action) {
		case "status": {
			const res = await runGit(["status", "--porcelain", "--branch"], cwd);
			if (res.code !== 0) {
				return { ok: false, error: res.stderr.trim() || res.stdout.trim() };
			}
			const lines = res.stdout.split("\n");
			const branchLine = lines.find((l) => l.startsWith("##")) || "";
			const branch = branchLine
				.replace(/^##\s+/, "")
				.split("...")[0]
				.trim();
			const aheadMatch = branchLine.match(/ahead (\d+)/);
			const behindMatch = branchLine.match(/behind (\d+)/);
			const changes = parseStatus(lines.filter((l) => !l.startsWith("##")).join("\n"));
			return {
				ok: true,
				branch,
				changes,
				ahead: aheadMatch ? parseInt(aheadMatch[1], 10) : 0,
				behind: behindMatch ? parseInt(behindMatch[1], 10) : 0,
			};
		}

		case "diff": {
			const res = await runGit(["diff", "--numstat"], cwd);
			if (res.code !== 0) {
				return { ok: false, error: res.stderr.trim() || res.stdout.trim() };
			}
			const { files, additions, deletions } = parseDiff(res.stdout);
			return { ok: true, files, additions, deletions };
		}

		case "log": {
			const limit = input.limit || 20;
			const res = await runGit(["log", "--oneline", `-${limit}`], cwd);
			if (res.code !== 0) {
				return { ok: false, error: res.stderr.trim() || res.stdout.trim() };
			}
			return { ok: true, commits: parseLog(res.stdout) };
		}

		case "branch": {
			const res = await runGit(["branch"], cwd);
			if (res.code !== 0) {
				return { ok: false, error: res.stderr.trim() || res.stdout.trim() };
			}
			const { branches, current } = parseBranches(res.stdout);
			return { ok: true, branches, current };
		}

		case "add": {
			const path = input.path || ".";
			const res = await runGit(["add", path], cwd);
			if (res.code !== 0) {
				return { ok: false, error: res.stderr.trim() || res.stdout.trim() };
			}
			return { ok: true, files: [path] };
		}

		case "commit": {
			if (!input.message) {
				return { ok: false, error: "commit requires a message" };
			}
			const res = await runGit(["commit", "-m", input.message], cwd);
			if (res.code !== 0) {
				return { ok: false, error: res.stderr.trim() || res.stdout.trim() };
			}
			const hash = res.stdout.match(/\[[^\]]+\s+([a-f0-9]+)/)?.[1] || "";
			return { ok: true, hash, message: input.message };
		}

		case "push": {
			const remote = input.remote || "origin";
			const branch = input.branch || "HEAD";
			const res = await runGit(["push", remote, branch], cwd);
			if (res.code !== 0) {
				return { ok: false, error: res.stderr.trim() || res.stdout.trim() };
			}
			return { ok: true, remote, branch };
		}

		case "checkout": {
			if (!input.branch) {
				return { ok: false, error: "checkout requires a branch" };
			}
			const res = await runGit(["checkout", input.branch], cwd);
			if (res.code !== 0) {
				return { ok: false, error: res.stderr.trim() || res.stdout.trim() };
			}
			return { ok: true, branch: input.branch };
		}

		case "merge": {
			if (!input.branch) {
				return { ok: false, error: "merge requires a branch" };
			}
			const res = await runGit(["merge", input.branch], cwd);
			if (res.code !== 0) {
				return { ok: false, error: res.stderr.trim() || res.stdout.trim() };
			}
			return { ok: true, branch: input.branch };
		}

		case "rebase": {
			if (!input.branch) {
				return { ok: false, error: "rebase requires a branch" };
			}
			const res = await runGit(["rebase", input.branch], cwd);
			if (res.code !== 0) {
				return { ok: false, error: res.stderr.trim() || res.stdout.trim() };
			}
			return { ok: true, branch: input.branch };
		}

		case "stash": {
			const res = await runGit(["stash"], cwd);
			if (res.code !== 0) {
				return { ok: false, error: res.stderr.trim() || res.stdout.trim() };
			}
			return { ok: true };
		}

		case "show": {
			const ref = input.ref || "HEAD";
			const res = await runGit(["show", ref], cwd);
			if (res.code !== 0) {
				return { ok: false, error: res.stderr.trim() || res.stdout.trim() };
			}
			return { ok: true, ref, output: res.stdout };
		}

		case "tag": {
			const res = await runGit(["tag"], cwd);
			if (res.code !== 0) {
				return { ok: false, error: res.stderr.trim() || res.stdout.trim() };
			}
			return { ok: true, tags: parseTags(res.stdout) };
		}

		default:
			return {
				ok: false,
				error: `Unknown action: '${action}'. Valid actions: ${VALID_ACTIONS.join(", ")}`,
			};
	}
}

/**
 * First-class git tool with guardrails. Wraps common git operations (status,
 * diff, log, branch, add, commit, push, checkout, merge, rebase, stash, show,
 * tag) so madz can perform git work safely and consistently instead of
 * shelling out through the process tool. Uses execFile("git", [args]) so args
 * are passed as an array and never interpreted by a shell.
 */
export const git = tool((input, options = {}) => gitImpl(input, options), {
	name: "git",
	description:
		"Git tool with guardrails. Actions: status, diff, log, branch, add, commit, push, checkout, merge, rebase, stash, show, tag. Destructive actions (push, rebase) require force: true. Uses execFile('git', [args]) — never sh -c.",
	schema: z.object({
		action: z
			.enum(VALID_ACTIONS)
			.describe(
				"Action to perform (status, diff, log, branch, add, commit, push, checkout, merge, rebase, stash, show, tag)",
			),
		path: z.string().optional().describe("Path for status/diff/add actions"),
		message: z.string().optional().describe("Commit message for commit action"),
		branch: z.string().optional().describe("Branch for checkout/branch/merge/rebase/push actions"),
		remote: z.string().optional().describe("Remote for push action"),
		ref: z.string().optional().describe("Ref for show action"),
		limit: z.number().int().positive().optional().describe("Limit for log action"),
		force: z
			.boolean()
			.optional()
			.describe("Set to true to allow destructive actions (push, rebase)"),
	}),
});
