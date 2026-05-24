/**
 * Select only whitelisted environment variables for the child process.
 * @param {string[]} whitelist - List of allowed environment variable names
 * @returns {Object} Object with only allowed env vars
 */
export function injectEnv(whitelist = []) {
  const env = {};
  for (const key of whitelist) {
    if (process.env[key] !== undefined) {
      env[key] = process.env[key];
    }
  }
  return env;
}

/**
 * Filter environment object to only include whitelisted keys.
 * @param {Object} env - The full environment object
 * @param {string[]} whitelist - List of allowed key names
 * @returns {Object}
 */
export function filterEnv(env, whitelist = []) {
  if (!env || typeof env !== "object") return {};
  const filtered = {};
  for (const key of whitelist) {
    if (env[key] !== undefined) {
      filtered[key] = env[key];
    }
  }
  return filtered;
}
