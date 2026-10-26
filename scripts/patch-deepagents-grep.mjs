#!/usr/bin/env node
/**
 * Patch deepagents to allow a custom `grep` tool name.
 *
 * deepagents' `BUILTIN_TOOL_NAMES` set (used only by the tool-name collision
 * check in `createDeepAgent`) is built by spreading `FILESYSTEM_TOOL_NAMES`,
 * which includes `grep`. madz excludes the library's own `grep` tool via
 * `excludedTools: ["execute", "grep", "ls"]` in the harness profile, so the
 * built-in `grep` is never injected. Registering a madz-native `grep` tool
 * therefore collides with a name that is never actually used.
 *
 * This patch filters `grep` out of `BUILTIN_TOOL_NAMES` so the collision check
 * passes, while leaving `FILESYSTEM_TOOL_NAMES` untouched so the filesystem
 * middleware behavior is unchanged.
 *
 * The dist bundle filenames are content-hashed (e.g. `langsmith-C-EMyQJ_.js`)
 * and change between releases, so the target is located by scanning the dist
 * directory for the `BUILTIN_TOOL_NAMES` definition rather than hardcoding a
 * path. Both the ESM (.js) and CJS (.cjs) bundles are patched.
 *
 * Applied via `postinstall` in package.json so it survives `npm install`.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, "..", "node_modules", "deepagents", "dist");

const from =
	"const BUILTIN_TOOL_NAMES = /* @__PURE__ */ new Set([\n" +
	"\t...FILESYSTEM_TOOL_NAMES,\n" +
	"\t...ASYNC_TASK_TOOL_NAMES,\n" +
	'\t"task"\n' +
	"]);";
const to =
	"const BUILTIN_TOOL_NAMES = /* @__PURE__ */ new Set([\n" +
	'\t...FILESYSTEM_TOOL_NAMES.filter((name) => name !== "grep"),\n' +
	"\t...ASYNC_TASK_TOOL_NAMES,\n" +
	'\t"task"\n' +
	"]);";

let files;
try {
	files = readdirSync(distDir);
} catch {
	console.error(`[patch-deepagents-grep] Cannot read ${distDir} — skipping`);
	process.exit(0);
}

const targets = files.filter((file) => file.endsWith(".js") || file.endsWith(".cjs"));
let patched = 0;

for (const file of targets) {
	const target = join(distDir, file);
	let src;
	try {
		src = readFileSync(target, "utf8");
	} catch {
		continue;
	}

	if (!src.includes(from)) {
		if (src.includes(to)) {
			console.log(`[patch-deepagents-grep] Already patched — skipping ${file}`);
		}
		continue;
	}

	writeFileSync(target, src.replace(from, to), "utf8");
	patched++;
	console.log(`[patch-deepagents-grep] Patched ${file}`);
}

if (patched === 0) {
	console.error(
		`[patch-deepagents-grep] No bundle contained the expected BUILTIN_TOOL_NAMES definition — file may have changed. Skipping.`,
	);
}
