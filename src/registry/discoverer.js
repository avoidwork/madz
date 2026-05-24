import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { SkillMetadataSchema } from "./types.js";

/**
 * Discover all skills in the skills/ directory by scanning for subdirectories
 * with a skill.yaml or skill.json file.
 * @param {string} skillsDir - Path to the skills directory (default: "skills/")
 * @returns {Array<{ path: string, name: string, metadata: Object }>}
 */
export function discoverSkills(skillsDir = "skills/") {
  const fullDir = join(process.cwd(), skillsDir);
  const skills = [];

  try {
    const entries = readdirSync(fullDir);
    for (const name of entries) {
      const skillPath = join(fullDir, name);
      const stat = statSync(skillPath);
      if (!stat.isDirectory()) continue;

      // Look for skill.yaml or skill.json
      const yamlPath = join(skillPath, "skill.yaml");
      const jsonPath = join(skillPath, "skill.json");

      let metadata = null;
      let metaPath = null;

      if (existsSync(yamlPath)) {
        const content = readFileSync(yamlPath, "utf-8");
        const parsed = yaml.load(content);
        if (parsed && typeof parsed === "object") metadata = parsed;
        metaPath = yamlPath;
      } else if (existsSync(jsonPath)) {
        const content = readFileSync(jsonPath, "utf-8");
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === "object") metadata = parsed;
        metaPath = jsonPath;
      } else {
        // No valid skill metadata file — skip silently
        continue;
      }

      if (!metadata) continue;

      // Add scripts path if available
      const scriptsDir = join(skillPath, "scripts");
      if (existsSync(scriptsDir) && statSync(scriptsDir).isDirectory()) {
        metadata.scripts = scriptsDir;
      }

      metadata._path = metaPath;
      metadata._directory = skillPath;
      skills.push({
        path: skillPath,
        name,
        metadata,
      });
    }
  } catch (err) {
    // Directory doesn't exist or can't be read — return empty
  }

  return skills;
}
