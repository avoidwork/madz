import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "../../config/loader.js";
import { getProjectCwd } from "../../workspace/project.js";

/** Lazily loaded config so importing this module never throws or does I/O. */
let cachedConfig;
function getConfig() {
	if (cachedConfig === undefined) {
		try {
			cachedConfig = loadConfig() || {};
		} catch {
			cachedConfig = {};
		}
	}
	return cachedConfig;
}

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
	"switch",
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
	"restore",
	"reset",
	"blame",
	"cherry-pick",
	"revert",
	"rm",
	"mv",
	"clean",
	"merge-base",
	"ls-files",
	"check-ignore",
	"config",
	"apply",
	"clone",
	"init",
	"submodule",
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
	"--git-dir",
	"--git-common-dir",
	"--absolute-git-dir",
	"--is-bare-repository",
	"--verify",
];

/** Branch names that need `allowProtected: true` for destructive operations. */
const PROTECTED_BRANCHES = /^(main|master|trunk|develop|production)$/;

/** Config keys that can lead to command execution; refused for set/unset. */
const DANGEROUS_CONFIG_KEYS =
	/^(core\.(sshcommand|editor|pager|hookspath|fsmonitor|askpass|gitproxy)|alias\.|credential\.|filter\.|diff\..*\.(command|textconv)|diff\.external|merge\..*\.driver|sequence\.editor|gpg\.|url\.|include|protocol\.|uploadpack\.|receive\.)/i;

/** Environment variables that make git target a specific repository or index. */
const REPO_ENV_VARS = [
	"GIT_DIR",
	"GIT_WORK_TREE",
	"GIT_INDEX_FILE",
	"GIT_OBJECT_DIRECTORY",
	"GIT_ALTERNATE_OBJECT_DIRECTORIES",
	"GIT_COMMON_DIR",
	"GIT_PREFIX",
];

const DEFAULT_TIMEOUT_MS = 60_000;
const NETWORK_TIMEOUT_MS = 180_000;
// `commit` runs the pre-commit hook, which may execute a full test/coverage
// suite. Give it a generous window so the hook can finish before we time out.
const HOOK_TIMEOUT_MS = 600_000;
const DEFAULT_MAX_OUTPUT = 200_000;

/**
 * Build the environment for git: never prompt, never open an editor/pager,
 * restrict transport protocols.
 * @returns {NodeJS.ProcessEnv}
 */
function buildEnv() {
	const inherited = { ...process.env };
	// Repo-selecting variables set by a parent git process (e.g. a pre-commit hook sets
	// GIT_INDEX_FILE) would redirect every command away from `cwd`, so drop them.
	for (const name of REPO_ENV_VARS) delete inherited[name];
	return {
		...inherited,
		GIT_TERMINAL_PROMPT: "0",
		GIT_EDITOR: "true",
		GIT_SEQUENCE_EDITOR: "true",
		GIT_PAGER: "cat",
		GIT_SSH_COMMAND: process.env.GIT_SSH_COMMAND || "ssh -o BatchMode=yes",
		GIT_ALLOW_PROTOCOL: process.env.GIT_ALLOW_PROTOCOL || "file:git:http:https:ssh",
	};
}

/**
 * Execute a git command with args passed as an array (never a shell string).
 * @param {string[]} args - Git arguments
 * @param {string} [cwd] - Working directory for the git process
 * @param {{ stdin?: string, timeout?: number }} [opts]
 * @returns {Promise<{ code: number, errno: string | null, killed: boolean, stdout: string, stderr: string }>}
 */
function runGit(args, cwd, opts = {}) {
	return new Promise((resolve) => {
		const child = execFile(
			"git",
			args,
			{
				cwd,
				encoding: "utf-8",
				env: buildEnv(),
				timeout: opts.timeout ?? DEFAULT_TIMEOUT_MS,
				maxBuffer: getConfig().sandbox?.git?.maxBuffer,
			},
			(err, stdout, stderr) => {
				if (err) {
					resolve({
						code: typeof err.code === "number" ? err.code : 1,
						errno: typeof err.code === "string" ? err.code : null,
						killed: Boolean(err.killed),
						stdout: stdout || "",
						stderr: stderr || err.message,
					});
				} else {
					resolve({
						code: 0,
						errno: null,
						killed: false,
						stdout: stdout || "",
						stderr: stderr || "",
					});
				}
			},
		);
		if (opts.stdin !== undefined) {
			child.stdin?.on("error", () => {});
			child.stdin?.end(opts.stdin);
		}
	});
}

const HINTS = {
	"git-not-found": "git executable was not found on PATH.",
	"cwd-not-found": "The working directory does not exist.",
	"not-a-repo":
		"The working directory is not inside a git repository (try the init or clone action).",
	timeout: "git timed out. For network operations check connectivity and credentials.",
	auth: "Authentication failed or a credential prompt was required. Prompts are disabled; configure a credential helper or SSH key.",
	conflict: "Resolve the conflicted files, then add them and continue, or use abort to back out.",
	"dirty-tree":
		"Local changes would be overwritten. Commit, stash, or restore them first (stash action).",
	"nothing-to-commit": "Nothing is staged. Use the add action first (or commit with all: true).",
	hook: "A git hook rejected the operation. Fix the reported problem or, if appropriate, retry with noVerify.",
	maxbuffer: "git output exceeded the buffer limit. Narrow the request (path, limit, stat).",
};

/**
 * Classify a failed git invocation.
 * @param {{ code: number, errno: string | null, killed: boolean, stdout: string, stderr: string }} res
 * @param {string} cwd
 * @returns {string | null}
 */
