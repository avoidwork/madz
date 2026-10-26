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
 * Applied via `postinstall` in package.json so it survives `npm install`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = resolve(
  __dirname,
  "..",
  "node_modules",
  "deepagents",
  "dist",
  "langsmith-C-EMyQJ_.js",
);

let src;
try {
  src = readFileSync(target, "utf8");
} catch {
  console.error(`[patch-deepagents-grep] Cannot read ${target} — skipping`);
  process.exit(0);
}

const from = "const BUILTIN_TOOL_NAMES = /* @__PURE__ */ new Set([\n\t...FILESYSTEM_TOOL_NAMES,\n\t...ASYNC_TASK_TOOL_NAMES,\n\t\"task\"\n]);";
const to = "const BUILTIN_TOOL_NAMES = /* @__PURE__ */ new Set([\n\t...FILESYSTEM_TOOL_NAMES.filter((name) => name !== \"grep\"),\n\t...ASYNC_TASK_TOOL_NAMES,\n\t\"task\"\n]);";

if (src.includes(to)) {
  console.log(`[patch-deepagents-grep] Already patched — skipping`);
  process.exit(0);
}

if (!src.includes(from)) {
  console.error(
    `[patch-deepagents-grep] Cannot find expected source — file may have changed. Skipping.`,
  );
  process.exit(0);
}

writeFileSync(target, src.replace(from, to), "utf8");
console.log(`[patch-deepagents-grep] Patched ${target}`);
