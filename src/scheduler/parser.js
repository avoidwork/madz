const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * Basic cron expression validator.
 * Validates 5-field or 6-field (second) cron syntax.
 * @param {string} expression - The cron expression to validate
 * @returns {{ valid: boolean, error: string }}
 */
export function validateCron(expression) {
  if (!expression || typeof expression !== "string") {
    return { valid: false, error: "Cron expression is required" };
  }

  const fields = expression.trim().split(/\s+/);
  if (fields.length < 5 || fields.length > 6) {
    return { valid: false, error: `Expected 5-6 fields, got ${fields.length}` };
  }

  const minuteRe = /^(\d{1,2}|\*)(\/\d+)?$/;
  const hourRe = /^(\d{1,2}|\*)(\/\d+)?$/;
  const dayRe = /^(\d{1,2}|\*(-\d{1,2})?|\*)(\/\d+)?$/;
  const monthRe = /^(\d{1,2}|\*[\/-]\d+|\*)(\/\d+)?$/;
  const dowRe = /^(\d{1,2}|\*\(-\d+)?\*(\/\d+)?$/;

  const patterns = [minuteRe, hourRe, dayRe, monthRe, dowRe];

  for (let i = 0; i < fields.length - 1; i++) {
    if (!patterns[i].test(fields[i])) {
      return { valid: false, error: `Invalid field "${fields[i]}" at position ${i}` };
    }
  }

  return { valid: true, error: "" };
}

/**
 * Parse a schedule entry from config.
 * @param {Object} entry - Raw schedule entry from config
 * @returns {{ valid: boolean, error: string, parsed: Object }}
 */
export function parseScheduleEntry(entry) {
  if (!entry.name) {
    return { valid: false, error: "Schedule entry must have a name" };
  }

  if (!entry.cron) {
    return { valid: false, error: `Schedule "${entry.name}" must have a cron expression` };
  }

  const cronValidation = validateCron(entry.cron);
  if (!cronValidation.valid) {
    return { valid: false, error: `Schedule "${entry.name}": ${cronValidation.error}` };
  }

  return {
    valid: true,
    error: "",
    parsed: {
      name: entry.name,
      cron: entry.cron,
      skill: entry.skill || "",
      input: entry.input || {},
      contextFile: entry.contextFile || "",
      enabled: entry.enabled !== false,
      paused: false,
      lastRun: null,
      nextRun: null,
    },
  };
}
