/**
 * Apply a sampling ratio to determine which spans to keep.
 * @param {number} ratio - Sampling ratio (0.0 to 1.0)
 * @returns {{ ratio: number, shouldSample: Function }}
 */
export function createSampler(ratio = 0.1) {
  const prob = Math.max(0, Math.min(1, ratio));

  /**
   * Determine if a span should be sampled.
   * @returns {boolean}
   */
  return {
    ratio: prob,
    shouldSample: function () {
      return Math.random() < prob;
    },
  };
}

/**
 * Load sampler configuration from telemetry config.
 * @param {Object} config - Telemetry config with sampling.ratio
 * @returns {{ ratio: number, shouldSample: Function }}
 */
export function loadSampler(config = {}) {
  const ratio = (config.sampling && config.sampling.ratio) || 0.1;
  return createSampler(ratio);
}
