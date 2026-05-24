import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const yaml = await import("js-yaml");

/**
 * Parse YAML frontmatter from a markdown file.
 * @param {string} content - The full markdown content
 * @returns {{ frontmatter: Object, content: string }} Parsed frontmatter and body
 */
export function parseFrontmatter(content) {
  if (!content) return { frontmatter: {}, content: "" };

  let frontmatter = {};
  let body = content;

  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (match) {
    const fmStr = match[1] || "";
    const fmParsed = yaml.load(fmStr);
    frontmatter = fmParsed && typeof fmParsed === "object" ? fmParsed : {};
    body = match[2] || "";
  }

  return { frontmatter, content: body.trim() };
}

/**
 * Load and parse a memory markdown file.
 * Returns { frontmatter, content, path }.
 * @param {string} filepath - Full path to the markdown file
 * @returns {{ frontmatter: Object, content: string, path: string } | null}
 */
export function readMemoryFile(filepath) {
  if (!existsSync(filepath)) return null;
  const content = readFileSync(filepath, "utf-8");
  const { frontmatter, content: body } = parseFrontmatter(content);
  return { frontmatter, content: body, path: filepath };
}
