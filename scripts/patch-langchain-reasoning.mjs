#!/usr/bin/env node
/**
 * Patch @langchain/openai to handle vLLM's 'reasoning' field.
 *
 * vLLM sends reasoning tokens in a field called `reasoning` in the streaming
 * delta and final message. LangChain's OpenAI converter only reads
 * `reasoning_content` (OpenAI's field name), so vLLM's reasoning tokens are
 * silently dropped without these patches.
 *
 * Two patches:
 *   1. `convertCompletionsMessageToBaseMessage` — fallback `reasoning` →
 *      `reasoning_content` for non-streaming final messages
 *   2. `convertCompletionsDeltaToBaseMessageChunk` — same for streaming deltas
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
  "@langchain",
  "openai",
  "dist",
  "converters",
  "completions.js",
);

let src;
try {
  src = readFileSync(target, "utf8");
} catch {
  console.error(`[patch-langchain-reasoning] Cannot read ${target} — skipping`);
  process.exit(0);
}

const patches = [
  // Patch 1: message converter — fallback reasoning → reasoning_content
  {
    from: "const providerReasoningContent = message.reasoning_content;",
    to: "const providerReasoningContent = message.reasoning_content ?? message.reasoning;",
  },
  // Patch 2: delta converter — fallback reasoning → reasoning_content
  {
    from:
      "if (delta.reasoning_content !== void 0) additional_kwargs.reasoning_content = delta.reasoning_content;",
    to:
      "if (delta.reasoning_content !== void 0) additional_kwargs.reasoning_content = delta.reasoning_content;\n" +
      "\tif (delta.reasoning !== void 0 && delta.reasoning_content === void 0) additional_kwargs.reasoning_content = delta.reasoning;",
  },
];

let modified = false;
for (const { from, to } of patches) {
  if (src.includes(to)) {
    console.log(`[patch-langchain-reasoning] Already patched — skipping`);
    continue;
  }
  if (!src.includes(from)) {
    console.error(
      `[patch-langchain-reasoning] Cannot find expected source — file may have changed. Skipping.`,
    );
    continue;
  }
  src = src.replace(from, to);
  modified = true;
}

if (modified) {
  writeFileSync(target, src, "utf8");
  console.log(`[patch-langchain-reasoning] Patched ${target}`);
} else {
  console.log(`[patch-langchain-reasoning] No changes needed`);
}
