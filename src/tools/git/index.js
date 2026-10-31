import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { execFile } from "node:child_process";
import path from "node:path";
import { loadConfig } from "../../config/loader.js";
import { getProjectCwd } from "../../workspace/project.js";

const config = loadConfig();

const VALID_ACTIONS = [
	"status",
	"diff",
	"log",
	"branch",
	"add",
	"commit",
	"push",
	"pull",
	"checkout",
	"merge",
	"rebase",
	"stash",
	"show",
	"tag",
	"worktree",
	"remote",
	"rev-parse",
	"ls-remote",
	"fetch",
	"describe",
];

/**
 * Safe flags accepted by the `rev-parse` action. Free-form args are never
 * passed to git; only these enumerated flags (plus an optional ref) are.
 * @type {string[]}
 */
const REV_PARSE_FLAGS = [
	"--show-toplevel",
	"--show-prefix",
	"--is-inside-work-tree",
	"--abbrev-ref",
	"--short",
];

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
 * Parse `git worktree list` output into a worktrees array.
 * @param {string} output - Raw worktree list output
 * @returns {Array<{ path: string, hash: string, branch: string | null }>}
 */
function parseWorktrees(output) {
	return output
		.split("\n")
		.filter((line) => line.trim() !== "")
		.map((line) => {
			const parts = line.trim().split(/\s+/);
			const path = parts[0];
			const hash = parts[1] || "";
			const branchMatch = line.match(/\[([^\]]+)\]/);
			const branch = branchMatch ? branchMatch[1] : null;
			return { path, hash, branch };
		});
}

/**
 * Parse `git ls-remote` output into a refs array.
 * @param {string} output - Raw ls-remote output
 * @returns {Array<{ hash: string, ref: string }>}
 */
function parseRefs(output) {
	return output
		.split("\n")
		.filter((line) => line.trim() !== "")
		.map((line) => {
			const idx = line.indexOf("\t");
			if (idx === -1) return { hash: line.trim(), ref: "" };
			return { hash: line.slice(0, idx).trim(), ref: line.slice(idx + 1).trim() };
		});
}

/**
 * Core git tool logic implementing all actions.
 * @param {object} input - The tool input
 * @param {object} [options] - Runtime options
 * @param {string} [options.cwd] - Working directory for git commands. This is a
 *   direct-call-only override: the LangChain `tool()` wrapper passes
 *   `RunnableConfig` as `options`, which never contains `cwd`. Production calls
 *   always resolve via `getProjectCwd() || config.cwd || process.cwd()`.
 * @returns {Promise<object>} Result of the operation
 */
