const BLOCKED_SCHEMES = new Set(["file:", "gopher:", "dict:"]);

/**
 * Filter outbound URLs, blocking prohibited schemes and checking against an allowlist.
 * @param {string} url - The URL to validate
 * @param {string[]} [allowlist=[]] - Allowed hostnames/URLs
 * @returns {{ allowed: boolean, reason: string }}
 */
export function filterUrl(url, allowlist = []) {
  if (!url || typeof url !== "string") {
    return { allowed: false, reason: "Invalid URL" };
  }

  try {
    const parsed = new URL(url);
    const scheme = parsed.protocol.toLowerCase();

    if (BLOCKED_SCHEMES.has(scheme)) {
      return { allowed: false, reason: `Blocked scheme: ${scheme}` };
    }

    if (allowlist.length > 0) {
      const hostname = parsed.hostname.toLowerCase();
      const onAllowlist = allowlist.some(
        (entry) =>
          hostname === entry.toLowerCase() || url.startsWith(entry.replace(/^https?:\/\//, ""))
      );
      if (!onAllowlist) {
        return { allowed: false, reason: `Host not on allowlist: ${hostname}` };
      }
    }

    return { allowed: true, reason: "" };
  } catch {
    return { allowed: false, reason: "Invalid URL format" };
  }
}

/**
 * Check if a URL scheme is allowed (no allowlist check).
 * @param {string} url - The URL to check
 * @returns {boolean}
 */
export function isSchemeAllowed(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const scheme = new URL(url).protocol.toLowerCase();
    return !BLOCKED_SCHEMES.has(scheme);
  } catch {
    return false;
  }
}