function classify(res, cwd) {
	const text = `${res.stderr}\n${res.stdout}`;
	if (res.errno === "ENOENT") return cwd && !fs.existsSync(cwd) ? "cwd-not-found" : "git-not-found";
	if (res.errno === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") return "maxbuffer";
	if (res.killed) return "timeout";
	if (/not a git repository/i.test(text)) return "not-a-repo";
	if (
		/Authentication failed|could not read (Username|Password)|terminal prompts disabled|Permission denied \(publickey\)|Host key verification failed/i.test(
			text,
		)
	)
		return "auth";
	if (/CONFLICT|Automatic merge failed|could not apply|fix conflicts/i.test(text))
		return "conflict";
	if (/would be overwritten|Please commit your changes or stash|local changes/i.test(text))
		return "dirty-tree";
	if (/nothing (added )?to commit|no changes added to commit/i.test(text))
		return "nothing-to-commit";
	if (/hook .*(declined|failed|rejected)|pre-commit|commit-msg/i.test(text)) return "hook";
	return null;
}

/**
 * Convert a failed result into the tool's error shape, adding a machine
 * readable `kind`, a `hint`, and the list of conflicted files when relevant.
 * @param {{ code: number, errno: string | null, killed: boolean, stdout: string, stderr: string }} res
 * @param {string} cwd
 * @returns {Promise<object>}
 */
async function fail(res, cwd) {
	const text = res.stderr.trim() || res.stdout.trim() || `git exited with code ${res.code}`;
	const out = { ok: false, error: redact(text), code: res.code };
	const kind = classify(res, cwd);
	if (kind) {
		out.kind = kind;
		if (HINTS[kind]) out.hint = HINTS[kind];
		if (kind === "conflict") {
			const c = await runGit(["diff", "--name-only", "--diff-filter=U"], cwd);
			if (c.code === 0) out.conflicts = lines(c.stdout);
		}
	}
	return out;
}

/**
 * Run git and map a successful result through `onOk`; failures use `fail`.
 * @param {string[]} args
 * @param {string} cwd
 * @param {(res: { stdout: string, stderr: string }) => object | Promise<object>} onOk
 * @param {{ stdin?: string, timeout?: number }} [opts]
 * @returns {Promise<object>}
 */
async function run(args, cwd, onOk, opts) {
	const res = await runGit(args, cwd, opts);
	if (res.code !== 0) return fail(res, cwd);
	return onOk(res);
}

/** Mask credentials embedded in URLs (scheme://user:token@host). */
function redact(text) {
	return typeof text === "string"
		? text.replace(/(\b[a-z][a-z0-9+.-]*:\/\/)[^/@\s]+@/gi, "$1***@")
		: text;
}

/** Non-empty lines of text. */
function lines(text) {
	return text.split("\n").filter((l) => l.trim() !== "");
}

/**
 * Truncate large output so it can't blow up the model context.
 * @param {string} text
 * @param {number} [max]
 * @returns {{ output: string, truncated: boolean }}
 */
function cap(text, max) {
	const limit = max && max > 0 ? max : DEFAULT_MAX_OUTPUT;
	if (text.length <= limit) return { output: text, truncated: false };
	return {
		output: `${text.slice(0, limit)}\n... [truncated ${text.length - limit} chars]`,
		truncated: true,
	};
}

/** All path inputs as a de-duplicated array. */
function pathsOf(input) {
	return [...new Set([...(input.paths || []), ...(input.path ? [input.path] : [])])];
}

/** `["--", ...paths]` or an empty array. */
function dashPaths(paths) {
	return paths.length ? ["--", ...paths] : [];
}

/** Split a whitespace-separated ref expression ("a b", "a..b") into args. */
function splitRefs(ref) {
	return ref ? ref.trim().split(/\s+/).filter(Boolean) : [];
}

/**
 * Reject values that git would interpret as options (option injection) or
 * that are otherwise unsafe. Returns an error message or null.
 * @param {object} input
 * @returns {string | null}
 */
function validateInput(input) {
	for (const field of ["ref", "branch", "remote", "name", "to", "pattern", "onto", "key"]) {
		const v = input[field];
		if (v === undefined || v === null) continue;
		if (typeof v !== "string" || v.includes("\0")) return `Invalid ${field}`;
		for (const part of field === "ref" ? splitRefs(v) : [v]) {
			if (/^[-+]/.test(part)) {
				return `Invalid ${field} '${part}': values may not start with '-' or '+'.`;
			}
		}
	}
	// Collect path inputs, including empty strings (which are falsy but invalid).
	const pathInputs = [
		...(input.paths || []),
		...(input.path !== undefined && input.path !== null ? [input.path] : []),
		...(input.to !== undefined && input.to !== null ? [input.to] : []),
	];
	for (const p of pathInputs) {
		if (p.includes("\0")) return "Invalid path";
		if (p.trim() === "") return "Invalid path: path may not be empty or whitespace-only";
		if (p.startsWith("-")) return `Invalid path '${p}': prefix it with './' if it starts with '-'.`;
	}
	if (input.url !== undefined && (input.url.startsWith("-") || /^(ext|fd)::/i.test(input.url))) {
		return "Invalid url: option-like or unsafe transport.";
	}
	return null;
}

/**
 * Resolve the branch a push would affect, for the protected-branch guard.
 * @param {string | undefined} branchArg
 * @param {string} cwd
 * @returns {Promise<string>}
 */
async function pushTarget(branchArg, cwd) {
	if (!branchArg || branchArg === "HEAD") {
		const r = await runGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
		return r.code === 0 ? r.stdout.trim() : "";
	}
	return branchArg
		.split(":")
		.pop()
		.replace(/^refs\/heads\//, "");
}

/**
 * Parse `git status --porcelain=v1 -z --branch` output.
 * @param {string} output - Raw NUL-delimited status output
 * @returns {object}
 */
function parseStatusZ(output) {
	const records = output.split("\0");
	const changes = [];
	let header = "";
	for (let i = 0; i < records.length; i++) {
		const rec = records[i];
		if (!rec) continue;
		if (rec.startsWith("## ")) {
			header = rec.slice(3);
			continue;
		}
		const x = rec[0];
		const y = rec[1];
		const entry = rec.slice(3);
		let origPath = null;
		if (x === "R" || x === "C" || y === "R" || y === "C") origPath = records[++i] || null;
		const conflicted =
			x === "U" || y === "U" || (x === "A" && y === "A") || (x === "D" && y === "D");
		const untracked = x === "?";
		const ignored = x === "!";
		changes.push({
			path: entry,
			status: `${x}${y}`.trim(),
			index: x,
			worktree: y,
			staged: !conflicted && !untracked && !ignored && x !== " ",
			unstaged: !conflicted && !untracked && !ignored && y !== " ",
			untracked,
			conflicted,
			...(origPath ? { origPath } : {}),
		});
	}
	let branch = header;
	let detached = false;
	let initial = false;
	let upstream = null;
	let ahead = 0;
	let behind = 0;
	let gone = false;
	const initialMatch = header.match(/^(?:No commits yet on|Initial commit on) (.+)$/);
	if (initialMatch) {
		branch = initialMatch[1];
		initial = true;
	} else if (header.startsWith("HEAD (no branch)")) {
		// Keep the historical non-null string so callers that read `branch` keep working;
		// `detached` is the reliable signal.
		branch = "HEAD (no branch)";
		detached = true;
	} else {
		const bracket = header.match(/ \[(.*)\]$/);
		const rest = bracket ? header.slice(0, bracket.index) : header;
		const [b, u] = rest.split("...");
		branch = b;
		upstream = u || null;
		if (bracket) {
			ahead = Number(bracket[1].match(/ahead (\d+)/)?.[1] || 0);
			behind = Number(bracket[1].match(/behind (\d+)/)?.[1] || 0);
			gone = /gone/.test(bracket[1]);
		}
	}
	return {
		ok: true,
		branch,
		detached,
		initial,
		upstream,
		upstreamGone: gone,
		ahead,
		behind,
		changes,
		clean: changes.length === 0,
		conflicts: changes.filter((c) => c.conflicted).map((c) => c.path),
	};
}

/**
 * Parse `git diff --numstat` output into additions/deletions counts.
 * @param {string} output - Raw numstat output
 * @returns {{ files: string[], additions: number, deletions: number, binary: string[] }}
 */
function parseDiff(output) {
	let additions = 0;
	let deletions = 0;
	const files = [];
	const binary = [];
	for (const line of output.split("\n")) {
		if (line.trim() === "") continue;
		const parts = line.split("\t");
		if (parts.length >= 3) {
			const a = parseInt(parts[0], 10);
			const d = parseInt(parts[1], 10);
			if (Number.isNaN(a) || Number.isNaN(d)) binary.push(parts[2]);
			if (!Number.isNaN(a)) additions += a;
			if (!Number.isNaN(d)) deletions += d;
			files.push(parts[2]);
		}
	}
	return { files, additions, deletions, binary };
}

/**
 * Parse `git log --oneline` output into a commits array.
 * @param {string} output - Raw log output
 * @returns {Array<{ hash: string, message: string }>}
 */
function parseLog(output) {
	return lines(output).map((line) => {
		const idx = line.indexOf(" ");
		if (idx === -1) return { hash: line, message: "" };
		return { hash: line.slice(0, idx), message: line.slice(idx + 1) };
	});
}

/**
 * Parse `git worktree list --porcelain` output.
 * @param {string} output
 * @returns {Array<object>}
 */
function parseWorktrees(output) {
	return output
		.split(/\n\s*\n/)
		.filter((b) => b.trim() !== "")
		.map((block) => {
			const wt = {
				path: "",
				hash: "",
				branch: null,
				detached: false,
				bare: false,
				locked: false,
				prunable: false,
			};
			for (const line of block.split("\n")) {
				if (line.startsWith("worktree ")) wt.path = line.slice(9);
				else if (line.startsWith("HEAD ")) wt.hash = line.slice(5);
				else if (line.startsWith("branch "))
					wt.branch = line.slice(7).replace(/^refs\/heads\//, "");
				else if (line === "detached") wt.detached = true;
				else if (line === "bare") wt.bare = true;
				else if (line.startsWith("locked")) {
					wt.locked = true;
					wt.lockedReason = line.slice(7) || null;
				} else if (line.startsWith("prunable")) {
					wt.prunable = true;
					wt.prunableReason = line.slice(9) || null;
				}
			}
			return wt;
		});
}

/**
 * Parse `git ls-remote` output into a refs array.
 * @param {string} output - Raw ls-remote output
 * @returns {Array<{ hash: string, ref: string }>}
 */
function parseRefs(output) {
	return lines(output).map((line) => {
		const idx = line.indexOf("\t");
		if (idx === -1) return { hash: line.trim(), ref: "" };
		return { hash: line.slice(0, idx).trim(), ref: line.slice(idx + 1).trim() };
	});
}

/**
 * Parse `git blame --line-porcelain` output.
 * @param {string} output
 * @returns {Array<{ line: number, hash: string, author: string, summary: string, content: string }>}
 */
function parseBlame(output) {
	const out = [];
	let cur = null;
	// Flush a pending record. Only emit records that captured a content line;
	// a header with no following content (truncated/malformed output) is dropped
	// rather than emitted as an empty entry.
	const flush = () => {
		if (cur && cur.content !== "") {
			out.push(cur);
		}
		cur = null;
	};
	for (const line of output.split("\n")) {
		const header = line.match(/^([0-9a-f]{40,64}) \d+ (\d+)/);
		if (header) {
			// A new header while a record is pending means the previous record
			// never got a content line; flush it so it isn't lost or misattributed.
			flush();
			cur = { line: Number(header[2]), hash: header[1], author: "", summary: "", content: "" };
		} else if (cur) {
			if (line.startsWith("author ")) cur.author = line.slice(7);
			else if (line.startsWith("summary ")) cur.summary = line.slice(8);
			else if (line.startsWith("\t")) {
				cur.content = line.slice(1);
				out.push(cur);
				cur = null;
			}
		}
	}
	flush();
	return out;
}

/** Shared handler for abort/continue/skip style sequencer operations. */
function sequencerFlag(input) {
	if (input.abort) return "--abort";
	if (input.continue) return "--continue";
	if (input.skip) return "--skip";
	return null;
}

const handlers = {
	status(input, cwd) {
		const args = ["status", "--porcelain=v1", "-z", "--branch"];
		if (input.untracked === "all") args.push("-uall");
		else if (input.untracked === "no") args.push("-uno");
		args.push(...dashPaths(pathsOf(input)));
		return run(args, cwd, (res) => parseStatusZ(res.stdout));
	},

	diff(input, cwd) {
		const args = ["diff", "--no-color"];
		if (input.cached) args.push("--cached");
		// Default mode is numstat (backward compatible).
		let mode = "numstat";
		if (input.nameOnly) mode = "name-only";
		else if (input.stat) mode = "stat";
		else if (input.patch) mode = "patch";
		if (mode === "name-only") args.push("--name-only");
		else if (mode === "stat") args.push("--stat");
		else if (mode === "numstat") args.push("--numstat");
		if (input.unified !== undefined) args.push(`-U${input.unified}`);
		if (input.ignoreWhitespace) args.push("-w");
		args.push(...splitRefs(input.ref), ...dashPaths(pathsOf(input)));
		return run(args, cwd, (res) => {
			if (mode === "name-only") return { ok: true, files: lines(res.stdout) };
			if (mode === "stat" || mode === "patch") {
				const { output, truncated } = cap(res.stdout.trim(), input.maxBytes);
				return { ok: true, output, truncated };
			}
			return { ok: true, ...parseDiff(res.stdout) };
		});
	},

	async log(input, cwd) {
		const args = ["log", "--no-color"];
		if (input.subject) args.push("--pretty=format:%s");
		else if (input.full) args.push("--pretty=format:%H%x1f%an%x1f%ae%x1f%aI%x1f%s%x1e");
		else args.push("--oneline");
		if (input.limit) args.push("-n", String(input.limit));
		if (input.author) args.push(`--author=${input.author}`);
		if (input.since) args.push(`--since=${input.since}`);
		if (input.until) args.push(`--until=${input.until}`);
		if (input.grep) args.push(`--grep=${input.grep}`);
		args.push(...splitRefs(input.ref), ...dashPaths(pathsOf(input)));
		const res = await runGit(args, cwd);
		if (res.code !== 0) {
			// A repository with no commits yet is an empty history, not an error.
			if (/does not have any commits yet/.test(res.stderr)) {
				return input.subject ? { ok: true, subjects: [] } : { ok: true, commits: [] };
			}
			return fail(res, cwd);
		}
		if (input.subject) return { ok: true, subjects: lines(res.stdout) };
		if (input.full) {
			const commits = res.stdout
				.split("\x1e")
				.map((r) => r.replace(/^\n/, ""))
				.filter((r) => r.trim() !== "")
				.map((r) => {
					const [hash, author, email, date, ...subject] = r.split("\x1f");
					return { hash, author, email, date, message: subject.join("\x1f") };
				});
			return { ok: true, commits };
		}
		return { ok: true, commits: parseLog(res.stdout) };
	},

	async branch(input, cwd) {
		if (input.delete) {
			if (!input.branch) return { ok: false, error: "branch delete requires a branch" };
			if (input.force && PROTECTED_BRANCHES.test(input.branch) && !input.allowProtected) {
				return {
					ok: false,
					error: `Refusing to force-delete protected branch '${input.branch}'. Pass allowProtected: true to override.`,
				};
			}
			const res = await runGit(["branch", input.force ? "-D" : "-d", input.branch], cwd);
			if (res.code !== 0) {
				const stderr = res.stderr.trim() || res.stdout.trim();
				const worktreeMatch = stderr.match(/cannot delete branch .* used by worktree at '([^']+)'/);
				if (worktreeMatch) {
					return {
						ok: false,
						error: stderr,
						hint: `Branch '${input.branch}' is checked out in worktree at '${worktreeMatch[1]}'. Remove the worktree first (git worktree remove '${worktreeMatch[1]}') before deleting the branch.`,
					};
				}
				if (/not fully merged/.test(stderr)) {
					return {
						ok: false,
						error: stderr,
						hint: "Branch is not fully merged. Pass force: true to delete anyway.",
					};
				}
				return fail(res, cwd);
			}
			return { ok: true, branch: input.branch, deleted: true };
		}
		if (input.create) {
			if (!input.branch) return { ok: false, error: "branch create requires a branch" };
			const args = ["branch", input.branch];
			if (input.ref) args.push(input.ref);
			return run(args, cwd, () => ({
				ok: true,
				branch: input.branch,
				ref: input.ref || null,
				created: true,
			}));
		}
		if (input.name) {
			// Rename: `branch` is the old name (defaults to the current branch), `name` the new one.
			const args = ["branch", input.force ? "-M" : "-m"];
			if (input.branch) args.push(input.branch);
			args.push(input.name);
			return run(args, cwd, () => ({
				ok: true,
				from: input.branch || null,
				branch: input.name,
				renamed: true,
			}));
		}
		if (input.current) {
			return run(["branch", "--show-current"], cwd, (res) => ({
				ok: true,
				current: res.stdout.trim() || null,
				detached: res.stdout.trim() === "",
			}));
		}
		const args = ["branch", "--format=%(HEAD)\t%(refname:short)\t%(upstream:short)"];
		if (input.all) args.push("-a");
		else if (input.remotes) args.push("-r");
		if (input.merged) args.push("--merged", input.ref || "HEAD");
		return run(args, cwd, (res) => {
			const details = [];
			let current = null;
			let detached = false;
			for (const line of res.stdout.split("\n")) {
				if (line.trim() === "") continue;
				const [head, name, upstream] = line.split("\t");
				const isCurrent = head === "*";
				if (/^\(HEAD detached|^\(no branch/.test(name)) {
					detached = true;
					continue;
				}
				details.push({ name, current: isCurrent, upstream: upstream || null });
				if (isCurrent) current = name;
			}
			return { ok: true, branches: details.map((d) => d.name), current, detached, details };
		});
	},

	add(input, cwd) {
		const paths = pathsOf(input);
		const args = ["add"];
		if (input.all) args.push("-A");
		else if (input.update) args.push("-u");
		const defaultPath = !input.all && !input.update && paths.length === 0 ? ["."] : [];
		args.push(...dashPaths([...paths, ...defaultPath]));
		return run(args, cwd, () => ({
			ok: true,
			files: [...paths, ...defaultPath],
			...(input.all ? { all: true } : {}),
			...(input.update ? { update: true } : {}),
		}));
	},

	async commit(input, cwd) {
		const args = ["commit"];
		if (input.all) args.push("-a");
		if (input.amend) args.push("--amend");
		if (input.allowEmpty) args.push("--allow-empty");
		if (input.noVerify) args.push("--no-verify");
		if (input.signoff) args.push("-s");
		if (input.message) args.push("-m", input.message);
		else if (input.amend) args.push("--no-edit");
		else return { ok: false, error: "commit requires a message" };
		// The pre-commit hook may run a full test/coverage suite, so allow a
		// long window. `--no-verify` skips the hook, so the default suffices.
		const res = await runGit(args, cwd, input.noVerify ? undefined : { timeout: HOOK_TIMEOUT_MS });
		if (res.code !== 0) return fail(res, cwd);
		const head = await runGit(["rev-parse", "--short", "HEAD"], cwd);
		return {
			ok: true,
			hash: head.code === 0 ? head.stdout.trim() : "",
			message: input.message || null,
			...(input.amend ? { amended: true } : {}),
		};
	},

	async push(input, cwd) {
		const remote = input.remote || "origin";
		const destructive = input.force || input.forceWithLease || input.delete;
		if (destructive && !input.allowProtected) {
			const target = await pushTarget(input.branch, cwd);
			if (PROTECTED_BRANCHES.test(target)) {
				return {
					ok: false,
					error: `Refusing to ${input.delete ? "delete" : "force-push"} protected branch '${target}'. Pass allowProtected: true to override.`,
				};
			}
		}
		const args = ["push"];
		if (input.setUpstream) args.push("-u");
		if (input.forceWithLease) args.push("--force-with-lease");
		else if (input.force) args.push("--force");
		if (input.tags) args.push("--tags");
		if (input.delete) {
			if (!input.branch) return { ok: false, error: "push delete requires a branch" };
			args.push("--delete");
		}
		args.push(remote);
		const branch = input.branch || (input.tags ? undefined : "HEAD");
		if (branch) args.push(branch);
		return run(
			args,
			cwd,
			() => ({
				ok: true,
				remote,
				branch: branch || null,
				...(input.setUpstream ? { upstream: true } : {}),
				...(input.delete ? { deleted: true } : {}),
			}),
			{ timeout: NETWORK_TIMEOUT_MS },
		);
	},

	pull(input, cwd) {
		const args = ["pull"];
		if (input.rebase) args.push("--rebase");
		if (input.ffOnly) args.push("--ff-only");
		if (input.prune) args.push("--prune");
		if (input.all) args.push("--all");
		else args.push(input.remote || "origin");
		if (input.branch && !input.all) args.push(input.branch);
		return run(
			args,
			cwd,
			(res) => ({
				ok: true,
				remote: input.remote || "origin",
				branch: input.branch || null,
				output: res.stdout.trim(),
			}),
			{ timeout: NETWORK_TIMEOUT_MS },
		);
	},

	fetch(input, cwd) {
		const args = ["fetch"];
		if (input.prune) args.push("--prune");
		if (input.tags) args.push("--tags");
		if (input.all) args.push("--all");
		else {
			args.push(input.remote || "origin");
			if (input.branch) args.push(input.branch);
		}
		return run(
			args,
			cwd,
			(res) => ({
				ok: true,
				remote: input.remote || "origin",
				branch: input.branch || null,
				output: `${res.stdout}${res.stderr}`.trim(),
			}),
			{ timeout: NETWORK_TIMEOUT_MS },
		);
	},

	checkout(input, cwd) {
		const paths = pathsOf(input);
		if (input.detach) {
			const args = ["checkout", "--detach"];
			if (input.ref || input.branch) args.push(input.ref || input.branch);
			return run(args, cwd, () => ({ ok: true, detached: true }));
		}
		if (paths.length > 0 && !input.create) {
			// File checkout: restore paths from the index or a ref.
			const args = ["checkout"];
			if (input.ref) args.push(input.ref);
			args.push("--", ...paths);
			return run(args, cwd, () => ({ ok: true, files: paths, ref: input.ref || null }));
		}
		if (!input.branch) return { ok: false, error: "checkout requires a branch" };
		const args = input.create ? ["checkout", "-b", input.branch] : ["checkout", input.branch];
		if (input.create && input.ref) args.push(input.ref);
		return run(args, cwd, () => ({ ok: true, branch: input.branch }));
	},

	switch(input, cwd) {
		if (input.detach) {
			const args = ["switch", "--detach"];
			if (input.ref || input.branch) args.push(input.ref || input.branch);
			return run(args, cwd, () => ({ ok: true, detached: true }));
		}
		if (!input.branch) return { ok: false, error: "switch requires a branch" };
		const args = ["switch"];
		if (input.create) args.push("-c");
		args.push(input.branch);
		if (input.create && input.ref) args.push(input.ref);
		return run(args, cwd, () => ({ ok: true, branch: input.branch }));
	},

	merge(input, cwd) {
		const seq = input.abort ? "--abort" : input.continue ? "--continue" : null;
		if (seq) return run(["merge", seq], cwd, () => ({ ok: true, [seq.slice(2)]: true }));
		if (!input.branch) return { ok: false, error: "merge requires a branch" };
		const args = ["merge"];
		if (input.noFf) args.push("--no-ff");
		if (input.ffOnly) args.push("--ff-only");
		if (input.squash) args.push("--squash");
		if (input.message) args.push("-m", input.message);
		args.push(input.branch);
		return run(args, cwd, (res) => ({ ok: true, branch: input.branch, output: res.stdout.trim() }));
	},

	rebase(input, cwd) {
		const seq = sequencerFlag(input);
		if (seq) return run(["rebase", seq], cwd, () => ({ ok: true, [seq.slice(2)]: true }));
		if (!input.branch) return { ok: false, error: "rebase requires a branch" };
		const args = ["rebase"];
		if (input.onto) args.push("--onto", input.onto);
		args.push(input.branch);
		return run(args, cwd, () => ({ ok: true, branch: input.branch }));
	},

	async stash(input, cwd) {
		const sub = input.sub || "push";
		const ref = `stash@{${input.index ?? 0}}`;
		switch (sub) {
			case "push": {
				const args = ["stash", "push"];
				if (input.includeUntracked) args.push("-u");
				if (input.message) args.push("-m", input.message);
				args.push(...dashPaths(pathsOf(input)));
				return run(args, cwd, (res) => ({
					ok: true,
					stashed: !/No local changes to save/.test(res.stdout),
					output: res.stdout.trim(),
				}));
			}
			case "list":
				return run(["stash", "list", "--format=%gd%x09%gs"], cwd, (res) => ({
					ok: true,
					stashes: lines(res.stdout).map((l) => {
						const [name, ...rest] = l.split("\t");
						return { name, message: rest.join("\t") };
					}),
				}));
			case "pop":
			case "apply":
				return run(["stash", sub, ref], cwd, (res) => ({
					ok: true,
					ref,
					output: res.stdout.trim(),
				}));
			case "drop":
				return run(["stash", "drop", ref], cwd, () => ({ ok: true, ref, dropped: true }));
			case "show":
				return run(["stash", "show", input.patch ? "-p" : "--stat", ref], cwd, (res) => ({
					ok: true,
					ref,
					...cap(res.stdout, input.maxBytes),
				}));
			default:
				return {
					ok: false,
					error: `Unknown stash subcommand: '${sub}'. Valid: push, list, pop, apply, drop, show`,
				};
		}
	},

	show(input, cwd) {
		const ref = input.ref || "HEAD";
		const paths = pathsOf(input);
		let args;
		if (input.file) {
			if (!paths[0]) return { ok: false, error: "show with file requires a path" };
			args = ["show", `${ref}:${paths[0]}`];
		} else {
			args = ["show", "--no-color"];
			if (input.stat) args.push("--stat");
			if (input.nameOnly) args.push("--name-only");
			args.push(ref, ...dashPaths(paths));
		}
		return run(args, cwd, (res) => ({ ok: true, ref, ...cap(res.stdout, input.maxBytes) }));
	},

	tag(input, cwd) {
		if (input.delete) {
			if (!input.name) return { ok: false, error: "tag delete requires a name" };
			return run(["tag", "-d", input.name], cwd, () => ({
				ok: true,
				name: input.name,
				deleted: true,
			}));
		}
		if (input.name) {
			const args = ["tag"];
			if (input.force) args.push("-f");
			if (input.lightweight) args.push(input.name);
			else args.push("-a", input.name, "-m", input.message || input.name);
			if (input.ref) args.push(input.ref);
			return run(args, cwd, () => ({
				ok: true,
				name: input.name,
				ref: input.ref || "HEAD",
				lightweight: Boolean(input.lightweight),
			}));
		}
		const args = ["tag"];
		if (input.sortVersion) args.push("--sort=-v:refname");
		if (input.pattern) args.push("-l", input.pattern);
		return run(args, cwd, (res) => ({ ok: true, tags: lines(res.stdout) }));
	},

	async worktree(input, cwd) {
		const sub = input.sub || "list";
		switch (sub) {
			case "add": {
				if (!input.path) return { ok: false, error: "worktree add requires a path" };
				// Reject paths that would create a nested worktree inside the repo.
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
					args.push(input.path, input.branch);
				} else if (input.branch) {
					args.push("-b", input.branch, input.path);
					if (input.ref) args.push(input.ref);
				} else {
					args.push("--detach", input.path);
					if (input.ref) args.push(input.ref);
				}
				return run(args, cwd, () => ({
					ok: true,
					path: input.path,
					branch: input.branch || null,
					ref: input.ref || null,
				}));
			}
			case "remove": {
				if (!input.path) return { ok: false, error: "worktree remove requires a path" };
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
					return fail(res, cwd);
				}
				return { ok: true, path: input.path, removed: true };
			}
			case "list":
				return run(["worktree", "list", "--porcelain"], cwd, (res) => ({
					ok: true,
					worktrees: parseWorktrees(res.stdout),
				}));
			case "prune":
				return run(["worktree", "prune"], cwd, () => ({ ok: true, pruned: true }));
			case "lock":
			case "unlock": {
				if (!input.path) return { ok: false, error: `worktree ${sub} requires a path` };
				const args = ["worktree", sub];
				if (sub === "lock" && input.message) args.push("--reason", input.message);
				args.push(input.path);
				return run(args, cwd, () => ({
					ok: true,
					path: input.path,
					[sub === "lock" ? "locked" : "unlocked"]: true,
				}));
			}
			case "move":
				if (!input.path || !input.to)
					return { ok: false, error: "worktree move requires path and to" };
				return run(["worktree", "move", input.path, input.to], cwd, () => ({
					ok: true,
					path: input.path,
					to: input.to,
				}));
			default:
				return {
					ok: false,
					error: `Unknown worktree subcommand: '${sub}'. Valid: add, remove, list, prune, lock, unlock, move`,
				};
		}
	},

	remote(input, cwd) {
		const sub = input.sub || "get-url";
		switch (sub) {
			case "get-url": {
				const remote = input.remote || "origin";
				return run(["remote", "get-url", remote], cwd, (res) => ({
					ok: true,
					remote,
					url: redact(res.stdout.trim()),
				}));
			}
			case "list":
				return run(["remote", "-v"], cwd, (res) => {
					const map = new Map();
					for (const l of lines(res.stdout)) {
						const m = l.match(/^(\S+)\t(.+) \((fetch|push)\)$/);
						if (!m) continue;
						const r = map.get(m[1]) || { name: m[1], fetch: null, push: null };
						r[m[3]] = redact(m[2]);
						map.set(m[1], r);
					}
					return { ok: true, remotes: [...map.values()] };
				});
			case "add":
			case "set-url":
				if (!input.remote || !input.url)
					return { ok: false, error: `remote ${sub} requires remote and url` };
				return run(["remote", sub, input.remote, input.url], cwd, () => ({
					ok: true,
					remote: input.remote,
					url: redact(input.url),
				}));
			case "remove":
				if (!input.remote) return { ok: false, error: "remote remove requires remote" };
				return run(["remote", "remove", input.remote], cwd, () => ({
					ok: true,
					remote: input.remote,
					removed: true,
				}));
			case "rename":
				if (!input.remote || !input.name)
					return { ok: false, error: "remote rename requires remote and name" };
				return run(["remote", "rename", input.remote, input.name], cwd, () => ({
					ok: true,
					from: input.remote,
					remote: input.name,
				}));
			case "prune": {
				const remote = input.remote || "origin";
				return run(
					["remote", "prune", remote],
					cwd,
					(res) => ({ ok: true, remote, output: res.stdout.trim() }),
					{
						timeout: NETWORK_TIMEOUT_MS,
					},
				);
			}
			default:
				return {
					ok: false,
					error: `Unknown remote subcommand: '${sub}'. Valid: get-url, list, add, set-url, remove, rename, prune`,
				};
		}
	},

	"rev-parse"(input, cwd) {
		if (input.flag) {
			if (!REV_PARSE_FLAGS.includes(input.flag)) {
				return {
					ok: false,
					error: `Invalid rev-parse flag: '${input.flag}'. Valid flags: ${REV_PARSE_FLAGS.join(", ")}`,
				};
			}
			const args = ["rev-parse"];
			if (input.flag === "--abbrev-ref" || input.flag === "--short")
				args.push(input.flag, input.ref || "HEAD");
			else if (input.flag === "--verify") {
				if (!input.ref) return { ok: false, error: "rev-parse --verify requires a ref" };
				args.push("--verify", "--quiet", input.ref);
			} else args.push(input.flag);
			return run(args, cwd, (res) => ({ ok: true, flag: input.flag, output: res.stdout.trim() }));
		}
		if (input.ref) {
			return run(["rev-parse", input.ref], cwd, (res) => ({
				ok: true,
				ref: input.ref,
				hash: res.stdout.trim(),
			}));
		}
		return { ok: false, error: "rev-parse requires a flag or ref" };
	},

	"ls-remote"(input, cwd) {
		const remote = input.remote || "origin";
		const args = ["ls-remote"];
		if (input.tags) args.push("--tags");
		if (input.heads) args.push("--heads");
		args.push(remote);
		if (input.ref) args.push(input.ref);
		return run(args, cwd, (res) => ({ ok: true, remote, refs: parseRefs(res.stdout) }), {
			timeout: NETWORK_TIMEOUT_MS,
		});
	},

	async describe(input, cwd) {
		const ref = input.ref || "HEAD";
		const res = await runGit(["describe", "--tags", "--abbrev=0", ref], cwd);
		if (res.code !== 0) {
			// Only "no tag reachable" is a legitimate null; real errors are surfaced.
			if (/No names found|No tags can describe|cannot describe anything/i.test(res.stderr)) {
				return { ok: true, ref, tag: null };
			}
			return fail(res, cwd);
		}
		return { ok: true, ref, tag: res.stdout.trim() };
	},

	restore(input, cwd) {
		const paths = pathsOf(input);
		if (paths.length === 0) return { ok: false, error: "restore requires path or paths" };
		const args = ["restore"];
		if (input.staged) args.push("--staged");
		if (input.worktree || !input.staged) args.push("--worktree");
		if (input.ref) args.push(`--source=${input.ref}`);
		args.push("--", ...paths);
		return run(args, cwd, () => ({
			ok: true,
			files: paths,
			staged: Boolean(input.staged),
			worktree: Boolean(input.worktree || !input.staged),
		}));
	},

	reset(input, cwd) {
		const paths = pathsOf(input);
		const mode = input.mode || "mixed";
		if (!["soft", "mixed", "hard"].includes(mode)) {
			return { ok: false, error: `Invalid reset mode '${mode}'. Valid: soft, mixed, hard` };
		}
		if (paths.length > 0) {
			// Path reset only unstages; it never discards working tree edits.
			const args = ["reset"];
			if (input.ref) args.push(input.ref);
			args.push("--", ...paths);
			return run(args, cwd, () => ({ ok: true, files: paths, unstaged: true }));
		}
		if (mode === "hard" && !input.force) {
			return {
				ok: false,
				error: "reset --hard discards uncommitted work. Pass force: true to confirm.",
			};
		}
		const target = input.ref || "HEAD";
		return run(["reset", `--${mode}`, target], cwd, () => ({ ok: true, mode, ref: target }));
	},

	blame(input, cwd) {
		const file = pathsOf(input)[0];
		if (!file) return { ok: false, error: "blame requires a path" };
		const args = ["blame", "--line-porcelain"];
		if (input.startLine) args.push("-L", `${input.startLine},${input.endLine || input.startLine}`);
		if (input.ref) args.push(input.ref);
		args.push("--", file);
		return run(args, cwd, (res) => {
			const all = parseBlame(res.stdout);
			const max = 2000;
			return { ok: true, path: file, lines: all.slice(0, max), truncated: all.length > max };
		});
	},

	"cherry-pick"(input, cwd) {
		const seq = sequencerFlag(input);
		if (seq) return run(["cherry-pick", seq], cwd, () => ({ ok: true, [seq.slice(2)]: true }));
		const refs = splitRefs(input.ref);
		if (refs.length === 0) return { ok: false, error: "cherry-pick requires a ref" };
		const args = ["cherry-pick"];
		if (input.noCommit) args.push("-n");
		args.push(...refs);
		return run(args, cwd, () => ({ ok: true, refs }));
	},

	revert(input, cwd) {
		const seq = sequencerFlag(input);
		if (seq) return run(["revert", seq], cwd, () => ({ ok: true, [seq.slice(2)]: true }));
		const refs = splitRefs(input.ref);
		if (refs.length === 0) return { ok: false, error: "revert requires a ref" };
		const args = ["revert", "--no-edit"];
		if (input.noCommit) args.push("-n");
		args.push(...refs);
		return run(args, cwd, () => ({ ok: true, refs }));
	},

	rm(input, cwd) {
		const paths = pathsOf(input);
		if (paths.length === 0) return { ok: false, error: "rm requires path or paths" };
		const args = ["rm"];
		if (input.cached) args.push("--cached");
		if (input.recursive) args.push("-r");
		if (input.force) args.push("-f");
		args.push("--", ...paths);
		return run(args, cwd, () => ({
			ok: true,
			files: paths,
			...(input.cached ? { cached: true } : {}),
		}));
	},

	mv(input, cwd) {
		if (!input.path || !input.to) return { ok: false, error: "mv requires path and to" };
		const args = ["mv"];
		if (input.force) args.push("-f");
		args.push("--", input.path, input.to);
		return run(args, cwd, () => ({ ok: true, from: input.path, to: input.to }));
	},

	clean(input, cwd) {
		// Dry run unless force is explicitly set.
		const args = ["clean", input.force ? "-f" : "-n"];
		if (input.directories) args.push("-d");
		args.push(...dashPaths(pathsOf(input)));
		return run(args, cwd, (res) => ({
			ok: true,
			dryRun: !input.force,
			files: lines(res.stdout)
				.map((l) => l.match(/^(?:Would remove|Removing) (.*)$/)?.[1])
				.filter(Boolean),
		}));
	},

	async "merge-base"(input, cwd) {
		const refs = splitRefs(input.ref);
		if (refs.length < 2)
			return { ok: false, error: "merge-base requires two refs in ref (e.g. 'main feature')" };
		if (input.isAncestor) {
			const res = await runGit(["merge-base", "--is-ancestor", refs[0], refs[1]], cwd);
			if (res.code === 0) return { ok: true, ancestor: true };
			if (res.code === 1) return { ok: true, ancestor: false };
			return fail(res, cwd);
		}
		return run(["merge-base", ...refs], cwd, (res) => ({
			ok: true,
			refs,
			hash: res.stdout.trim(),
		}));
	},

	"ls-files"(input, cwd) {
		const args = ["ls-files", "-z"];
		if (input.ignored) args.push("--others", "--ignored", "--exclude-standard");
		else if (input.others) args.push("--others", "--exclude-standard");
		else if (input.modified) args.push("--modified");
		args.push(...dashPaths(pathsOf(input)));
		return run(args, cwd, (res) => ({ ok: true, files: res.stdout.split("\0").filter(Boolean) }));
	},

	async "check-ignore"(input, cwd) {
		const paths = pathsOf(input);
		if (paths.length === 0) return { ok: false, error: "check-ignore requires path or paths" };
		const res = await runGit(["check-ignore", "--", ...paths], cwd);
		if (res.code === 0) return { ok: true, ignored: lines(res.stdout) };
		if (res.code === 1) return { ok: true, ignored: [] };
		return fail(res, cwd);
	},

	async config(input, cwd) {
		const sub = input.sub || "get";
		const scope =
			input.scope === "global" ? ["--global"] : input.scope === "local" ? ["--local"] : [];
		if (input.key !== undefined && !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(input.key)) {
			return { ok: false, error: `Invalid config key '${input.key}'` };
		}
		switch (sub) {
			case "get": {
				if (!input.key) return { ok: false, error: "config get requires key" };
				const res = await runGit(["config", ...scope, "--get", input.key], cwd);
				if (res.code === 0) return { ok: true, key: input.key, value: redact(res.stdout.trim()) };
				if (res.code === 1) return { ok: true, key: input.key, value: null };
				return fail(res, cwd);
			}
			case "list":
				return run(["config", ...scope, "--list"], cwd, (res) => ({
					ok: true,
					entries: lines(redact(res.stdout)).map((l) => {
						const i = l.indexOf("=");
						return { key: l.slice(0, i), value: l.slice(i + 1) };
					}),
				}));
			case "set":
			case "unset": {
				if (!input.key) return { ok: false, error: `config ${sub} requires key` };
				if (DANGEROUS_CONFIG_KEYS.test(input.key)) {
					return {
						ok: false,
						error: `Refusing to ${sub} '${input.key}': this key can cause command execution or credential changes.`,
					};
				}
				if (sub === "set") {
					if (input.value === undefined) return { ok: false, error: "config set requires value" };
					return run(
						["config", ...(scope.length ? scope : ["--local"]), input.key, String(input.value)],
						cwd,
						() => ({
							ok: true,
							key: input.key,
							value: String(input.value),
						}),
					);
				}
				return run(
					["config", ...(scope.length ? scope : ["--local"]), "--unset", input.key],
					cwd,
					() => ({
						ok: true,
						key: input.key,
						unset: true,
					}),
				);
			}
			default:
				return {
					ok: false,
					error: `Unknown config subcommand: '${sub}'. Valid: get, list, set, unset`,
				};
		}
	},

	apply(input, cwd) {
		if (!input.patchText) return { ok: false, error: "apply requires patchText" };
		const args = ["apply"];
		if (input.checkOnly) args.push("--check");
		if (input.cached) args.push("--cached");
		if (input.reverse) args.push("-R");
		args.push("-");
		return run(
			args,
			cwd,
			() => ({ ok: true, applied: !input.checkOnly, checked: Boolean(input.checkOnly) }),
			{
				stdin: input.patchText,
			},
		);
	},

	clone(input, cwd) {
		if (!input.url) return { ok: false, error: "clone requires url" };
		const args = ["clone"];
		if (input.depth) args.push("--depth", String(input.depth));
		if (input.branch) args.push("--branch", input.branch);
		args.push("--", input.url);
		if (input.path) args.push(input.path);
		return run(args, cwd, () => ({ ok: true, url: redact(input.url), path: input.path || null }), {
			timeout: NETWORK_TIMEOUT_MS * 3,
		});
	},

	init(input, cwd) {
		const args = ["init"];
		if (input.branch) args.push("-b", input.branch);
		if (input.path) args.push("--", input.path);
		return run(args, cwd, () => ({
			ok: true,
			path: input.path || ".",
			branch: input.branch || null,
		}));
	},

	submodule(input, cwd) {
		const sub = input.sub || "status";
		const paths = dashPaths(pathsOf(input));
		switch (sub) {
			case "status":
				return run(["submodule", "status", "--recursive", ...paths], cwd, (res) => ({
					ok: true,
					submodules: lines(res.stdout).map((l) => {
						const m = l.match(/^([ +\-U])([0-9a-f]+) (\S+)/);
						return m
							? {
									path: m[3],
									hash: m[2],
									state: { " ": "ok", "+": "modified", "-": "uninitialized", U: "conflict" }[m[1]],
								}
							: { raw: l };
					}),
				}));
			case "update":
				return run(
					["submodule", "update", "--init", "--recursive", ...paths],
					cwd,
					(res) => ({
						ok: true,
						output: `${res.stdout}${res.stderr}`.trim(),
					}),
					{ timeout: NETWORK_TIMEOUT_MS },
				);
			case "init":
			case "sync":
				return run(["submodule", sub, ...paths], cwd, (res) => ({
					ok: true,
					output: res.stdout.trim(),
				}));
			default:
				return {
					ok: false,
					error: `Unknown submodule subcommand: '${sub}'. Valid: status, update, init, sync`,
				};
		}
	},
};

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
export async function gitImpl(input = {}, options = {}) {
	const { action } = input;

	if (!VALID_ACTIONS.includes(action)) {
		return {
			ok: false,
			error: `Unknown action: '${action}'. Valid actions: ${VALID_ACTIONS.join(", ")}`,
		};
	}

	const invalid = validateInput(input);
	if (invalid) return { ok: false, error: invalid, kind: "invalid-input" };

	const cwd = options.cwd || getProjectCwd() || getConfig().cwd || process.cwd();
	return handlers[action](input, cwd);
}

const bool = (description) => z.boolean().optional().describe(description);
const str = (description) => z.string().optional().describe(description);

/**
 * First-class git tool. Wraps common git operations so madz can perform git
 * work consistently instead of shelling out through the process tool. Uses
 * execFile("git", [args]) so args are passed as an array and never interpreted
 * by a shell. Ref/branch/remote/path values that look like options are
 * rejected, prompts and editors are disabled, commands have timeouts, and large
 * output is truncated.
 */
export const git = tool((input, options = {}) => gitImpl(input, options), {
	name: "git",
	description:
		"Git tool. Actions: status, diff, log, branch, add, commit, push, pull, checkout, switch, merge, rebase, stash, show, tag, worktree, remote, rev-parse, ls-remote, fetch, describe, restore, reset, blame, cherry-pick, revert, rm, mv, clean, merge-base, ls-files, check-ignore, config, apply, clone, init, submodule. " +
		"status returns per-file index/worktree codes plus staged/unstaged/untracked/conflicted flags. " +
		"diff supports cached/nameOnly/stat/patch/numstat, unified context, ignoreWhitespace, ref ranges ('a..b' or 'a b') and path filters; untracked files appear in status, not diff. " +
		"log supports limit with ref/range, author/since/until/grep, path history, subject and full formats. " +
		"commit supports all/amend/allowEmpty/noVerify/signoff. add supports paths/all/update. " +
		"push supports setUpstream/forceWithLease/tags/delete; force, forceWithLease and delete on main/master/trunk/develop/production require allowProtected. " +
		"pull supports rebase/ffOnly/prune/all; fetch supports prune/tags/all. " +
		"merge/rebase/cherry-pick/revert support abort/continue (rebase also skip and onto); failures with conflicts return a conflicts file list. " +
		"stash sub: push (includeUntracked, message, paths), list, pop, apply, drop, show (index selects stash@{n}). " +
		"restore unstages (staged) or discards (worktree) paths, optionally from ref; reset mode soft/mixed/hard (hard requires force) or unstages paths; clean is a dry run unless force. " +
		"branch supports list (all/remotes/merged/current), create, delete (-d, or -D with force), and rename (name = new name). " +
		"show supports stat/nameOnly and file (show path at ref). tag supports lightweight/force/delete/sortVersion. " +
		"worktree sub: add/remove/list/prune/lock/unlock/move. remote sub: get-url/list/add/set-url/remove/rename/prune. config sub: get/list/set/unset (execution-capable keys refused). submodule sub: status/update/init/sync. " +
		"Values beginning with '-' or '+' are rejected. Uses execFile('git', [args]) — never sh -c.",
	schema: z.object({
		action: z.enum(VALID_ACTIONS).describe(`Action to perform (${VALID_ACTIONS.join(", ")})`),
		path: str("Single path (status/diff/log/add/rm/mv/restore/blame/show/ls-files/worktree)"),
		paths: z.array(z.string()).optional().describe("Multiple paths for path-aware actions"),
		to: str("Destination for mv or worktree move"),
		message: str("Commit/tag/merge/stash message, or worktree lock reason"),
		branch: str(
			"Branch for checkout/switch/branch/merge/rebase/push/fetch/pull/clone/init/worktree actions",
		),
		remote: str("Remote for push/pull/fetch/ls-remote/remote actions"),
		ref: str(
			"Ref/range for show/diff/log/rev-parse/describe/tag/checkout/reset/restore/blame/cherry-pick/revert/merge-base/worktree/branch-merged (space-separated for multiple)",
		),
		limit: z.number().int().positive().optional().describe("Maximum commits for log"),
		force: bool(
			"Pass --force semantics: push --force, branch -D, worktree remove --force, reset --hard confirm, clean/rm/tag -f, checkout/stash overrides",
		),
		sub: str("Subcommand for worktree/remote/stash/config/submodule"),
		name: str("Tag name (tag), new name (branch rename, remote rename)"),
		url: str("URL for remote add/set-url or clone"),
		flag: z.enum(REV_PARSE_FLAGS).optional().describe("Flag for rev-parse action"),
		create: bool("Create a branch on checkout/switch (-b/-c) or branch create"),
		delete: bool("Delete a branch (-d, or -D with force), tag, or remote branch (push)"),
		detach: bool("Detach HEAD (checkout/switch --detach [ref])"),
		existing: bool("Link a worktree to an existing branch (worktree add <path> <branch>)"),
		cached: bool("Diff the staged index (--cached); rm --cached; apply --cached"),
		nameOnly: bool("List changed file names only (--name-only)"),
		stat: bool("Show a diffstat (--stat)"),
		patch: bool("Show the full unified diff (raw patch); for stash show, include the patch"),
		numstat: bool("Show numstat (default for diff)"),
		subject: bool("List commit subjects only (log --pretty=format:%s)"),
		full: bool("log: include author, email, date as structured fields"),
		pattern: str("Pattern for tag list (-l)"),
		tags: bool("ls-remote --tags, push --tags, fetch --tags"),
		heads: bool("ls-remote --heads"),
		// add / commit
		all: bool("add -A; commit -a; fetch/pull --all; branch list -a"),
		update: bool("add -u (stage tracked changes only)"),
		amend: bool("commit --amend (message optional)"),
		allowEmpty: bool("commit --allow-empty"),
		noVerify: bool("commit --no-verify"),
		signoff: bool("commit --signoff"),
		// push / pull / fetch
		setUpstream: bool("push -u"),
		forceWithLease: bool("push --force-with-lease"),
		allowProtected: bool("Allow destructive operations on main/master/trunk/develop/production"),
		rebase: bool("pull --rebase"),
		ffOnly: bool("pull/merge --ff-only"),
		prune: bool("fetch/pull --prune"),
		// merge / sequencer
		noFf: bool("merge --no-ff"),
		squash: bool("merge --squash"),
		abort: bool("merge/rebase/cherry-pick/revert --abort"),
		continue: bool("merge/rebase/cherry-pick/revert --continue"),
		skip: bool("rebase/cherry-pick/revert --skip"),
		onto: str("rebase --onto <ref>"),
		noCommit: bool("cherry-pick/revert -n"),
		isAncestor: bool("merge-base --is-ancestor (ref: '<ancestor> <descendant>')"),
		// status / diff / log
		untracked: z.enum(["all", "normal", "no"]).optional().describe("status untracked files mode"),
		unified: z.number().int().min(0).optional().describe("diff context lines (-U<n>)"),
		ignoreWhitespace: bool("diff -w"),
		author: str("log --author"),
		since: str("log --since"),
		until: str("log --until"),
		grep: str("log --grep"),
		maxBytes: z
			.number()
			.int()
			.positive()
			.optional()
			.describe("Max output characters before truncation"),
		// branch
		remotes: bool("branch list -r"),
		merged: bool("branch list --merged [ref|HEAD]"),
		current: bool("branch --show-current"),
		// stash / restore / reset
		index: z.number().int().min(0).optional().describe("Stash index (stash@{n}), default 0"),
		includeUntracked: bool("stash push -u"),
		staged: bool("restore --staged"),
		worktree: bool("restore --worktree (default when staged is not set)"),
		mode: z.enum(["soft", "mixed", "hard"]).optional().describe("reset mode (default mixed)"),
		// show / blame / tag
		file: bool("show: print the file at path as of ref (ref:path)"),
		startLine: z.number().int().positive().optional().describe("blame start line"),
		endLine: z.number().int().positive().optional().describe("blame end line"),
		lightweight: bool("tag: create a lightweight (non-annotated) tag"),
		sortVersion: bool("tag list: sort by version, newest first"),
		// rm / clean / ls-files / config / apply / clone
		recursive: bool("rm -r"),
		directories: bool("clean -d"),
		others: bool("ls-files: untracked files (excluding ignored)"),
		ignored: bool("ls-files: ignored files"),
		modified: bool("ls-files: modified files"),
		key: str("config key"),
		value: str("config value for set"),
		scope: z.enum(["local", "global"]).optional().describe("config scope"),
		patchText: str("Unified diff text for apply (passed via stdin)"),
		checkOnly: bool("apply --check (verify without applying)"),
		reverse: bool("apply -R"),
		depth: z.number().int().positive().optional().describe("clone --depth"),
	}),
});