export async function gitImpl(input, options = {}) {
	const { action } = input;
	const cwd = options.cwd || getProjectCwd() || config.cwd || process.cwd();

	if (!VALID_ACTIONS.includes(action)) {
		return {
			ok: false,
			error: `Unknown action: '${action}'. Valid actions: ${VALID_ACTIONS.join(", ")}`,
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
			const args = ["diff"];
			if (input.cached) args.push("--cached");
			// Default mode is numstat (backward compatible). Explicit modes
			// override it: nameOnly, stat, patch, or numstat.
			let mode = "numstat";
			if (input.nameOnly) mode = "name-only";
			else if (input.stat) mode = "stat";
			else if (input.patch) mode = "patch";
			else if (input.numstat) mode = "numstat";
			if (mode === "name-only") args.push("--name-only");
			else if (mode === "stat") args.push("--stat");
			else if (mode === "numstat") args.push("--numstat");
			// patch mode passes no format flag — raw unified diff.
			if (input.ref) args.push(input.ref);
			if (input.path) args.push(input.path);
			const res = await runGit(args, cwd);
			if (res.code !== 0) {
				return { ok: false, error: res.stderr.trim() || res.stdout.trim() };
			}
			if (mode === "name-only") {
				return { ok: true, files: res.stdout.split("\n").filter((l) => l.trim() !== "") };
			}
			if (mode === "stat" || mode === "patch") {
				return { ok: true, output: res.stdout.trim() };
			}
			const { files, additions, deletions } = parseDiff(res.stdout);
			return { ok: true, files, additions, deletions };
		}

		case "log": {
			const args = ["log"];
			// Subject-only mode (--pretty=format:"%s") is used by git-tag and
			// update-semver to collect commit messages for a delta description.
			if (input.subject) {
				args.push("--pretty=format:%s");
			} else {
				args.push("--oneline");
			}
			if (input.ref) {
				args.push(input.ref);
			} else if (input.limit) {
				args.push(`-${input.limit}`);
			}
			const res = await runGit(args, cwd);
			if (res.code !== 0) {
				return { ok: false, error: res.stderr.trim() || res.stdout.trim() };
			}
			if (input.subject) {
				return { ok: true, subjects: res.stdout.split("\n").filter((l) => l.trim() !== "") };
			}
			return { ok: true, commits: parseLog(res.stdout) };
		}

		case "branch": {
			if (input.delete) {
				if (!input.branch) {
					return { ok: false, error: "branch delete requires a branch" };
				}
				const flag = input.force ? "-D" : "-d";
				const res = await runGit(["branch", flag, input.branch], cwd);
				if (res.code !== 0) {
					const stderr = res.stderr.trim() || res.stdout.trim();
					const worktreeMatch = stderr.match(
						/cannot delete branch .* used by worktree at '([^']+)'/,
					);
					if (worktreeMatch) {
						return {
							ok: false,
							error: stderr,
							hint: `Branch '${input.branch}' is checked out in worktree at '${worktreeMatch[1]}'. Remove the worktree first (git worktree remove '${worktreeMatch[1]}') before deleting the branch.`,
						};
					}
					return { ok: false, error: stderr };
				}
				return { ok: true, branch: input.branch, deleted: true };
			}
			if (input.create) {
				if (!input.branch) {
					return { ok: false, error: "branch create requires a branch" };
				}
				const args = ["branch", input.branch];
				if (input.ref) args.push(input.ref);
				const res = await runGit(args, cwd);
				if (res.code !== 0) {
					return { ok: false, error: res.stderr.trim() || res.stdout.trim() };
				}
				return { ok: true, branch: input.branch, ref: input.ref || null, created: true };
			}
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
			const args = ["push"];
			if (input.force) args.push("--force");
			args.push(remote, branch);
			const res = await runGit(args, cwd);
			if (res.code !== 0) {
				return { ok: false, error: res.stderr.trim() || res.stdout.trim() };
			}
			return { ok: true, remote, branch };
		}

		case "pull": {
			const remote = input.remote || "origin";
			const branch = input.branch;
			const args = ["pull", remote];
			if (branch) args.push(branch);
			const res = await runGit(args, cwd);
			if (res.code !== 0) {
				return { ok: false, error: res.stderr.trim() || res.stdout.trim() };
			}
			return { ok: true, remote, branch: branch || null, output: res.stdout.trim() };
		}

		case "fetch": {
			const remote = input.remote || "origin";
			const args = ["fetch", remote];
			if (input.branch) args.push(input.branch);
			const res = await runGit(args, cwd);
			if (res.code !== 0) {
				return { ok: false, error: res.stderr.trim() || res.stdout.trim() };
			}
			return { ok: true, remote, branch: input.branch || null, output: res.stdout.trim() };
		}

		case "checkout": {
			if (input.detach) {
				const res = await runGit(["checkout", "--detach"], cwd);
				if (res.code !== 0) {
					return { ok: false, error: res.stderr.trim() || res.stdout.trim() };
				}
				return { ok: true, detached: true };
			}
			if (!input.branch) {
				return { ok: false, error: "checkout requires a branch" };
			}
			const args = input.create ? ["checkout", "-b", input.branch] : ["checkout", input.branch];
			const res = await runGit(args, cwd);
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
			if (input.name) {
				const args = ["tag", "-a", input.name, "-m", input.message || input.name];
				if (input.ref) args.push(input.ref);
				const res = await runGit(args, cwd);
				if (res.code !== 0) {
					return { ok: false, error: res.stderr.trim() || res.stdout.trim() };
				}
				return { ok: true, name: input.name, ref: input.ref || "HEAD" };
			}
			const args = ["tag"];
			if (input.pattern) args.push("-l", input.pattern);
			const res = await runGit(args, cwd);
			if (res.code !== 0) {
				return { ok: false, error: res.stderr.trim() || res.stdout.trim() };
			}
			return { ok: true, tags: parseTags(res.stdout) };
		}

		case "worktree": {
			const sub = input.sub || "list";
			switch (sub) {
				case "add": {
					if (!input.path) {
						return { ok: false, error: "worktree add requires a path" };
					}
					// Reject paths that would create a nested worktree inside the
					// current repo working tree (the nested-worktree footgun).
					const rootRes = await runGit(["rev-parse", "--show-toplevel"], cwd);
					if (rootRes.code === 0) {
						const repoRoot = rootRes.stdout.trim();
						const resolvedPath = path.resolve(cwd, input.path);
						if (resolvedPath === repoRoot || resolvedPath.startsWith(repoRoot + path.sep)) {
							return {
								ok: false,
								error: `worktree add path '${input.path}' is inside the repo working tree '${repoRoot}'. Use a path outside the repo to avoid a nested worktree.`,
							};
						}
					}
					const args = ["worktree", "add"];
					if (input.branch && input.existing) {
						// git worktree add <path> <existing-branch>
						args.push(input.path, input.branch);
					} else if (input.branch) {
						// git worktree add -b <branch> <path> [<ref>]
						args.push("-b", input.branch, input.path);
						if (input.ref) args.push(input.ref);
					} else {
						// git worktree add --detach <path> [<ref>]
						args.push("--detach", input.path);
						if (input.ref) args.push(input.ref);
					}
					const res = await runGit(args, cwd);
					if (res.code !== 0) {
						return { ok: false, error: res.stderr.trim() || res.stdout.trim() };
					}
					return {
						ok: true,
						path: input.path,
						branch: input.branch || null,
						ref: input.ref || null,
					};
				}

				case "remove": {
					if (!input.path) {
						return { ok: false, error: "worktree remove requires a path" };
					}
					const args = ["worktree", "remove"];
					if (input.force) args.push("--force");
					args.push(input.path);
					const res = await runGit(args, cwd);
					if (res.code !== 0) {
						const stderr = res.stderr.trim() || res.stdout.trim();
						if (/contains modified or untracked files/.test(stderr)) {
							return {
								ok: false,
								error: stderr,
								hint: `Worktree at '${input.path}' contains modified or untracked files. Pass force: true to remove it with --force.`,
							};
						}
						return { ok: false, error: stderr };
					}
					return { ok: true, path: input.path, removed: true };
				}

				case "list": {
					const res = await runGit(["worktree", "list"], cwd);
					if (res.code !== 0) {
						return { ok: false, error: res.stderr.trim() || res.stdout.trim() };
					}
					return { ok: true, worktrees: parseWorktrees(res.stdout) };
				}

				case "prune": {
					const res = await runGit(["worktree", "prune"], cwd);
					if (res.code !== 0) {
						return { ok: false, error: res.stderr.trim() || res.stdout.trim() };
					}
					return { ok: true, pruned: true };
				}

				default:
					return {
						ok: false,
						error: `Unknown worktree subcommand: '${sub}'. Valid: add, remove, list, prune`,
					};
			}
		}

		case "remote": {
			const sub = input.sub || "get-url";
			switch (sub) {
				case "get-url": {
					const remote = input.remote || "origin";
					const res = await runGit(["remote", "get-url", remote], cwd);
					if (res.code !== 0) {
						return { ok: false, error: res.stderr.trim() || res.stdout.trim() };
					}
					return { ok: true, remote, url: res.stdout.trim() };
				}

				case "add": {
					if (!input.remote || !input.url) {
						return { ok: false, error: "remote add requires remote and url" };
					}
					const res = await runGit(["remote", "add", input.remote, input.url], cwd);
					if (res.code !== 0) {
						return { ok: false, error: res.stderr.trim() || res.stdout.trim() };
					}
					return { ok: true, remote: input.remote, url: input.url };
				}

				case "set-url": {
					if (!input.remote || !input.url) {
						return { ok: false, error: "remote set-url requires remote and url" };
					}
					const res = await runGit(["remote", "set-url", input.remote, input.url], cwd);
					if (res.code !== 0) {
						return { ok: false, error: res.stderr.trim() || res.stdout.trim() };
					}
					return { ok: true, remote: input.remote, url: input.url };
				}

				default:
					return {
						ok: false,
						error: `Unknown remote subcommand: '${sub}'. Valid: get-url, add, set-url`,
					};
			}
		}

		case "rev-parse": {
			if (input.flag) {
				if (!REV_PARSE_FLAGS.includes(input.flag)) {
					return {
						ok: false,
						error: `Invalid rev-parse flag: '${input.flag}'. Valid flags: ${REV_PARSE_FLAGS.join(", ")}`,
					};
				}
				const args = ["rev-parse", input.flag];
				if (input.flag === "--abbrev-ref") args.push(input.ref || "HEAD");
				const res = await runGit(args, cwd);
				if (res.code !== 0) {
					return { ok: false, error: res.stderr.trim() || res.stdout.trim() };
				}
				return { ok: true, flag: input.flag, output: res.stdout.trim() };
			}
			if (input.ref) {
				const res = await runGit(["rev-parse", input.ref], cwd);
				if (res.code !== 0) {
					return { ok: false, error: res.stderr.trim() || res.stdout.trim() };
				}
				return { ok: true, ref: input.ref, hash: res.stdout.trim() };
			}
			return { ok: false, error: "rev-parse requires a flag or ref" };
		}

		case "ls-remote": {
			const remote = input.remote || "origin";
			const args = ["ls-remote"];
			if (input.tags) args.push("--tags");
			args.push(remote);
			if (input.ref) args.push(input.ref);
			const res = await runGit(args, cwd);
			if (res.code !== 0) {
				return { ok: false, error: res.stderr.trim() || res.stdout.trim() };
			}
			return { ok: true, remote, refs: parseRefs(res.stdout) };
		}

		case "describe": {
			const ref = input.ref || "HEAD";
			const res = await runGit(["describe", "--tags", "--abbrev=0", ref], cwd);
			if (res.code !== 0) {
				// No tag found (or not a git repo) — match the skills' `|| echo ""` intent.
				return { ok: true, ref, tag: null };
			}
			return { ok: true, ref, tag: res.stdout.trim() };
		}

		default:
			return {
				ok: false,
				error: `Unknown action: '${action}'. Valid actions: ${VALID_ACTIONS.join(", ")}`,
			};
	}
}

