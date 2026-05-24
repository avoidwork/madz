import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter } from "./reader.js";

/**
 * Read recent context files and return their content as a combined string.
 * @param {string} contextDir - Path to the context directory
 * @param {number} limit - Maximum number of recent files to load
 * @returns {string} Combined context content
 */
export function loadContext(contextDir = "memory/context/", limit = 10) {
  const fullPath = join(process.cwd(), contextDir);
  try {
    const files = readdirSync(fullPath).filter((f) => f.endsWith(".md"));
    const sorted = files
      .map((filename) => {
        const filepath = join(fullPath, filename);
        const content = readFileSync(filepath, "utf-8");
        const { frontmatter, content: body } = parseFrontmatter(content);
        return { filepath, frontmatter, body, timestamp: frontmatter.timestamp || "" };
      })
      .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));

    const recent = sorted.slice(0, limit);
    return recent
      .map((entry) => {
        const title = entry.frontmatter.title || entry.filepath;
        return `\n[Context: ${title}]\n${entry.body.trim()}`;
      })
      .join("\n");
  } catch {
    return "";
  }
}
