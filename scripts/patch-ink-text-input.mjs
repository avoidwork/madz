#!/usr/bin/env node
/**
 * Patch ink-text-input to swallow ctrl+r and ctrl+t.
 *
 * The TUI uses ctrl+r / ctrl+t as global collapse toggles for reasoning and
 * tool-call blocks (handled in src/tui/app.js). But ink-text-input's useInput
 * handler inserts any key that isn't in its early-return list into the input
 * value — so ctrl+r and ctrl+t render as literal 'r' and 't' characters in the
 * message text.
 *
 * This patch adds ctrl+r and ctrl+t to that early-return guard so the keys are
 * swallowed and never reach the input value.
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
  "ink-text-input",
  "build",
  "index.js",
);

let src;
try {
  src = readFileSync(target, "utf8");
} catch {
  console.error(`[patch-ink-text-input] Cannot read ${target} — skipping`);
  process.exit(0);
}

const from =
  "if (key.upArrow ||\n" +
  "            key.downArrow ||\n" +
  "            (key.ctrl && input === 'c') ||\n" +
  "            key.tab ||\n" +
  "            (key.shift && key.tab)) {\n" +
  "            return;\n" +
  "        }";

const to =
  "if (key.upArrow ||\n" +
  "            key.downArrow ||\n" +
  "            (key.ctrl && input === 'c') ||\n" +
  "            (key.ctrl && input === 'r') ||\n" +
  "            (key.ctrl && input === 't') ||\n" +
  "            key.tab ||\n" +
  "            (key.shift && key.tab)) {\n" +
  "            return;\n" +
  "        }";

if (src.includes(to)) {
  console.log(`[patch-ink-text-input] Already patched — skipping`);
  process.exit(0);
}

if (!src.includes(from)) {
  console.error(
    `[patch-ink-text-input] Cannot find expected source — file may have changed. Skipping.`,
  );
  process.exit(0);
}

writeFileSync(target, src.replace(from, to), "utf8");
console.log(`[patch-ink-text-input] Patched ${target}`);