/**
 * First-class git tool. Wraps common git operations (status, diff, log,
 * branch, add, commit, push, pull, checkout, merge, rebase, stash, show, tag,
 * worktree, remote, rev-parse, ls-remote, fetch, describe) so madz can perform
 * git work consistently instead of shelling out through the process tool. Uses
 * execFile("git", [args]) so args are passed as an array and never interpreted
 * by a shell.
 */
export const git = tool((input, options = {}) => gitImpl(input, options), {
	name: "git",
	description:
		"Git tool. Actions: status, diff, log, branch, add, commit, push, pull, checkout, merge, rebase, stash, show, tag, worktree, remote, rev-parse, ls-remote, fetch, describe. Diff supports cached/nameOnly/stat/patch/numstat modes; log supports subject-only; tag supports pattern; ls-remote supports --tags; checkout supports --detach. branch supports create (git branch <name> [<ref>]) and delete (git branch -d/-D). worktree add supports existing (link to an existing branch) and validates the path; worktree remove returns a hint when --force is required. force passes --force to git (push --force, branch -D, worktree remove --force). Uses execFile('git', [args]) — never sh -c.",
	schema: z.object({
		action: z
			.enum(VALID_ACTIONS)
			.describe(
				"Action to perform (status, diff, log, branch, add, commit, push, pull, checkout, merge, rebase, stash, show, tag, worktree, remote, rev-parse, ls-remote, fetch, describe)",
			),
		path: z
			.string()
			.optional()
			.describe("Path for status/diff/add/worktree actions, or a path filter for diff"),
		message: z
			.string()
			.optional()
			.describe("Commit message for commit action, or tag message for tag create"),
		branch: z
			.string()
			.optional()
			.describe("Branch for checkout/branch/merge/rebase/push/fetch/worktree actions"),
		remote: z.string().optional().describe("Remote for push/fetch/ls-remote/remote actions"),
		ref: z.string().optional().describe("Ref for show/rev-parse/describe/tag/worktree actions"),
		limit: z.number().int().positive().optional().describe("Limit for log action"),
		force: z
			.boolean()
			.optional()
			.describe(
				"Set to true to pass --force to git (push --force, branch -D, worktree remove --force)",
			),
		sub: z
			.string()
			.optional()
			.describe("Subcommand for worktree (add/remove/list/prune) or remote (get-url/add/set-url)"),
		name: z.string().optional().describe("Tag name for tag create action"),
		url: z.string().optional().describe("URL for remote add/set-url action"),
		flag: z.enum(REV_PARSE_FLAGS).optional().describe("Flag for rev-parse action"),
		create: z
			.boolean()
			.optional()
			.describe("Set to true to create a branch on checkout (-b) or branch create"),
		delete: z.boolean().optional().describe("Set to true to delete a branch (branch -D)"),
		detach: z.boolean().optional().describe("Set to true to detach HEAD (checkout --detach)"),
		existing: z
			.boolean()
			.optional()
			.describe(
				"Set to true to link a worktree to an existing branch (worktree add <path> <branch>)",
			),
		cached: z.boolean().optional().describe("Set to true to diff the staged index (--cached)"),
		nameOnly: z
			.boolean()
			.optional()
			.describe("Set to true to list changed file names only (--name-only)"),
		stat: z.boolean().optional().describe("Set to true to show a diffstat (--stat)"),
		patch: z.boolean().optional().describe("Set to true to show the full unified diff (raw patch)"),
		numstat: z.boolean().optional().describe("Set to true to show numstat (default)"),
		subject: z
			.boolean()
			.optional()
			.describe("Set to true to list commit subjects only (log --pretty=format:%s)"),
		pattern: z.string().optional().describe("Pattern for tag list (-l)"),
		tags: z.boolean().optional().describe("Set to true to list remote tags (ls-remote --tags)"),
	}),
});
