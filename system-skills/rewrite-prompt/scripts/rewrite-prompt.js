/**
 * rewrite-prompt — Rewrites raw user prompts for better LLM consumption.
 *
 * Accepts a raw prompt via stdin or file argument, analyzes intent,
 * detects missing context, restructures for clarity, and outputs an
 * improved prompt while preserving the user's original intent.
 *
 * @module rewrite-prompt
 */

import { readFileSync } from "node:fs";
import { stdin, stdout } from "node:process";

/**
 * Error thrown when input validation fails.
 */
class InputError extends Error {
  /**
   * @param {string} message — The error message.
   */
  constructor(message) {
    super(message);
    this.name = "InputError";
  }
}

/**
 * Reads input from stdin or a file argument.
 * @param {string[]} args — Command-line arguments.
 * @returns {Promise<string>} The raw prompt text.
 */
async function readInput(args) {
  if (args.length > 0) {
    try {
      return readFileSync(args[0], "utf-8").trim();
    } catch {
      throw new InputError(`File not found: ${args[0]}`);
    }
  }

  return new Promise((resolve, reject) => {
    stdin.setEncoding("utf-8");
    let data = "";

    stdin.on("data", (chunk) => {
      data += chunk;
    });

    stdin.on("end", () => {
      resolve(data.trim());
    });

    stdin.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * Analyzes the raw prompt to identify the user's core intent.
 * Extracts key signals: action verb, subject, desired outcome.
 * @param {string} prompt — The raw user prompt.
 * @returns {{action: string, subject: string, outcome: string}} Parsed intent.
 */
function analyzeIntent(prompt) {
  const lower = prompt.toLowerCase();

  // Extract action verb (first meaningful verb)
  const actionPatterns = [
    /(?:write|create|build|implement|design|develop|make|generate|produce|fix|debug|optimize|refactor|explain|describe|list|show|demonstrate|teach|teach|help|solve|analyze|review|test|deploy|configure|setup|install|remove|delete|update|modify|change|convert|transform|migrate|port|adapt|extend|add|remove|replace|swap|merge|split|combine|concatenate|filter|sort|search|query|parse|validate|sanitize|encode|decode|compress|decompress|encrypt|decrypt|hash|sign|verify|authenticate|authorize|log|monitor|track|measure|calculate|compute|estimate|predict|forecast|simulate|model|visualize|render|display|present|report|summarize|translate|transcribe|extract|import|export|backup|restore|migrate|deploy|release|publish|share|distribute|aggregate|collect|gather|organize|categorize|classify|tag|label|annotate|comment|rate|score|rank|prioritize|schedule|queue|batch|stream|pipe|redirect|route|forward|relay|proxy|mirror|sync|replicate|clone|fork|branch|tag|release|publish|ship|deliver|fulfill|complete|finish|end|stop|halt|abort|cancel|skip|ignore|handle|manage|control|govern|regulate|govern|oversee|supervise|administer|operate|run|execute|perform|accomplish|achieve|attain|reach|realize|fulfill|satisfy|meet|match|align|coordinate|synchronize|harmonize|balance|weight|scale|adjust|tune|calibrate|fine-tune|optimize|maximize|minimize|reduce|increase|grow|expand|shrink|contract|compress|decompress|pack|unpack|wrap|unwrap|enclose|encapsulate|contain|hold|store|save|persist|commit|flush|clear|reset|reinitialize|reload|refresh|update|upgrade|downgrade|rollback|revert|restore|recover|repair|fix|correct|amend|revise|edit|modify|alter|change|adjust|adapt|tailor|customize|personalize|individualize|specialize|generalize|abstract|concretize|simplify|complicate|clarify|confuse|explain|elucidate|illuminate|enlighten|inform|notify|alert|warn|caution|advise|counsel|guide|direct|instruct|teach|educate|train|coach|mentor|tutor|school|institute|establish|found|create|build|construct|assemble|compose|form|shape|mold|forge|craft|make|produce|generate|generate|yield|bear|bring|deliver|provide|supply|furnish|equip|outfit|arm|prepare|ready|set|arrange|order|organize|structure|format|layout|design|plan|scheme|plot|map|chart|graph|diagram|illustrate|depict|portray|represent|symbolize|signify|mean|indicate|denote|convey|communicate|express|articulate|voice|utter|speak|say|tell|state|declare|assert|affirm|confirm|verify|validate|prove|demonstrate|show|reveal|disclose|expose|uncover|unveil|unmask|uncover|discover|find|locate|detect|spot|notice|observe|perceive|sense|feel|touch|taste|smell|hear|listen|watch|view|see|look|examine|inspect|scrutinize|analyze|study|research|investigate|explore|probe|pierce|penetrate|enter|invade|intrude|trespass|encroach|overlap|intersect|cross|meet|join|connect|link|attach|bind|tie|fasten|secure|lock|seal|close|shut|block|bar|obstruct|hinder|impede|delay|slow|retard|inhibit|suppress|repress|oppress|crush|smash|break|shatter|fracture|crack|split|divide|separate|part|detach|disconnect|unlink|unbind|untie|unfasten|unseal|uncover|open|unlock|unseal|release|free|liberate|emancipate|deliver|rescue|save|protect|defend|guard|shield|cover|hide|conceal|obscure|mask|disguise|camouflage|blend|merge|combine|unite|join|connect|link|attach|bind|tie|fasten|secure|lock|seal|close|shut|block|bar|obstruct|hinder|impede|delay|slow|retard|inhibit|suppress|repress|oppress|crush|smash|break|shatter|fracture|crack|split|divide|separate|part|detach|disconnect|unlink|unbind|untie|unfasten|unseal|uncover|open|unlock|unseal|release|free|liberate|emancipate|deliver|rescue|save|protect|defend|guard|shield|cover|hide|conceal|obscure|mask|disguise|camouflage|blend)/,
  ];

  let action = "process";
  for (const pattern of actionPatterns) {
    const match = prompt.match(pattern);
    if (match) {
      action = match[0];
      break;
    }
  }

  // Extract subject (what the action is applied to)
  const subjectPatterns = [
    /(?:a|an|the|this|that|these|those|my|your|his|her|its|our|their)\s+([a-zA-Z]+)/g,
  ];

  let subject = "the requested output";
  for (const pattern of subjectPatterns) {
    const match = prompt.match(pattern);
    if (match && match.length > 0) {
      subject = match[0].replace(/^(a|an|the|this|that|these|those|my|your|his|her|its|our|their)\s+/, "");
      break;
    }
  }

  // Extract outcome (what the user wants to achieve)
  let outcome = "a useful result";
  const outcomePatterns = [
    /(?:so|so that|in order to|to|for|because|because it|to be able|in order|for the purpose|with the goal|aiming|seeking|hoping|wanting|needing|requiring|desiring|intending|planning|planned|meant|designed|built|created|made|developed|produced|generated|yielded|brought|delivered|provided|supplied|furnished|equipped|outfitted|arm|prepared|ready|set|arranged|ordered|organized|structured|formatted|laid out|designed|planned|schemed|plotted|mapped|charted|graphed|diagrammed|illustrated|depicted|portrayed|represented|symbolized|signified|meant|indicated|denoted|conveyed|communicated|expressed|articulated|voiced|uttered|spoken|said|told|stated|declared|asserted|affirmed|confirmed|verified|validated|proven|demonstrated|shown|revealed|disclosed|exposed|uncovered|unveiled|unmasked|discovered|found|located|detected|spotted|noticed|observed|perceived|sensed|felt|touched|tasted|smelled|heard|listened|watched|viewed|seen|looked|examined|inspected|scrutinized|analyzed|studied|researched|investigated|explored|probed|pierced|penetrated|entered|invaded|intruded|trespassed|encroached|overlapped|intersected|crossed|met|joined|connected|linked|attached|bound|tied|fastened|secured|locked|sealed|closed|shut|blocked|barred|obstructed|hindered|impeded|delayed|slowed|retarded|inhibited|suppressed|repressed|oppressed|crushed|smashed|broken|shattered|fractured|cracked|split|divided|separated|parted|detached|disconnected|unlinked|unbound|untied|unfastened|unsealed|uncovered|opened|unlocked|unsealed|released|freed|liberated|emancipated|delivered|rescued|saved|protected|defended|guarded|shielded|covered|hidden|concealed|obscured|masked|disguised|camouflaged|blended|merged|combined|united|joined|connected|linked|attached|bound|tied|fastened|secured|locked|sealed|closed|shut|blocked|barred|obstructed|hindered|impeded|delayed|slowed|retarded|inhibited|suppressed|repressed|oppressed|crushed|smashed|broken|shattered|fractured|cracked|split|divided|separated|parted|detached|disconnected|unlinked|unbound|untied|unfastened|unsealed|uncovered|opened|unlocked|unsealed|released|freed|liberated|emancipated|delivered|rescued|saved|protected|defended|guarded|shielded|covered|hidden|concealed|obscured|masked|disguised|camouflaged|blended)/,
  ];

  for (const pattern of outcomePatterns) {
    const match = prompt.match(pattern);
    if (match) {
      outcome = match[0];
      break;
    }
  }

  return { action, subject, outcome };
}

/**
 * Detects missing context that the LLM would need.
 * @param {string} prompt — The raw user prompt.
 * @returns {string[]} List of missing context items.
 */
function detectContextGaps(prompt) {
  const gaps = [];
  const lower = prompt.toLowerCase();

  // Check for environment context
  const envKeywords = ["node", "python", "javascript", "typescript", "react", "vue", "angular", "express", "django", "flask", "next", "nuxt", "browser", "server", "client", "api", "database", "sql", "nosql", "mongodb", "postgres", "mysql", "redis", "docker", "kubernetes", "aws", "azure", "gcp", "linux", "macos", "windows"];
  const hasEnv = envKeywords.some((kw) => lower.includes(kw));
  if (!hasEnv) {
    gaps.push("environment/runtime (e.g., Node.js version, framework, browser vs. server)");
  }

  // Check for constraints
  const constraintKeywords = ["constraint", "limit", "requirement", "must", "should", "cannot", "can't", "avoid", "prefer", "best", "performance", "memory", "size", "speed", "latency", "throughput"];
  const hasConstraints = constraintKeywords.some((kw) => lower.includes(kw));
  if (!hasConstraints) {
    gaps.push("constraints (e.g., performance requirements, size limits, dependencies)");
  }

  // Check for output format
  const formatKeywords = ["format", "output", "return", "result", "json", "xml", "html", "csv", "table", "list", "array", "object", "string", "number", "boolean", "markdown", "code", "function", "class", "module", "file", "endpoint", "route", "component", "widget", "template", "schema", "interface", "type", "enum", "config", "configuration", "settings", "options", "parameters", "arguments", "flags", "options", "flags", "options"];
  const hasFormat = formatKeywords.some((kw) => lower.includes(kw));
  if (!hasFormat) {
    gaps.push("expected output format (e.g., code, documentation, explanation, data structure)");
  }

  return gaps;
}

/**
 * Restructures a prompt into a clear format: context → task → constraints → output format.
 * @param {string} prompt — The raw user prompt.
 * @param {object} intent — Parsed intent from analyzeIntent.
 * @param {string[]} gaps — Missing context items from detectContextGaps.
 * @returns {string} The restructured prompt.
 */
function restructurePrompt(prompt, intent, gaps) {
  const parts = [];

  // Context section
  if (gaps.length > 0) {
    parts.push(
      `Context: The user wants to ${intent.action} ${intent.subject}. ` +
      `Missing context that would help: ${gaps.join(", ")}.`
    );
  } else {
    parts.push(
      `Context: The user wants to ${intent.action} ${intent.subject}.`
    );
  }

  // Task section
  parts.push(`Task: ${prompt}`);

  // Constraints section
  if (gaps.length > 0) {
    parts.push(
      `Constraints: Consider the missing context when generating the response. ` +
      `If the user hasn't specified environment, constraints, or output format, ` +
      `make reasonable assumptions and state them clearly.`
    );
  }

  // Output format section
  parts.push(
    `Output: Provide a clear, actionable response that addresses the user's request. ` +
    `If the request is ambiguous, ask clarifying questions before proceeding.`
  );

  return parts.join("\n\n");
}

/**
 * Checks that the rewritten prompt preserves the user's original intent.
 * @param {string} original — The original prompt.
 * @param {string} rewritten — The rewritten prompt.
 * @returns {boolean} True if intent is preserved.
 */
function verifyIntentPreservation(original, rewritten) {
  const originalLower = original.toLowerCase();
  const rewrittenLower = rewritten.toLowerCase();

  // Check that key action words from the original are present in the rewrite
  const actionWords = originalLower.match(/\b(write|create|build|implement|design|develop|make|generate|produce|fix|debug|optimize|refactor|explain|describe|list|show|demonstrate|teach|help|solve|analyze|review|test|deploy|configure|setup|install|remove|delete|update|modify|change|convert|transform|migrate|port|adapt|extend|add|remove|replace|swap|merge|split|combine|concatenate|filter|sort|search|query|parse|validate|sanitize|encode|decode|compress|decompress|encrypt|decrypt|hash|sign|verify|authenticate|authorize|log|monitor|track|measure|calculate|compute|estimate|predict|forecast|simulate|model|visualize|render|display|present|report|summarize|translate|transcribe|extract|import|export|backup|restore|migrate|deploy|release|publish|share|distribute|aggregate|collect|gather|organize|categorize|classify|tag|label|annotate|comment|rate|score|rank|prioritize|schedule|queue|batch|stream|pipe|redirect|route|forward|relay|proxy|mirror|sync|replicate|clone|fork|branch|tag|release|publish|ship|deliver|fulfill|complete|finish|end|stop|halt|abort|cancel|skip|ignore|handle|manage|control|govern|regulate|govern|oversee|supervise|administer|operate|run|execute|perform|accomplish|achieve|attain|reach|realize|fulfill|satisfy|meet|match|align|coordinate|synchronize|harmonize|balance|weight|scale|adjust|tune|calibrate|fine-tune|optimize|maximize|minimize|reduce|increase|grow|expand|shrink|contract|compress|decompress|pack|unpack|wrap|unwrap|enclose|encapsulate|contain|hold|store|save|persist|commit|flush|clear|reset|reinitialize|reload|refresh|update|upgrade|downgrade|rollback|revert|restore|recover|repair|fix|correct|amend|revise|edit|modify|alter|change|adjust|adapt|tailor|customize|personalize|individualize|specialize|generalize|abstract|concretize|simplify|complicate|clarify|confuse|explain|elucidate|illuminate|enlighten|inform|notify|alert|warn|caution|advise|counsel|guide|direct|instruct|teach|educate|train|coach|mentor|tutor|school|institute|establish|found|create|build|construct|assemble|compose|form|shape|mold|forge|craft|make|produce|generate|yield|bear|bring|deliver|provide|supply|furnish|equip|outfit|arm|prepare|ready|set|arrange|order|organize|structure|format|layout|design|plan|scheme|plot|map|chart|graph|diagram|illustrate|depict|portray|represent|symbolize|signify|mean|indicate|denote|convey|communicate|express|articulate|voice|utter|speak|say|tell|state|declare|assert|affirm|confirm|verify|validate|prove|demonstrate|show|reveal|disclose|expose|uncover|unveil|unmask|uncover|discover|find|locate|detect|spot|notice|observe|perceive|sense|feel|touch|taste|smell|hear|listen|watch|view|see|look|examine|inspect|scrutinize|analyze|study|research|investigate|explore|probe|pierce|penetrate|enter|invade|intrude|trespass|encroach|overlap|intersect|cross|meet|join|connect|link|attach|bind|tie|fasten|secure|lock|seal|close|shut|block|bar|obstruct|hinder|impede|delay|slow|retard|inhibit|suppress|repress|oppress|crush|smash|break|shatter|fracture|crack|split|divide|separate|part|detach|disconnect|unlink|unbind|untie|unfasten|unseal|uncover|open|unlock|unseal|release|free|liberate|emancipate|deliver|rescue|save|protect|defend|guard|shield|cover|hide|conceal|obscure|mask|disguise|camouflage|blend|merge|combine|unite|join|connect|link|attach|bind|tie|fasten|secure|lock|seal|close|shut|block|bar|obstruct|hinder|impede|delay|slow|retard|inhibit|suppress|repress|oppress|crush|smash|break|shatter|fracture|crack|split|divide|separate|part|detach|disconnect|unlink|unbind|untie|unfasten|unseal|uncover|open|unlock|unseal|release|free|liberate|emancipate|deliver|rescue|save|protect|defend|guard|shield|cover|hide|conceal|obscure|mask|disguise|camouflage)\b/g);

  if (!actionWords || actionWords.length === 0) {
    return true; // No action words to check, assume preserved
  }

  // Check that at least one key action word is present in the rewrite
  const found = actionWords.some((word) => rewrittenLower.includes(word));
  return found;
}

/**
 * Rewrites a raw user prompt to be more effective for LLM consumption.
 * @param {string} prompt — The raw user prompt.
 * @returns {string} The rewritten prompt.
 */
function rewritePrompt(prompt) {
  if (!prompt || prompt.length === 0) {
    throw new InputError("No input provided. Please provide a prompt via stdin or file argument.");
  }

  // Handle already-structured prompts (minimal modification)
  if (prompt.includes("Context:") && prompt.includes("Task:") && prompt.includes("Constraints:")) {
    return prompt;
  }

  const intent = analyzeIntent(prompt);
  const gaps = detectContextGaps(prompt);
  let rewritten = restructurePrompt(prompt, intent, gaps);

  // Verify intent preservation
  if (!verifyIntentPreservation(prompt, rewritten)) {
    // If intent is not preserved, fall back to a simpler rewrite
    rewritten = `Please help me with the following:\n\n${prompt}\n\nContext: ${intent.action} ${intent.subject}. ${gaps.length > 0 ? "Missing context: " + gaps.join(", ") + "." : ""}`;
  }

  return rewritten;
}

/**
 * Main entry point. Reads input, rewrites the prompt, and outputs the result.
 * @returns {Promise<void>}
 */
async function main() {
  const args = process.argv.slice(2);
  let prompt;

  try {
    prompt = await readInput(args);
  } catch (err) {
    if (err instanceof InputError) {
      process.stderr.write(`Error: ${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }

  if (!prompt || prompt.length === 0) {
    process.stderr.write("Error: No input provided. Please provide a prompt via stdin or file argument.\n");
    process.exit(1);
  }

  try {
    const rewritten = rewritePrompt(prompt);
    stdout.write(rewritten + "\n");
  } catch (err) {
    if (err instanceof InputError) {
      process.stderr.write(`Error: ${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});